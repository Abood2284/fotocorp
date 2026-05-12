import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../db";
import { AppError } from "../errors";
import { createPreviewUrl, type MediaPreviewVariant } from "../media/preview-token";
import { CURRENT_WATERMARK_PROFILE } from "../media/watermark";

type SortMode = "newest" | "oldest" | "relevance";

interface PublicAssetQuery {
  q?: string;
  categoryId?: string;
  eventId?: string;
  contributorId?: string;
  year?: number;
  month?: number;
  cursor?: string;
  limit: number;
  sort: SortMode;
}

export interface PublicAssetListQueryInput {
  q?: string | null;
  categoryId?: string | null;
  eventId?: string | null;
  contributorId?: string | null;
  year?: string | null;
  month?: string | null;
  cursor?: string | null;
  limit?: string | null;
  sort?: string | null;
}

interface CursorPayload {
  sort: SortMode;
  rank?: number;
  sortAt: string;
  id: string;
}

interface AssetRow {
  id: string;
  legacy_imagecode: string | null;
  title: string | null;
  caption: string | null;
  headline: string | null;
  keywords: string | null;
  image_date: Date | string | null;
  uploaded_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  status: string;
  visibility: string;
  media_type: string;
  source: string;
  sort_at: Date | string;
  rank: number | string | null;
  category_id: string | null;
  category_name: string | null;
  event_id: string | null;
  event_name: string | null;
  event_date: Date | string | null;
  event_location: string | null;
  contributor_id: string | null;
  contributor_display_name: string | null;
  thumb_width: number | null;
  thumb_height: number | null;
  card_width: number | null;
  card_height: number | null;
  detail_width: number | null;
  detail_height: number | null;
}

interface FilterRow {
  id: string;
  name: string | null;
  event_date?: Date | string | null;
  asset_count: number | string;
}
interface CountRow {
  total_count: number | string;
}

interface CollectionRow {
  id: string;
  name: string | null;
  asset_count: number | string;
  preview_asset_id: string;
  preview_width: number | null;
  preview_height: number | null;
}

interface EventRow {
  id: string;
  name: string | null;
  event_date: Date | string | null;
  asset_count: number | string;
  preview_asset_id: string;
  preview_width: number | null;
  preview_height: number | null;
}

interface PreviewDto {
  url: string;
  width: number;
  height: number;
}

interface AssetDto {
  id: string;
  fotokey: string | null;
  title: string | null;
  caption: string | null;
  headline: string | null;
  keywords: string | null;
  imageDate: string | null;
  uploadedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  status: string;
  visibility: string;
  mediaType: string;
  source: string;
  category: { id: string; name: string } | null;
  event: { id: string; name: string | null; eventDate: string | null; location: string | null } | null;
  contributor: { id: string; displayName: string } | null;
  previews: {
    thumb: PreviewDto | null;
    card: PreviewDto | null;
    detail?: PreviewDto | null;
  };
}

export async function listPublicAssets(
  db: DrizzleClient,
  input: PublicAssetListQueryInput,
  secret: string | undefined,
  ttlSeconds: number,
) {
  const query = parseListQuery(input);
  const rows = await executeRows<AssetRow>(db, buildListSql(query));
  const countRows = await executeRows<CountRow>(db, buildCountSql(query));
  const pageRows = rows.slice(0, query.limit);
  const items = await Promise.all(pageRows.map((row) => toAssetDto(row, secret, ttlSeconds, false)));
  const lastReturnedRow = pageRows.at(-1);
  const nextCursor = rows.length > query.limit && lastReturnedRow
    ? encodeCursor(toCursor(lastReturnedRow, query.sort))
    : null;
  const totalCount = Number(countRows[0]?.total_count ?? 0);

  return { items, nextCursor, totalCount };
}

