import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"

interface SummaryRow {
  total_assets: string
  approved_public_assets: string
  platform_users: string
  pending_user_access_inquiries: string
  pending_contributor_applications: string
}

export interface AdminDashboardSummary {
  totalAssets: number
  approvedPublicAssets: number
  platformUsers: number
  pendingUserAccessInquiries: number
  pendingContributorApplications: number
}

/** Fast aggregates for staff dashboard — no derivative joins. */
export async function getInternalAdminDashboardSummary(db: DrizzleClient): Promise<AdminDashboardSummary> {
  const rows = await executeRows<SummaryRow>(
    db,
    sql`
      select
        (select count(*)::bigint from image_assets) as total_assets,
        (select count(*)::bigint from image_assets where status = 'ACTIVE' and visibility = 'PUBLIC') as approved_public_assets,
        (select count(*)::bigint from users where status = 'ACTIVE') as platform_users,
        (select count(*)::bigint from customer_access_inquiries where inquiry_type = 'USER_ACCESS' and status = 'PENDING') as pending_user_access_inquiries,
        (select count(*)::bigint from customer_access_inquiries where inquiry_type = 'CONTRIBUTOR_APPLICATION' and status = 'PENDING') as pending_contributor_applications
    `,
  )

  const row = rows[0]
  return {
    totalAssets: Number(row?.total_assets ?? 0),
    approvedPublicAssets: Number(row?.approved_public_assets ?? 0),
    platformUsers: Number(row?.platform_users ?? 0),
    pendingUserAccessInquiries: Number(row?.pending_user_access_inquiries ?? 0),
    pendingContributorApplications: Number(row?.pending_contributor_applications ?? 0),
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
