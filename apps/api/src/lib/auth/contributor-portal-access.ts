import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { AppError } from "../errors"

export async function assertContributorHasPortalCredential(db: DrizzleClient, contributorId: string) {
  const rows = await executeRows<{ id: string }>(
    db,
    sql`
      select id::text
      from auth_credentials
      where owner_type = 'CONTRIBUTOR'
        and owner_id = ${contributorId}::uuid
        and status = 'ACTIVE'
      limit 1
    `,
  )
  if (!rows[0]) {
    throw new AppError(
      400,
      "CONTRIBUTOR_CREDENTIAL_REQUIRED",
      "This contributor has no active portal login. Issue credentials before uploading on their behalf.",
    )
  }
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[]
  }
  return []
}