export async function getPublicAssetDetail(
  db: DrizzleClient,
  assetId: string,
  secret: string | undefined,
  ttlSeconds: number,
) {
  if (!isUuid(assetId)) {
    throw new AppError(400, "INVALID_ASSET_ID", "Asset id is invalid.");
  }

  const rows = await executeRows<AssetRow>(db, buildDetailSql(assetId));
  const row = rows[0];
  if (!row) {
    throw new AppError(404, "ASSET_NOT_FOUND", "Asset was not found.");
  }

  return { asset: await toAssetDto(row, secret, ttlSeconds, true) };
}

export async function getPublicAssetFilters(db: DrizzleClient) {
  const categories = await executeRows<FilterRow>(db, sql`
    select c.id, c.name, count(*)::int as asset_count
    from image_assets a
    join image_derivatives card
      on card.image_asset_id = a.id
      and card.variant = 'CARD'
      and card.generation_status = 'READY'
      and card.is_watermarked = true
      and card.watermark_profile = ${CURRENT_WATERMARK_PROFILE}
    join asset_categories c on c.id = a.category_id
    where ${publicAssetPredicate("a")}
    group by c.id, c.name
    order by asset_count desc, c.name asc
    limit 100
  `);

  const events = await executeRows<FilterRow>(db, sql`
    select e.id, e.name, e.event_date, count(*)::int as asset_count
    from image_assets a
    join image_derivatives card
      on card.image_asset_id = a.id
      and card.variant = 'CARD'
      and card.generation_status = 'READY'
      and card.is_watermarked = true
      and card.watermark_profile = ${CURRENT_WATERMARK_PROFILE}
    join photo_events e on e.id = a.event_id
    where ${publicAssetPredicate("a")}
    group by e.id, e.name, e.event_date
    order by e.event_date desc nulls last, asset_count desc, e.id desc
    limit 100
  `);

  return {
    categories: categories.map((row) => ({
      id: row.id,
      name: row.name ?? "Untitled category",
      assetCount: Number(row.asset_count),
    })),
    events: events.map((row) => ({
      id: row.id,
      name: row.name,
      eventDate: toIso(row.event_date),
      assetCount: Number(row.asset_count),
    })),
  };
}

export async function getPublicAssetCollections(
  db: DrizzleClient,
  secret: string | undefined,
  ttlSeconds: number,
) {
  const rows = await executeRows<CollectionRow>(db, sql`
    select
      c.id,
      c.name,
      count(*)::int as asset_count,
      preview.asset_id as preview_asset_id,
      preview.width as preview_width,
      preview.height as preview_height
    from asset_categories c
    join image_assets a on a.category_id = c.id
    join image_derivatives card
      on card.image_asset_id = a.id
      and card.variant = 'CARD'
      and card.generation_status = 'READY'
      and card.is_watermarked = true
      and card.watermark_profile = ${CURRENT_WATERMARK_PROFILE}
    join lateral (
      select a2.id as asset_id, card2.width, card2.height
      from image_assets a2
      join image_derivatives card2
        on card2.image_asset_id = a2.id
        and card2.variant = 'CARD'
        and card2.generation_status = 'READY'
        and card2.is_watermarked = true
        and card2.watermark_profile = ${CURRENT_WATERMARK_PROFILE}
      where ${publicAssetPredicate("a2")}
        and a2.category_id = c.id
      order by coalesce(a2.image_date, a2.created_at) desc, a2.id desc
      limit 1
    ) preview on true
    where ${publicAssetPredicate("a")}
    group by c.id, c.name, preview.asset_id, preview.width, preview.height
    order by asset_count desc, c.name asc
    limit 12
  `);

  return {
    items: await Promise.all(rows.map(async (row) => ({
      id: row.id,
      name: row.name ?? "Untitled collection",
      assetCount: Number(row.asset_count),
      preview: row.preview_width && row.preview_height
        ? {
            url: await createPreviewUrl(row.preview_asset_id, "card", secret, ttlSeconds),
            width: row.preview_width,
            height: row.preview_height,
          }
        : null,
    }))),
  };
}

