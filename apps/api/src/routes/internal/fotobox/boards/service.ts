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

export async function listBoardsService(env: Env, authUserId: string): Promise<Response> {
  const db = dbFor(env)
  const rows = await executeRows<FotoboxBoard>(db, sql`
    SELECT
      b.id,
      b.name,
      b.sort_order AS "sortOrder",
      b.created_at AS "createdAt",
      COUNT(fi.id)::int AS "itemCount"
    FROM fotobox_boards b
    LEFT JOIN asset_fotobox_items fi ON fi.board_id = b.id
    WHERE b.auth_user_id = ${authUserId}
    GROUP BY b.id, b.name, b.sort_order, b.created_at
    ORDER BY b.sort_order, b.created_at
  `)
  return safeJson({ ok: true, boards: rows })
}

export async function createBoardService(env: Env, authUserId: string, name: string): Promise<Response> {
  const db = dbFor(env)
  const rows = await executeRows<FotoboxBoard>(db, sql`
    INSERT INTO fotobox_boards (auth_user_id, name)
    VALUES (${authUserId}, ${name})
    RETURNING id, name, sort_order AS "sortOrder", created_at AS "createdAt"
  `)
  const board = rows[0]
  if (!board) throw new AppError(500, "BOARD_CREATE_FAILED", "Failed to create board.")
  return safeJson({ ok: true, board: { ...board, itemCount: 0 } })
}

export async function renameBoardService(env: Env, boardId: string, authUserId: string, name: string): Promise<Response> {
  const db = dbFor(env)
  await assertBoardOwnership(db, boardId, authUserId)
  await db.execute(sql`
    UPDATE fotobox_boards SET name = ${name}, updated_at = now() WHERE id = ${boardId}::uuid
  `)
  return safeJson({ ok: true })
}

export async function deleteBoardService(env: Env, boardId: string, authUserId: string): Promise<Response> {
  const db = dbFor(env)
  await assertBoardOwnership(db, boardId, authUserId)
  await db.execute(sql`DELETE FROM fotobox_boards WHERE id = ${boardId}::uuid`)
  return safeJson({ ok: true })
}

export async function migrateAnonService(env: Env, input: { authUserId: string; appUserProfileId: string; boards: Array<{ name: string; items: string[] }> }): Promise<Response> {
  const db = dbFor(env)
  let totalItems = 0

  for (const board of input.boards) {
    const boardRows = await executeRows<{ id: string }>(db, sql`
      INSERT INTO fotobox_boards (auth_user_id, app_user_profile_id, name)
      VALUES (${input.authUserId}, ${input.appUserProfileId}, ${board.name})
      RETURNING id
    `)
    const boardId = boardRows[0]?.id
    if (!boardId) continue

    for (const assetId of board.items) {
      const isValid = await executeRows<{ exists: boolean }>(db, sql`
        SELECT EXISTS(
          SELECT 1 FROM image_assets
          WHERE id = ${assetId}::uuid
            AND status = 'ACTIVE'
            AND visibility = 'PUBLIC'
            AND media_type = 'IMAGE'
            AND original_exists_in_storage = true
        ) AS "exists"
      `)
      if (!isValid[0]?.exists) continue
      await db.execute(sql`
        INSERT INTO asset_fotobox_items (auth_user_id, app_user_profile_id, board_id, asset_id)
        VALUES (${input.authUserId}, ${input.appUserProfileId}, ${boardId}::uuid, ${assetId}::uuid)
        ON CONFLICT (board_id, asset_id) DO NOTHING
      `)
      totalItems++
    }
  }

  return safeJson({ ok: true, migrated: input.boards.length, totalItems })
}

export async function getAssetBoardIdsService(env: Env, authUserId: string, assetId: string): Promise<Response> {
  const db = dbFor(env)
  const rows = await executeRows<{ board_id: string }>(db, sql`
    SELECT board_id FROM asset_fotobox_items
    WHERE auth_user_id = ${authUserId} AND asset_id = ${assetId}::uuid
  `)
  return safeJson({ ok: true, boardIds: rows.map((r) => r.board_id) })
}

export async function getAnonAssetBoardIds(assetId: string): Promise<string[]> {
  // This is for the client side — handles anonymous users
  // But since this is a server-only endpoint, we use the pattern differently
  throw new AppError(500, "NOT_IMPL", "Use client-side anon store")
}

async function assertBoardOwnership(db: DrizzleClient, boardId: string, authUserId: string): Promise<void> {
  const rows = await executeRows<{ id: string }>(db, sql`
    SELECT id FROM fotobox_boards WHERE id = ${boardId}::uuid AND auth_user_id = ${authUserId} LIMIT 1
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
