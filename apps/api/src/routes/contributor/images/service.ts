import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
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
  title: string | null;
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
      ia.title,
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

function mapImageRow(row: PhotographerImageRow) {
  return {
    id: row.id,
    contributorId: row.contributor_id,
    legacyImageCode: row.legacy_image_code,
    title: row.title,
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
