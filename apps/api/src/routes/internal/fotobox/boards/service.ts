import { sql, type SQL } from "drizzle-orm"
import type { Env } from "../../../../appTypes"
import { createHttpDb, type DrizzleClient } from "../../../../db"
import { AppError } from "../../../../lib/errors"
async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[]
  return []
}

interface FotoboxBoard { id: string; name: string; itemCount: number; sortOrder: number; createdAt: string }

export async function listBoardsService(env: Env, userId: string): Promise<Response> {
  const db = dbFor(env)
  const rows = await executeRows<FotoboxBoard>(db, sql`
    SELECT
      b.id,
      b.name,
      b.sort_order AS "sortOrder",
      b.created_at AS "createdAt",
      0::int AS "itemCount"
    FROM fotobox_boards b
    WHERE b.user_id = ${userId}::uuid
    ORDER BY b.sort_order, b.created_at
  `)
  return safeJson({ ok: true, boards: rows })
}

export async function createBoardService(env: Env, userId: string, name: string): Promise<Response> {
  const db = dbFor(env)
  const rows = await executeRows<FotoboxBoard>(db, sql`
    INSERT INTO fotobox_boards (user_id, name)
    VALUES (${userId}::uuid, ${name})
    RETURNING id, name, sort_order AS "sortOrder", created_at AS "createdAt"
  `)
  const board = rows[0]
  if (!board) throw new AppError(500, "BOARD_CREATE_FAILED", "Failed to create board.")
  return safeJson({ ok: true, board: { ...board, itemCount: 0 } })
}

export async function renameBoardService(env: Env, boardId: string, userId: string, name: string): Promise<Response> {
  const db = dbFor(env)
  await assertBoardOwnership(db, boardId, userId)
  await db.execute(sql`
    UPDATE fotobox_boards SET name = ${name}, updated_at = now() WHERE id = ${boardId}::uuid
  `)
  return safeJson({ ok: true })
}

export async function deleteBoardService(env: Env, boardId: string, userId: string): Promise<Response> {
  const db = dbFor(env)
  await assertBoardOwnership(db, boardId, userId)
  await db.execute(sql`DELETE FROM fotobox_boards WHERE id = ${boardId}::uuid`)
  return safeJson({ ok: true })
}

export async function migrateAnonService(env: Env, input: { userId: string; boards: Array<{ name: string; items: string[] }> }): Promise<Response> {
  const db = dbFor(env)

  for (const board of input.boards) {
    await executeRows<{ id: string }>(db, sql`
      INSERT INTO fotobox_boards (user_id, name)
      VALUES (${input.userId}::uuid, ${board.name})
      RETURNING id
    `)
  }

  return safeJson({ ok: true, migrated: input.boards.length, totalItems: 0 })
}

export async function getAssetBoardIdsService(env: Env, userId: string, assetId: string): Promise<Response> {
  normalizeRequired(userId, "USER_ID_REQUIRED")
  normalizeRequired(assetId, "ASSET_ID_REQUIRED")
  return safeJson({ ok: true, boardIds: [] })
}

export async function getAnonAssetBoardIds(assetId: string): Promise<string[]> {
  // This is for the client side — handles anonymous users
  // But since this is a server-only endpoint, we use the pattern differently
  throw new AppError(500, "NOT_IMPL", "Use client-side anon store")
}

async function assertBoardOwnership(db: DrizzleClient, boardId: string, userId: string): Promise<void> {
  const rows = await executeRows<{ id: string }>(db, sql`
    SELECT id FROM fotobox_boards WHERE id = ${boardId}::uuid AND user_id = ${userId}::uuid LIMIT 1
  `)
  if (!rows[0]) throw new AppError(404, "BOARD_NOT_FOUND", "Board not found or does not belong to this user.")
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
