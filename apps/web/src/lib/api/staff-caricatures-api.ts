import "server-only"

import { getStaffInternalAdminActorHeaders } from "@/lib/staff-session"
import { internalApiJson, internalApiRoutes, withQuery } from "@/lib/server/internal-api"

export interface StaffCaricatureListItem {
  id: string
  headline: string
  credit: string
  categoryId: string
  categoryName: string
  language: string
  status: string
  hasVisibleText: boolean
  hasOriginalFile: boolean
  publishedAt: string
  createdAt: string
  updatedAt: string
}

export interface StaffCaricatureListResponse {
  items: StaffCaricatureListItem[]
  total: number
  page: number
  limit: number
}

export interface StaffCaricatureDetail extends StaffCaricatureListItem {
  description: string
  languageOther: string | null
  visibleText: string | null
  visibleTextTranslationEn: string | null
  keywords: string[]
  depictedSubjects: string[]
  visibility: string
  hasReadyPreviewDerivatives: boolean
  previewGenerationStatus: string
}

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
