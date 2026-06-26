import "server-only"

import { cache } from "react"
import { unstable_cache } from "next/cache"
import { internalApiJson, internalApiRoutes } from "@/lib/server/internal-api"

export interface AdminDashboardSummary {
  liveImages: number
  activeSubscribers: number
  pendingUserAccessInquiries: number
  pendingContributorApplications: number
  pendingContributorUploads: number
  pendingCaricatureReviews: number
}

/** Global aggregates — no per-staff inputs; safe inside unstable_cache (no cookies/headers). */
async function fetchAdminDashboardSummaryUncached(): Promise<AdminDashboardSummary> {
  return internalApiJson<AdminDashboardSummary>({
    path: internalApiRoutes.adminDashboardSummary(),
  })
}

const getCrossRequestDashboardSummary = unstable_cache(
  fetchAdminDashboardSummaryUncached,
  ["staff-dashboard-summary-v2"],
  { revalidate: 120, tags: ["staff-dashboard-summary"] },
)

/** Per-request dedupe + ~2 min cross-request cache. */
export const getAdminDashboardSummary = cache(getCrossRequestDashboardSummary)
