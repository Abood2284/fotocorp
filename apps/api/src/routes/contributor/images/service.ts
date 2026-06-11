import { sql, type SQL } from "drizzle-orm";
import type { Env } from "../../../appTypes";
import type { DrizzleClient } from "../../../db";
import { toDerivativeVariant } from "../../../lib/assets/public-catalog-sql";
import { getR2Object } from "../../../lib/r2";
import {
  parseMediaPreviewVariant,
  type MediaPreviewVariant,
} from "../../../lib/media/preview-token";
import type { ContributorSessionResult } from "../auth/service";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

interface CursorPayload {
  createdAt: string;
  id: string;
}

interface PhotographerImageRow {
  id: string;
  contributor_id: string;
  legacy_image_code: string | null;
  who_is_in_picture: string | null;
  headline: string | null;
  caption: string | null;
  status: string;
  visibility: string;
  created_at: Date | string;
  event_name: string | null;
  event_date: Date | string | null;
  event_location: string | null;
  has_thumb: boolean | null;
  has_card: boolean | null;
  has_detail: boolean | null;
}

export async function listPhotographerImages(
  db: DrizzleClient,
  session: ContributorSessionResult,
  input: { limit?: number; cursor?: string },
) {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;
  const cursorWhere = cursor
    ? sql`and (ia.created_at, ia.id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
    : sql``;

  const rows = await executeRows<PhotographerImageRow>(db, sql`
    select
      ia.id,
      ia.contributor_id,
      ia.legacy_image_code,
      ia.who_is_in_picture,
      ia.headline,
      ia.caption,
      ia.status,
      ia.visibility,
      ia.created_at,
      pe.name as event_name,
      pe.event_date,
      coalesce(nullif(pe.location, ''), nullif(pe.city, ''), nullif(pe.state_region, ''), nullif(pe.country, '')) as event_location,
      (thumb.id is not null) as has_thumb,
      (card.id is not null) as has_card,
      (detail.id is not null) as has_detail
    from image_assets ia
    left join photo_events pe on pe.id = ia.event_id
    left join image_derivatives thumb on thumb.image_asset_id = ia.id and thumb.variant = 'THUMB' and thumb.generation_status = 'READY'
    left join image_derivatives card on card.image_asset_id = ia.id and card.variant = 'CARD' and card.generation_status = 'READY'
    left join image_derivatives detail on detail.image_asset_id = ia.id and detail.variant = 'DETAIL' and detail.generation_status = 'READY'
    where ia.contributor_id = ${session.contributor.id}::uuid
    ${cursorWhere}
    order by ia.created_at desc, ia.id desc
    limit ${limit + 1}
  `);

  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);

  return {
    ok: true,
    items: pageRows.map(mapImageRow),
    nextCursor: rows.length > limit && last ? encodeCursor({ createdAt: String(last.created_at), id: last.id }) : null,
  };
}

export async function streamContributorImagePreview(
  db: DrizzleClient,
  session: ContributorSessionResult,
  env: Env,
  imageAssetId: string,
  variantParam: string,
): Promise<Response> {
  if (!isUuid(imageAssetId)) {
    return previewErrorResponse(400, "INVALID_ASSET_ID", "Asset id is invalid.");
  }

  let variant: MediaPreviewVariant;
  try {
    variant = parseMediaPreviewVariant(variantParam);
  } catch {
    return previewErrorResponse(400, "INVALID_VARIANT", "Unsupported preview variant.");
  }

  const assetRows = await executeRows<{
    id: string;
    contributor_id: string;
    original_exists_in_storage: boolean | null;
  }>(db, sql`
    select id, contributor_id, original_exists_in_storage
    from image_assets
    where id = ${imageAssetId}::uuid
    limit 1
  `);
  const asset = assetRows[0];
  if (!asset) {
    return previewErrorResponse(404, "ASSET_NOT_FOUND", "Asset was not found.");
  }

  if (asset.contributor_id !== session.contributor.id) {
    return previewErrorResponse(403, "FORBIDDEN", "You do not have access to this image.");
  }

  const derivativeRows = await executeRows<{
    id: string;
    mime_type: string;
    storage_key: string;
    generation_status: string;
  }>(db, sql`
    select id, mime_type, storage_key, generation_status
    from image_derivatives
    where image_asset_id = ${imageAssetId}::uuid
      and variant = ${toDerivativeVariant(variant)}
      and generation_status = 'READY'
    limit 1
  `);
  const derivative = derivativeRows[0];
  if (!derivative) {
    return previewErrorResponse(404, "DERIVATIVE_NOT_READY", "Preview is not available yet.");
  }

  if (!env.MEDIA_PREVIEWS_BUCKET) {
    return previewErrorResponse(500, "PREVIEW_BUCKET_NOT_CONFIGURED", "Preview service is not configured.");
  }

  try {
    const object = await getR2Object(env.MEDIA_PREVIEWS_BUCKET, derivative.storage_key);
    if (!object?.body) {
      return previewErrorResponse(404, "DERIVATIVE_OBJECT_NOT_FOUND", "Preview file is not available yet.");
    }

    const headers = new Headers();
    headers.set("Content-Type", derivative.mime_type ?? object.contentType ?? "image/webp");
    headers.set("Content-Disposition", "inline");
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    if (object.etag) headers.set("ETag", object.etag);
    if (object.contentLength !== null && object.contentLength !== undefined) {
      headers.set("Content-Length", String(object.contentLength));
    }
    if (object.uploaded) headers.set("Last-Modified", object.uploaded.toUTCString());

    return new Response(object.body, { status: 200, headers });
  } catch {
    return previewErrorResponse(502, "R2_ERROR", "Preview storage is temporarily unavailable.");
  }
}

function mapImageRow(row: PhotographerImageRow) {
  return {
    id: row.id,
    contributorId: row.contributor_id,
    legacyImageCode: row.legacy_image_code,
    whoIsInPicture: row.who_is_in_picture,
    headline: row.headline,
    caption: row.caption,
    status: row.status,
    visibility: row.visibility,
    createdAt: toIso(row.created_at),
    event: {
      name: row.event_name,
      date: row.event_date ? toIso(row.event_date) : null,
      location: row.event_location,
    },
    derivatives: {
      thumb: Boolean(row.has_thumb),
      card: Boolean(row.has_card),
      detail: Boolean(row.has_detail),
    },
  };
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function encodeCursor(payload: CursorPayload): string {
  return btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeCursor(value: string): CursorPayload | null {
  try {
    const json = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
    const parsed = JSON.parse(json) as Partial<CursorPayload>;
    if (!parsed.createdAt || !parsed.id) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}

function previewErrorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