export async function getPublicAssetEvents(
  db: DrizzleClient,
  secret: string | undefined,
  ttlSeconds: number,
) {
  const rows = await executeRows<EventRow>(db, sql`
    select
      e.id,
      e.name,
      e.event_date,
      count(*)::int as asset_count,
      preview.asset_id as preview_asset_id,
      preview.width as preview_width,
      preview.height as preview_height
    from photo_events e
    join image_assets a on a.event_id = e.id
    join image_derivatives card
      on card.image_asset_id = a.id
      and card.variant = 'CARD'
      and card.generation_status = 'READY'
      and card.is_watermarked = true
      and card.watermark_profile = ${CURRENT_WATERMARK_PROFILE}
    join lateral (
      select a2.id as asset_id, card2.width, card2.height
      from image_assets a2
      join image_derivatives card2
        on card2.image_asset_id = a2.id
        and card2.variant = 'CARD'
        and card2.generation_status = 'READY'
        and card2.is_watermarked = true
        and card2.watermark_profile = ${CURRENT_WATERMARK_PROFILE}
      where ${publicAssetPredicate("a2")}
        and a2.event_id = e.id
      order by coalesce(a2.image_date, a2.created_at) desc, a2.id desc
      limit 1
    ) preview on true
    where ${publicAssetPredicate("a")}
    group by e.id, e.name, e.event_date, preview.asset_id, preview.width, preview.height
    order by e.event_date desc nulls last, asset_count desc, e.id desc
    limit 5
  `);

  return {
    items: await Promise.all(rows.map(async (row) => ({
      id: row.id,
      name: row.name ?? "Untitled event",
      eventDate: toIso(row.event_date),
      assetCount: Number(row.asset_count),
      preview: row.preview_width && row.preview_height
        ? {
            url: await createPreviewUrl(row.preview_asset_id, "card", secret, ttlSeconds),
            width: row.preview_width,
            height: row.preview_height,
          }
        : null,
    }))),
  };
}

export function parsePreviewTtl(value: string | undefined) {
  if (!value) return 1_800;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 60 || parsed > 86_400) return 1_800;
  return parsed;
}

function parseListQuery(input: PublicAssetListQueryInput): PublicAssetQuery {
  const q = normalizeOptional(input.q ?? null);
  const limit = parseLimit(input.limit ?? null);
  const sort = parseSort(input.sort ?? null, q);
  const cursor = normalizeOptional(input.cursor ?? null);

  return {
    q,
    categoryId: parseOptionalUuid(input.categoryId ?? null, "categoryId"),
    eventId: parseOptionalUuid(input.eventId ?? null, "eventId"),
    contributorId: parseOptionalUuid(input.contributorId ?? null, "contributorId"),
    year: parseYear(input.year ?? null),
    month: parseMonth(input.month ?? null),
    cursor,
    limit,
    sort,
  };
}

function buildListSql(query: PublicAssetQuery): SQL {
  const where = buildWhere(query);
  const order = orderBySql(query.sort);
  const pageSize = query.limit + 1;

  return sql`
    ${selectAssetSql(query.q)}
    ${fromAssetSql()}
    where ${sql.join(where, sql` and `)}
    ${order}
    limit ${pageSize}
  `;
}

function buildCountSql(query: PublicAssetQuery): SQL {
  const where = buildWhere({
    ...query,
    cursor: undefined,
  });

  return sql`
    select count(*)::int as total_count
    ${fromAssetSql()}
    where ${sql.join(where, sql` and `)}
  `;
}

function buildDetailSql(assetId: string): SQL {
  return sql`
    ${selectAssetSql(undefined)}
    ${fromAssetSql()}
    where ${publicAssetPredicate("a")}
      and a.id = ${assetId}
    limit 1
  `;
}

