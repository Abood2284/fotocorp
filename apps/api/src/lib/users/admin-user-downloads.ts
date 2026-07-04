import { sql, type SQL } from "drizzle-orm"
import type { Env } from "../../appTypes"
import { createHttpDb, type DrizzleClient } from "../../db"
import { AppError } from "../errors"
import { createPreviewUrl } from "../media/preview-token"
import { CARD_LIGHT_PREVIEW_PROFILE, THUMB_LIGHT_PREVIEW_PROFILE } from "../media/watermark"
import { parsePreviewTtl } from "../assets/public-assets"

interface AdminUserDownloadsQuery {
  from?: string
  to?: string
  limit: number
  cursor?: CursorPayload | null
}

interface CursorPayload {
  at: string
  id: string
}

interface DownloadHistoryRow {
  download_id: string
  asset_id: string | null
  downloaded_at: Date | string
  download_size: string
  download_status: string
  who_is_in_picture: string | null
  headline: string | null
  caption: string | null
  fotokey: string | null
  card_width: number | null
  card_height: number | null
  thumb_width: number | null
  thumb_height: number | null
}

export function parseAdminUserDownloadsQuery(search: URLSearchParams): AdminUserDownloadsQuery {
  const limitRaw = Number(search.get("limit") ?? "25")
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.trunc(limitRaw))) : 25
  const from = parseDateParam(search.get("from"))
  const to = parseDateParam(search.get("to"))
  if (from && to && from > to) {
    throw new AppError(400, "INVALID_DATE_RANGE", "From date must be on or before to date.")
  }
  return {
    from: from ?? undefined,
    to: to ?? undefined,
    limit,
    cursor: parseCursor(search.get("cursor")),
  }
}

export async function listAdminUserDownloads(
  db: DrizzleClient,
  env: Env,
  authUserId: string,
  query: AdminUserDownloadsQuery,
) {
  if (!authUserId.trim()) {
    throw new AppError(400, "INVALID_AUTH_USER_ID", "User id is invalid.")
  }

  const userExists = await executeRows<{ id: string }>(db, sql`
    select id from users where id = ${authUserId}::uuid limit 1
  `)
  if (!userExists[0]) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.")
  }

  const filters = buildDownloadFilters(authUserId, query.from, query.to, query.cursor ?? null)
  const [rows, totalRows] = await Promise.all([
    listDownloadRows(db, filters, query.limit + 1),
    countDownloadRows(db, filters),
  ])

  const pageRows = rows.slice(0, query.limit)
  const last = pageRows.at(-1)

  return {
    ok: true as const,
    items: await Promise.all(pageRows.map((row) => toDownloadHistoryItem(row, env))),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor(last.downloaded_at, last.download_id)
        : null,
    total: Number(totalRows[0]?.total ?? 0) || 0,
  }
}

function buildDownloadFilters(
  authUserId: string,
  from: string | undefined,
  to: string | undefined,
  cursor: CursorPayload | null,
) {
  const filters: SQL[] = [
    sql`dl.user_id = ${authUserId}::uuid`,
    sql`dl.download_status in ('STARTED', 'COMPLETED')`,
    sql`dl.image_asset_id is not null`,
  ]
  if (from) {
    filters.push(sql`dl.created_at >= ${`${from}T00:00:00Z`}::timestamptz`)
  }
  if (to) {
    filters.push(sql`dl.created_at < (${`${to}T00:00:00Z`}::timestamptz + interval '1 day')`)
  }
  if (cursor) {
    filters.push(sql`(dl.created_at, dl.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`)
  }
  return filters
}

async function listDownloadRows(db: DrizzleClient, filters: SQL[], limit: number) {
  return executeRows<DownloadHistoryRow>(db, sql`
    select
      dl.id as download_id,
      dl.image_asset_id as asset_id,
      dl.created_at as downloaded_at,
      dl.download_size,
      dl.download_status,
      a.who_is_in_picture,
      a.headline,
      a.caption,
      a.fotokey,
      card.width as card_width,
      card.height as card_height,
      thumb.width as thumb_width,
      thumb.height as thumb_height
    from image_download_logs dl
    left join image_assets a on a.id = dl.image_asset_id
    left join image_derivatives card
      on card.image_asset_id = a.id
      and card.variant = 'CARD'
      and card.generation_status = 'READY'
      and card.is_watermarked = true
      and card.watermark_profile = ${CARD_LIGHT_PREVIEW_PROFILE}
    left join image_derivatives thumb
      on thumb.image_asset_id = a.id
      and thumb.variant = 'THUMB'
      and thumb.generation_status = 'READY'
      and thumb.is_watermarked = true
      and thumb.watermark_profile = ${THUMB_LIGHT_PREVIEW_PROFILE}
    where ${sql.join(filters, sql` and `)}
    order by dl.created_at desc, dl.id desc
    limit ${limit}
  `)
}

async function countDownloadRows(db: DrizzleClient, filters: SQL[]) {
  return executeRows<{ total: string }>(db, sql`
    select count(*)::text as total
    from image_download_logs dl
    where ${sql.join(filters, sql` and `)}
  `)
}

async function toDownloadHistoryItem(row: DownloadHistoryRow, env: Env) {
  return {
    downloadId: row.download_id,
    assetId: row.asset_id,
    downloadedAt: toIso(row.downloaded_at),
    downloadSize: row.download_size,
    status: row.download_status,
    headline: row.headline,
    whoIsInPicture: row.who_is_in_picture,
    caption: row.caption,
    fotokey: row.fotokey,
    previewUrl: row.asset_id ? await previewUrl(row.asset_id, row.card_width, row.card_height, "card", env) : null,
    thumbUrl: row.asset_id ? await previewUrl(row.asset_id, row.thumb_width, row.thumb_height, "thumb", env) : null,
  }
}

async function previewUrl(
  assetId: string,
  width: number | null,
  height: number | null,
  variant: "thumb" | "card",
  env: Env,
) {
  if (!width || !height || !env.MEDIA_PREVIEW_TOKEN_SECRET) return null
  return {
    url: await createPreviewUrl(
      assetId,
      variant,
      env.MEDIA_PREVIEW_TOKEN_SECRET,
      parsePreviewTtl(env.MEDIA_PREVIEW_TOKEN_TTL_SECONDS),
    ),
    width,
    height,
  }
}

function parseDateParam(value: string | null) {
  if (!value?.trim()) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new AppError(400, "INVALID_DATE", "Date must use yyyy-mm-dd format.")
  }
  return value.trim()
}

function parseCursor(value: string | null): CursorPayload | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(atob(value)) as CursorPayload
    if (!parsed.at || !parsed.id || !isUuid(parsed.id)) throw new Error("invalid")
    return parsed
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "Cursor is invalid.")
  }
}

function encodeCursor(at: Date | string, id: string) {
  return btoa(JSON.stringify({ at: toIso(at), id }))
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[]
  }
  return []
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function adminUserDownloadsDb(env: Env) {
  if (!env.DATABASE_URL) {
    throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  }
  return createHttpDb(env.DATABASE_URL)
}
