import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"

interface SummaryRow {
  live_images: string
  active_subscribers: string
  pending_user_access_inquiries: string
  pending_contributor_applications: string
  pending_contributor_uploads: string
  pending_caricature_reviews: string
}

export interface AdminDashboardSummary {
  liveImages: number
  activeSubscribers: number
  pendingUserAccessInquiries: number
  pendingContributorApplications: number
  pendingContributorUploads: number
  pendingCaricatureReviews: number
}

/** Fast aggregates for staff dashboard — no derivative joins. */
export async function getInternalAdminDashboardSummary(db: DrizzleClient): Promise<AdminDashboardSummary> {
  const rows = await executeRows<SummaryRow>(
    db,
    sql`
      select
        (select count(*)::bigint from image_assets where status = 'ACTIVE' and visibility = 'PUBLIC') as live_images,
        (select count(*)::bigint from users where status = 'ACTIVE') as active_subscribers,
        (select count(*)::bigint from customer_access_inquiries where inquiry_type = 'USER_ACCESS' and status = 'PENDING') as pending_user_access_inquiries,
        (select count(*)::bigint from customer_access_inquiries where inquiry_type = 'CONTRIBUTOR_APPLICATION' and status = 'PENDING') as pending_contributor_applications,
        (select count(*)::bigint from image_assets where status = 'SUBMITTED') as pending_contributor_uploads,
        (select count(*)::bigint from caricature_assets where status = 'PENDING_REVIEW') as pending_caricature_reviews
    `,
  )

  const row = rows[0]
  return {
    liveImages: Number(row?.live_images ?? 0),
    activeSubscribers: Number(row?.active_subscribers ?? 0),
    pendingUserAccessInquiries: Number(row?.pending_user_access_inquiries ?? 0),
    pendingContributorApplications: Number(row?.pending_contributor_applications ?? 0),
    pendingContributorUploads: Number(row?.pending_contributor_uploads ?? 0),
    pendingCaricatureReviews: Number(row?.pending_caricature_reviews ?? 0),
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
