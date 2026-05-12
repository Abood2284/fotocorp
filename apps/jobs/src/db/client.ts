/**
 * Tiny Node-native Postgres client for the jobs CLI.
 *
 * Mirrors the pattern used by `apps/api/scripts/media/process-image-publish-jobs.ts`
 * (native `pg.Pool`) so that we share the same SQL surface for `image_publish_jobs` /
 * `image_publish_job_items` without pulling Worker-only `@neondatabase/serverless`
 * code into `apps/jobs`.
 *
 * The pool is lazily created the first time `getJobsPool()` is called with a database
 * URL, then reused for the lifetime of the process. Callers must invoke
 * `closeJobsPool()` once before exit so Node can settle background work cleanly.
 */
import pg from "pg"
import type { Pool, PoolClient, QueryResultRow } from "pg"

let pool: Pool | undefined

export function getJobsPool(databaseUrl: string): Pool {
  if (pool) return pool
  if (!databaseUrl) throw new Error("[fotocorp-jobs] DATABASE_URL is required to connect to Postgres")

  const { Pool: PgPool } = pg
  pool = new PgPool({
    connectionString: databaseUrl,
    // Conservative defaults for a single-worker VPS container; the publish loop is
    // serial today, so we don't need a wide pool.
    max: 4,
    idleTimeoutMillis: 30_000
  })
  return pool
}

export async function closeJobsPool(): Promise<void> {
  if (!pool) return
  const closing = pool
  pool = undefined
  await closing.end()
}

/**
 * Run `handler` inside a single BEGIN/COMMIT (rollback on throw) using a dedicated
 * client. Required for `FOR UPDATE SKIP LOCKED` to hold the row lock for the duration
 * of the claim, and for keeping job + items in sync.
 */
export async function withJobsTransaction<T>(
  databaseUrl: string,
  handler: (client: PoolClient) => Promise<T>
): Promise<T> {
  const activePool = getJobsPool(databaseUrl)
  const client = await activePool.connect()
  try {
    await client.query("BEGIN")
    const result = await handler(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch (rollbackError) {
      const message =
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
      console.error(`[fotocorp-jobs] warn: ROLLBACK failed: ${message}`)
    }
    throw error
  } finally {
    client.release()
  }
}

export type { Pool, PoolClient, QueryResultRow }
