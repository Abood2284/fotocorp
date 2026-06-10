import type { Env } from "../../../appTypes"
import { createHttpDb } from "../../../db"
import { AppError } from "../../../lib/errors"
import { requireActivePlatformUser } from "../../../lib/users/platform-user"

interface ListFotoboxInput { userId: string; limit?: string; cursor?: string; boardId?: string }
interface AddFotoboxInput { userId: string; assetId: string; boardId?: string }
interface RemoveFotoboxInput { userId: string; boardId?: string }

export async function listFotoboxService(env: Env, input: ListFotoboxInput): Promise<Response> {
  const db = dbFor(env)
  const userId = normalizeRequired(input.userId, "USER_ID_REQUIRED")
  await requireActivePlatformUser(db, userId)
  parseLimit(input.limit ?? null, 24, 48)
  parseCursor(input.cursor ?? null)
  return safeJson({ ok: true, items: [], nextCursor: null })
}

export async function addFotoboxService(env: Env, input: AddFotoboxInput): Promise<Response> {
  const db = dbFor(env)
  await requireActivePlatformUser(db, input.userId)
  throw new AppError(410, "FOTOBOX_ITEMS_RETIRED", "Fotobox saved-item storage has been retired.")
}

export async function removeFotoboxService(env: Env, assetId: string, input: RemoveFotoboxInput): Promise<Response> {
  const db = dbFor(env)
  await requireActivePlatformUser(db, input.userId)
  normalizeRequired(assetId, "ASSET_ID_REQUIRED")
  if (input.boardId) normalizeRequired(input.boardId, "BOARD_ID_REQUIRED")
  return safeJson({ ok: true })
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

function parseCursor(value: string | null): void {
  if (!value) return
  try {
    const parsed = JSON.parse(atob(value)) as { at?: string; id?: string }
    if (!parsed.at || !parsed.id || !isUuid(parsed.id)) throw new Error("invalid")
    return
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "Cursor is invalid.")
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
