import { sql, type SQL } from "drizzle-orm"
import type { Env } from "../../../appTypes"
import { createHttpDb, type DrizzleClient } from "../../../db"
import { AppError } from "../../../lib/errors"
import { createPreviewUrl } from "../../../lib/media/preview-token"
import { CARD_LIGHT_PREVIEW_PROFILE, THUMB_LIGHT_PREVIEW_PROFILE } from "../../../lib/media/watermark"
import { parsePreviewTtl } from "../../../lib/assets/public-assets"
import { requireActivePlatformUser } from "../../../lib/users/platform-user"

interface ListFotoboxInput { userId: string; limit?: string; cursor?: string; boardId?: string }
interface AddFotoboxInput { userId: string; assetId: string; boardId: string }
interface RemoveFotoboxInput { userId: string; boardId?: string }
interface FotoboxRow { asset_id: string; saved_at: Date | string; who_is_in_picture: string | null; headline: string | null; caption: string | null; fotokey: string | null; category_name: string | null; event_name: string | null; card_width: number | null; card_height: number | null; thumb_width: number | null; thumb_height: number | null }
interface CursorPayload { at: string; id: string }

export async function listFotoboxService(env: Env, input: ListFotoboxInput): Promise<Response> {
  const db = dbFor(env)
  const userId = normalizeRequired(input.userId, "USER_ID_REQUIRED")
  await requireActivePlatformUser(db, userId)
  const limit = parseLimit(input.limit ?? null, 24, 48)
  const cursor = parseCursor(input.cursor ?? null)
  const boardId = input.boardId ?? undefined
  const rows = await listFotoboxRows(db, userId, limit + 1, cursor, boardId)
  const pageRows = rows.slice(0, limit)
  return safeJson({
    ok: true,
    items: await Promise.all(pageRows.map((row) => toFotoboxItem(row, env))),
    nextCursor: rows.length > limit && pageRows.at(-1) ? encodeCursor(pageRows.at(-1)!.saved_at, pageRows.at(-1)!.asset_id) : null,
  })
}

export async function addFotoboxService(env: Env, input: AddFotoboxInput): Promise<Response> {
  const db = dbFor(env)
  await requireActivePlatformUser(db, input.userId)
  await assertSaveableAsset(db, input.assetId)
  await assertBoardOwnership(db, input.boardId, input.userId)
  const inserted = await executeRows<{ created_at: Date | string }>(db, sql`
    insert into asset_fotobox_items (user_id, board_id, asset_id)
    values (${input.userId}::uuid, ${input.boardId}::uuid, ${input.assetId}::uuid)
    on conflict (board_id, asset_id) do nothing
    returning created_at
  `)
  const createdAt = inserted[0]?.created_at ?? await findSavedAt(db, input.userId, input.assetId, input.boardId)
  return safeJson({ ok: true, alreadySaved: inserted.length === 0, item: { assetId: input.assetId, createdAt: toIso(createdAt) } })
}

export async function removeFotoboxService(env: Env, assetId: string, input: RemoveFotoboxInput): Promise<Response> {
  const db = dbFor(env)
  await requireActivePlatformUser(db, input.userId)
  if (input.boardId) {
    await db.execute(sql`delete from asset_fotobox_items where user_id = ${input.userId}::uuid and asset_id = ${assetId}::uuid and board_id = ${input.boardId}::uuid`)
  } else {
    await db.execute(sql`delete from asset_fotobox_items where user_id = ${input.userId}::uuid and asset_id = ${assetId}::uuid`)
  }
  return safeJson({ ok: true })
}

async function assertSaveableAsset(db: DrizzleClient, assetId: string): Promise<void> {
  const rows = await executeRows<{ id: string }>(db, sql`
    select id from image_assets
    where id = ${assetId}::uuid and status = 'ACTIVE' and visibility = 'PUBLIC'
      and media_type = 'IMAGE' and original_exists_in_storage = true
    limit 1
  `)
  if (!rows[0]) throw new AppError(404, "ASSET_NOT_SAVEABLE", "Asset is not available for Fotobox.")
}

