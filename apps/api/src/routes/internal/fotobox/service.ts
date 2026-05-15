import { sql, type SQL } from "drizzle-orm"
import type { Env } from "../../../appTypes"
import { createHttpDb, type DrizzleClient } from "../../../db"
import { AppError } from "../../../lib/errors"
import { createPreviewUrl } from "../../../lib/media/preview-token"
import { CARD_CLEAN_PROFILE, THUMB_CLEAN_PROFILE } from "../../../lib/media/watermark"
import { parsePreviewTtl } from "../../../lib/assets/public-assets"

interface ListFotoboxInput { authUserId: string; limit?: string; cursor?: string }
interface AddFotoboxInput { authUserId: string; assetId: string }
interface RemoveFotoboxInput { authUserId: string }
interface ProfileRow { id: string; status: string }
interface FotoboxRow { asset_id: string; saved_at: Date | string; title: string | null; headline: string | null; caption: string | null; legacy_imagecode: string | null; category_name: string | null; event_name: string | null; card_width: number | null; card_height: number | null; thumb_width: number | null; thumb_height: number | null }
interface CursorPayload { at: string; id: string }

export async function listFotoboxService(env: Env, input: ListFotoboxInput): Promise<Response> {
  const db = dbFor(env)
  const authUserId = normalizeRequired(input.authUserId, "AUTH_USER_REQUIRED")
  await requireActiveProfile(db, authUserId)
  const limit = parseLimit(input.limit ?? null, 24, 48)
  const cursor = parseCursor(input.cursor ?? null)
  const rows = await listFotoboxRows(db, authUserId, limit + 1, cursor)
  const pageRows = rows.slice(0, limit)
  return safeJson({
    ok: true,
    items: await Promise.all(pageRows.map((row) => toFotoboxItem(row, env))),
    nextCursor: rows.length > limit && pageRows.at(-1) ? encodeCursor(pageRows.at(-1)!.saved_at, pageRows.at(-1)!.asset_id) : null,
  })
}

export async function addFotoboxService(env: Env, input: AddFotoboxInput): Promise<Response> {
  const db = dbFor(env)
  const profile = await requireActiveProfile(db, input.authUserId)
  await assertSaveableAsset(db, input.assetId)
  const inserted = await executeRows<{ created_at: Date | string }>(db, sql`
    insert into asset_fotobox_items (auth_user_id, app_user_profile_id, asset_id)
    values (${input.authUserId}, ${profile.id}, ${input.assetId}::uuid)
    on conflict (auth_user_id, asset_id) do nothing
    returning created_at
  `)
  const createdAt = inserted[0]?.created_at ?? await findSavedAt(db, input.authUserId, input.assetId)
  return safeJson({ ok: true, alreadySaved: inserted.length === 0, item: { assetId: input.assetId, createdAt: toIso(createdAt) } })
}

export async function removeFotoboxService(env: Env, assetId: string, input: RemoveFotoboxInput): Promise<Response> {
  const db = dbFor(env)
  await requireActiveProfile(db, input.authUserId)
  await db.execute(sql`delete from asset_fotobox_items where auth_user_id = ${input.authUserId} and asset_id = ${assetId}::uuid`)
  return safeJson({ ok: true })
}

