import { sql, type SQL } from "drizzle-orm"
import type { Env } from "../../../appTypes"
import { createHttpDb, type DrizzleClient } from "../../../db"
import { AppError } from "../../../lib/errors"
import { createPreviewUrl } from "../../../lib/media/preview-token"
import { CARD_CLEAN_PROFILE, THUMB_CLEAN_PROFILE } from "../../../lib/media/watermark"
import { parsePreviewTtl } from "../../../lib/assets/public-assets"

interface ListDownloadHistoryInput {
  authUserId: string
  year?: string
  month?: string
  limit?: string
  cursor?: string
}

interface ProfileRow {
  id: string
  status: string
}

interface DownloadHistoryRow {
  download_id: string
  asset_id: string | null
  downloaded_at: Date | string
  download_size: string
  download_status: string
  title: string | null
  headline: string | null
  caption: string | null
  legacy_imagecode: string | null
  card_width: number | null
  card_height: number | null
  thumb_width: number | null
  thumb_height: number | null
}

interface CursorPayload {
  at: string
  id: string
}

export async function listDownloadHistoryService(
  env: Env,
  input: ListDownloadHistoryInput,
): Promise<Response> {
  const authUserId = normalizeRequired(input.authUserId, "AUTH_USER_REQUIRED")
  const year = parseYear(input.year ?? null)
  const month = parseMonth(input.month ?? null)
  const limit = parseLimit(input.limit ?? null, 25, 50)
  const cursor = parseCursor(input.cursor ?? null)
  const db = dbFor(env)

  await requireActiveProfile(db, authUserId)

  const rows = await listDownloadRows(db, { authUserId, year, month, limit: limit + 1, cursor })
  const pageRows = rows.slice(0, limit)

  return safeJson({
    ok: true,
    items: await Promise.all(pageRows.map((row) => toDownloadHistoryItem(row, env))),
    nextCursor: rows.length > limit && pageRows.at(-1)
      ? encodeCursor(pageRows.at(-1)!.downloaded_at, pageRows.at(-1)!.download_id)
      : null,
  })
}

async function requireActiveProfile(db: DrizzleClient, authUserId: string): Promise<ProfileRow> {
  const rows = await executeRows<ProfileRow>(db, sql`
    select id, status
    from app_user_profiles
    where auth_user_id = ${authUserId}
    limit 1
  `)
  const profile = rows[0]
  if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile was not found.")
  if (profile.status !== "ACTIVE") throw new AppError(403, "PROFILE_NOT_ACTIVE", "Profile is not active.")
  return profile
}

async function listDownloadRows(
  db: DrizzleClient,
  input: {
    authUserId: string
    year: number | null
    month: number | null
    limit: number
    cursor: CursorPayload | null
  },
): Promise<DownloadHistoryRow[]> {
  const filters: SQL[] = [
    sql`dl.auth_user_id = ${input.authUserId}`,
    sql`dl.download_status in ('STARTED', 'COMPLETED')`,
    sql`dl.image_asset_id is not null`,
  ]
  if (input.year) filters.push(sql`extract(year from dl.created_at) = ${input.year}`)
  if (input.month) filters.push(sql`extract(month from dl.created_at) = ${input.month}`)
  if (input.cursor) filters.push(sql`(dl.created_at, dl.id) < (${input.cursor.at}::timestamptz, ${input.cursor.id}::uuid)`)

  return executeRows<DownloadHistoryRow>(db, sql`
    select
      dl.id as download_id,
      dl.image_asset_id as asset_id,
      dl.created_at as downloaded_at,
      dl.download_size,
      dl.download_status,
      a.title,
      a.headline,
      a.caption,
      a.legacy_image_code as legacy_imagecode,
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
      and card.is_watermarked = false
      and card.watermark_profile = ${CARD_CLEAN_PROFILE}
    left join image_derivatives thumb
      on thumb.image_asset_id = a.id
      and thumb.variant = 'THUMB'
      and thumb.generation_status = 'READY'
      and thumb.is_watermarked = false
      and thumb.watermark_profile = ${THUMB_CLEAN_PROFILE}
    where ${sql.join(filters, sql` and `)}
    order by dl.created_at desc, dl.id desc
    limit ${input.limit}
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
    title: row.title,
    caption: row.caption,
    fotokey: row.legacy_imagecode,
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
  if (!width || !height) return null
  return {
    url: await createPreviewUrl(assetId, variant, env.MEDIA_PREVIEW_TOKEN_SECRET, parsePreviewTtl(env.MEDIA_PREVIEW_TOKEN_TTL_SECONDS)),
    width,
    height,
  }
}

function dbFor(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}

function safeJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

function normalizeRequired(value: string | null | undefined, code: string) {
  const normalized = value?.trim()
  if (!normalized) throw new AppError(400, code, "Required value is missing.")
  return normalized
}

function parseLimit(value: string | null, fallback: number, max: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new AppError(400, "INVALID_LIMIT", `Limit must be between 1 and ${max}.`)
  }
  return parsed
}

function parseYear(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    throw new AppError(400, "INVALID_YEAR", "Year filter is invalid.")
  }
  return parsed
}

function parseMonth(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    throw new AppError(400, "INVALID_MONTH", "Month filter is invalid.")
  }
  return parsed
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
