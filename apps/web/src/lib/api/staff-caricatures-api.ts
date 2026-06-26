import "server-only"

import { getStaffInternalAdminActorHeaders } from "@/lib/staff-session"
import type {
  StaffCaricatureDetail,
  StaffCaricatureListResponse,
} from "@/lib/api/staff-caricatures-types"
import { internalApiJson, internalApiRoutes, withQuery } from "@/lib/server/internal-api"

export type {
  StaffCaricatureDetail,
  StaffCaricatureListItem,
  StaffCaricatureListResponse,
} from "@/lib/api/staff-caricatures-types"

export async function listStaffCaricatures(params: {
  q?: string
  status?: string
  categoryId?: string
  page?: number
  limit?: number
}): Promise<StaffCaricatureListResponse> {
  const query = new URLSearchParams()
  if (params.q) query.set("q", params.q)
  if (params.status) query.set("status", params.status)
  if (params.categoryId) query.set("categoryId", params.categoryId)
  query.set("page", String(params.page ?? 1))
  query.set("limit", String(params.limit ?? 50))

  return internalApiJson<StaffCaricatureListResponse>({
    path: withQuery(internalApiRoutes.adminCaricatureAssets(), query),
    headers: await getStaffInternalAdminActorHeaders(),
  })
}

export async function getStaffCaricatureDetail(assetId: string): Promise<StaffCaricatureDetail> {
  return internalApiJson<StaffCaricatureDetail>({
    path: internalApiRoutes.adminCaricatureAsset(assetId),
    headers: await getStaffInternalAdminActorHeaders(),
  })
}

export async function approveStaffCaricature(assetId: string) {
  return internalApiJson<{ ok: true; assetId: string; jobId: string; message: string }>({
    path: internalApiRoutes.adminCaricatureApprove(assetId),
    method: "POST",
    headers: await getStaffInternalAdminActorHeaders(),
  })
}

export async function rejectStaffCaricature(assetId: string) {
  return internalApiJson<{ ok: true; assetId: string }>({
    path: internalApiRoutes.adminCaricatureReject(assetId),
    method: "POST",
    headers: await getStaffInternalAdminActorHeaders(),
  })
}