function buildWhere(query: PublicAssetQuery): SQL[] {
  const where = [publicAssetPredicate("a"), sql`card.id is not null`];
  if (query.categoryId) where.push(sql`a.category_id = ${query.categoryId}`);
  if (query.eventId) where.push(sql`a.event_id = ${query.eventId}`);
  if (query.contributorId) where.push(sql`a.contributor_id = ${query.contributorId}`);
  if (query.year) where.push(sql`extract(year from coalesce(e.event_date, a.image_date, a.created_at)) = ${query.year}`);
  if (query.month) where.push(sql`extract(month from coalesce(e.event_date, a.image_date, a.created_at)) = ${query.month}`);
  if (query.q) {
    where.push(sql`to_tsvector('english', coalesce(a.search_text, '')) @@ plainto_tsquery('english', ${query.q})`);
  }
  if (query.cursor) {
    where.push(cursorPredicate(decodeCursor(query.cursor), query.sort, query.q));
  }
  return where;
}

function selectAssetSql(q: string | undefined): SQL {
  const rank = q
    ? sql`ts_rank_cd(to_tsvector('english', coalesce(a.search_text, '')), plainto_tsquery('english', ${q}))`
    : sql`0`;

  return sql`
    select
      a.id,
      a.legacy_image_code as legacy_imagecode,
      a.title,
      a.caption,
      a.headline,
      a.keywords,
      a.image_date,
      a.uploaded_at,
      a.created_at,
      a.updated_at,
      a.status,
      a.visibility,
      a.media_type,
      a.source,
      coalesce(e.event_date, a.image_date, a.created_at) as sort_at,
      ${rank} as rank,
      c.id as category_id,
      c.name as category_name,
      e.id as event_id,
      e.name as event_name,
      e.event_date,
      e.location as event_location,
      p.id as contributor_id,
      p.display_name as contributor_display_name,
      thumb.width as thumb_width,
      thumb.height as thumb_height,
      card.width as card_width,
      card.height as card_height,
      detail.width as detail_width,
      detail.height as detail_height
  `;
}

function fromAssetSql(requireDetail = false): SQL {
  const detailJoin = requireDetail ? sql`join` : sql`left join`;

  return sql`
    from image_assets a
    join image_derivatives card
      on card.image_asset_id = a.id
      and card.variant = 'CARD'
      and card.generation_status = 'READY'
      and card.is_watermarked = true
      and card.watermark_profile = ${CURRENT_WATERMARK_PROFILE}
    left join image_derivatives thumb
      on thumb.image_asset_id = a.id
      and thumb.variant = 'THUMB'
      and thumb.generation_status = 'READY'
      and thumb.is_watermarked = true
      and thumb.watermark_profile = ${CURRENT_WATERMARK_PROFILE}
    ${detailJoin} image_derivatives detail
      on detail.image_asset_id = a.id
      and detail.variant = 'DETAIL'
      and detail.generation_status = 'READY'
      and detail.is_watermarked = true
      and detail.watermark_profile = ${CURRENT_WATERMARK_PROFILE}
    left join asset_categories c on c.id = a.category_id
    left join photo_events e on e.id = a.event_id
    left join contributors p on p.id = a.contributor_id
  `;
}

function publicAssetPredicate(alias: string): SQL {
  return sql.raw(`${alias}.status = 'ACTIVE' and ${alias}.visibility = 'PUBLIC' and ${alias}.media_type = 'IMAGE' and ${alias}.original_exists_in_storage = true`);
}

function orderBySql(sort: SortMode): SQL {
  if (sort === "oldest") return sql`order by sort_at asc, a.id asc`;
  if (sort === "relevance") return sql`order by rank desc, sort_at desc, a.id desc`;
  return sql`order by sort_at desc, a.id desc`;
}

function cursorPredicate(cursor: CursorPayload, sort: SortMode, q: string | undefined): SQL {
  if (cursor.sort !== sort) throw new AppError(400, "INVALID_CURSOR", "Cursor is invalid for this sort.");
  if (sort === "oldest") {
    return sql`(coalesce(e.event_date, a.image_date, a.created_at), a.id) > (${cursor.sortAt}::timestamptz, ${cursor.id}::uuid)`;
  }
  if (sort === "relevance") {
    return sql`(ts_rank_cd(to_tsvector('english', coalesce(a.search_text, '')), plainto_tsquery('english', ${q ?? ""})), coalesce(e.event_date, a.image_date, a.created_at), a.id) < (${cursor.rank ?? 0}, ${cursor.sortAt}::timestamptz, ${cursor.id}::uuid)`;
  }
  return sql`(coalesce(e.event_date, a.image_date, a.created_at), a.id) < (${cursor.sortAt}::timestamptz, ${cursor.id}::uuid)`;
}