async function requireActiveProfile(db: DrizzleClient, authUserId: string): Promise<ProfileRow> { const rows = await executeRows<ProfileRow>(db, sql`select id, status from app_user_profiles where auth_user_id = ${authUserId} limit 1`); const profile = rows[0]; if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile was not found."); if (profile.status !== "ACTIVE") throw new AppError(403, "PROFILE_NOT_ACTIVE", "Profile is not active."); return profile }
async function assertSaveableAsset(db: DrizzleClient, assetId: string): Promise<void> { const rows = await executeRows<{ id: string }>(db, sql`select id from image_assets where id = ${assetId}::uuid and status = 'ACTIVE' and visibility = 'PUBLIC' and media_type = 'IMAGE' and original_exists_in_storage = true limit 1`); if (!rows[0]) throw new AppError(404, "ASSET_NOT_SAVEABLE", "Asset is not available for Fotobox.") }
async function findSavedAt(db: DrizzleClient, authUserId: string, assetId: string) { const rows = await executeRows<{ created_at: Date | string }>(db, sql`select created_at from asset_fotobox_items where auth_user_id = ${authUserId} and asset_id = ${assetId}::uuid limit 1`); return rows[0]?.created_at ?? new Date() }
async function listFotoboxRows(db: DrizzleClient, authUserId: string, limit: number, cursor: CursorPayload | null): Promise<FotoboxRow[]> { const cursorWhere = cursor ? sql`and (fi.created_at, fi.asset_id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)` : sql``; return executeRows<FotoboxRow>(db, sql`select a.id as asset_id,fi.created_at as saved_at,a.title,a.headline,a.caption,a.legacy_image_code as legacy_imagecode,c.name as category_name,e.name as event_name,card.width as card_width,card.height as card_height,thumb.width as thumb_width,thumb.height as thumb_height from asset_fotobox_items fi join image_assets a on a.id = fi.asset_id join image_derivatives card on card.image_asset_id = a.id and card.variant = 'CARD' and card.generation_status = 'READY' and card.is_watermarked = false and card.watermark_profile = ${CARD_CLEAN_PROFILE} left join image_derivatives thumb on thumb.image_asset_id = a.id and thumb.variant = 'THUMB' and thumb.generation_status = 'READY' and thumb.is_watermarked = false and thumb.watermark_profile = ${THUMB_CLEAN_PROFILE} left join asset_categories c on c.id = a.category_id left join photo_events e on e.id = a.event_id where fi.auth_user_id = ${authUserId} and a.status = 'ACTIVE' and a.visibility = 'PUBLIC' and a.media_type = 'IMAGE' and a.original_exists_in_storage = true ${cursorWhere} order by fi.created_at desc, fi.asset_id desc limit ${limit}`) }
async function toFotoboxItem(row: FotoboxRow, env: Env) { return { assetId: row.asset_id, savedAt: toIso(row.saved_at), headline: row.headline, title: row.title, caption: row.caption, fotokey: row.legacy_imagecode, category: row.category_name, event: row.event_name, previewUrl: await previewUrl(row.asset_id, row.card_width, row.card_height, "card", env), thumbUrl: await previewUrl(row.asset_id, row.thumb_width, row.thumb_height, "thumb", env) } }
async function previewUrl(assetId: string, width: number | null, height: number | null, variant: "thumb" | "card", env: Env) { if (!width || !height) return null; return { url: await createPreviewUrl(assetId, variant, env.MEDIA_PREVIEW_TOKEN_SECRET, parsePreviewTtl(env.MEDIA_PREVIEW_TOKEN_TTL_SECONDS)), width, height } }
function dbFor(env: Env) { if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured."); return createHttpDb(env.DATABASE_URL) }
function safeJson(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }) }
function normalizeRequired(value: string | null | undefined, code: string) { const normalized = value?.trim(); if (!normalized) throw new AppError(400, code, "Required value is missing."); return normalized }
function parseLimit(value: string | null, fallback: number, max: number) { if (!value) return fallback; const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new AppError(400, "INVALID_LIMIT", `Limit must be between 1 and ${max}.`); return parsed }
function parseCursor(value: string | null): CursorPayload | null { if (!value) return null; try { const parsed = JSON.parse(atob(value)) as CursorPayload; if (!parsed.at || !parsed.id || !isUuid(parsed.id)) throw new Error("invalid"); return parsed } catch { throw new AppError(400, "INVALID_CURSOR", "Cursor is invalid.") } }
function encodeCursor(at: Date | string, id: string) { return btoa(JSON.stringify({ at: toIso(at), id })) }
function toIso(value: Date | string | null | undefined) { if (!value) return null; return value instanceof Date ? value.toISOString() : new Date(value).toISOString() }
async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> { const result = await db.execute(query); if (Array.isArray(result)) return result as T[]; if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[]; return [] }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) }