async function assertBoardOwnership(db: DrizzleClient, boardId: string, userId: string): Promise<void> {
  const rows = await executeRows<{ id: string }>(db, sql`
    select id from fotobox_boards where id = ${boardId}::uuid and user_id = ${userId}::uuid limit 1
  `)
  if (!rows[0]) throw new AppError(404, "BOARD_NOT_FOUND", "Board not found or does not belong to this user.")
}

async function findSavedAt(db: DrizzleClient, userId: string, assetId: string, boardId: string) {
  const rows = await executeRows<{ created_at: Date | string }>(db, sql`
    select created_at from asset_fotobox_items
    where user_id = ${userId}::uuid and asset_id = ${assetId}::uuid and board_id = ${boardId}::uuid
    limit 1
  `)
  return rows[0]?.created_at ?? new Date()
}

async function listFotoboxRows(
  db: DrizzleClient,
  userId: string,
  limit: number,
  cursor: CursorPayload | null,
  boardId?: string,
): Promise<FotoboxRow[]> {
  const boardFilter = boardId ? sql`and fi.board_id = ${boardId}::uuid` : sql``
  const cursorWhere = cursor
    ? sql`and (fi.created_at, fi.asset_id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
    : sql``
  return executeRows<FotoboxRow>(db, sql`
    select a.id as asset_id, fi.created_at as saved_at, a.who_is_in_picture, a.headline, a.caption, a.fotokey,
      c.name as category_name, e.name as event_name,
      card.width as card_width, card.height as card_height,
      thumb.width as thumb_width, thumb.height as thumb_height
    from asset_fotobox_items fi
    join image_assets a on a.id = fi.asset_id
    join image_derivatives card on card.image_asset_id = a.id and card.variant = 'CARD'
      and card.generation_status = 'READY' and card.is_watermarked = true
      and card.watermark_profile = ${CARD_LIGHT_PREVIEW_PROFILE}
    left join image_derivatives thumb on thumb.image_asset_id = a.id and thumb.variant = 'THUMB'
      and thumb.generation_status = 'READY' and thumb.is_watermarked = true
      and thumb.watermark_profile = ${THUMB_LIGHT_PREVIEW_PROFILE}
    left join asset_categories c on c.id = a.category_id
    left join photo_events e on e.id = a.event_id
    where fi.user_id = ${userId}::uuid ${boardFilter}
      and a.status = 'ACTIVE' and a.visibility = 'PUBLIC' and a.media_type = 'IMAGE'
      and a.original_exists_in_storage = true
      ${cursorWhere}
    order by fi.created_at desc, fi.asset_id desc
    limit ${limit}
  `)
}

async function toFotoboxItem(row: FotoboxRow, env: Env) {
  return {
    assetId: row.asset_id,
    savedAt: toIso(row.saved_at),
    headline: row.headline,
    whoIsInPicture: row.who_is_in_picture,
    caption: row.caption,
    fotokey: row.fotokey,
    category: row.category_name,
    event: row.event_name,
    previewUrl: await previewUrl(row.asset_id, row.card_width, row.card_height, "card", env),
    thumbUrl: await previewUrl(row.asset_id, row.thumb_width, row.thumb_height, "thumb", env),
  }
}

async function previewUrl(assetId: string, width: number | null, height: number | null, variant: "thumb" | "card", env: Env) {
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
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
}

function normalizeRequired(value: string | null | undefined, code: string) {
  const normalized = value?.trim()
  if (!normalized) throw new AppError(400, code, "Required value is missing.")
  return normalized
}

function parseLimit(value: string | null, fallback: number, max: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new AppError(400, "INVALID_LIMIT", `Limit must be between 1 and ${max}.`)
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
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[]
  return []
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