async function toAssetDto(
  row: AssetRow,
  secret: string | undefined,
  ttlSeconds: number,
  includeDetail: boolean,
): Promise<AssetDto> {
  return {
    id: row.id,
    fotokey: row.legacy_imagecode,
    title: row.title,
    caption: row.caption,
    headline: row.headline,
    keywords: row.keywords,
    imageDate: toIso(row.image_date),
    uploadedAt: toIso(row.uploaded_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    status: row.status,
    visibility: row.visibility,
    mediaType: row.media_type,
    source: row.source,
    category: row.category_id && row.category_name ? { id: row.category_id, name: row.category_name } : null,
    event: row.event_id
      ? { id: row.event_id, name: row.event_name, eventDate: toIso(row.event_date), location: row.event_location }
      : null,
    contributor: row.contributor_id && row.contributor_display_name
      ? { id: row.contributor_id, displayName: row.contributor_display_name }
      : null,
    previews: {
      thumb: await preview(row, "thumb", secret, ttlSeconds),
      card: await preview(row, "card", secret, ttlSeconds),
      ...(includeDetail ? { detail: await preview(row, "detail", secret, ttlSeconds) } : {}),
    },
  };
}

async function preview(row: AssetRow, variant: MediaPreviewVariant, secret: string | undefined, ttlSeconds: number) {
  const width = row[`${variant}_width` as keyof AssetRow];
  const height = row[`${variant}_height` as keyof AssetRow];
  if (typeof width !== "number" || typeof height !== "number") return null;

  return {
    url: await createPreviewUrl(row.id, variant, secret, ttlSeconds),
    width,
    height,
  };
}

function toCursor(row: AssetRow, sort: SortMode): CursorPayload {
  return {
    sort,
    rank: Number(row.rank ?? 0),
    sortAt: toIso(row.sort_at) ?? new Date(0).toISOString(),
    id: row.id,
  };
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[];
  }
  return [];
}

function parseLimit(value: string | null) {
  if (!value) return 40;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 80) {
    throw new AppError(400, "INVALID_LIMIT", "Limit must be an integer between 1 and 80.");
  }
  return parsed;
}

function parseSort(value: string | null, q: string | undefined): SortMode {
  if (!value) return "newest";
  if (value === "newest" || value === "oldest") return value;
  if (value === "relevance" && q) return value;
  throw new AppError(400, "INVALID_SORT", "Sort is invalid for this request.");
}

function parseOptionalUuid(value: string | null, name: string) {
  const normalized = normalizeOptional(value);
  if (!normalized) return undefined;
  if (!isUuid(normalized)) throw new AppError(400, "INVALID_UUID", `${name} is invalid.`);
  return normalized;
}

function parseYear(value: string | null) {
  const normalized = normalizeOptional(value);
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
    throw new AppError(400, "INVALID_YEAR", "Year filter is invalid.");
  }
  return parsed;
}

function parseMonth(value: string | null) {
  const normalized = normalizeOptional(value);
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    throw new AppError(400, "INVALID_MONTH", "Month filter is invalid.");
  }
  return parsed;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeOptional(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function encodeCursor(cursor: CursorPayload) {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeCursor(value: string): CursorPayload {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const parsed = JSON.parse(atob(padded)) as Partial<CursorPayload>;
    if (!parsed.sort || !parsed.sortAt || !parsed.id || !isUuid(parsed.id)) throw new Error("invalid cursor");
    if (parsed.sort !== "newest" && parsed.sort !== "oldest" && parsed.sort !== "relevance") throw new Error("invalid cursor");
    return { sort: parsed.sort, sortAt: parsed.sortAt, id: parsed.id, rank: Number(parsed.rank ?? 0) };
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "Cursor is invalid.");
  }
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
