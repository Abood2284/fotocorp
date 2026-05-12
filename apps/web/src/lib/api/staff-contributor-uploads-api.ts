import "server-only"

import { getStaffInternalAdminActorHeaders } from "@/lib/staff-session"
import {
  internalApiFetch,
  internalApiJson,
  internalApiRoutes,
  withQuery,
} from "@/lib/server/internal-api"

export type StaffContributorUploadStatusFilter = "SUBMITTED" | "APPROVED" | "ACTIVE" | "all"

export interface StaffContributorUploadDto {
  imageAssetId: string
  uploadItemId: string
  batchId: string
  originalFileName: string
  mimeType: string | null
  sizeBytes: number | null
  status: string
  visibility: string
  source: string
  assetType: string | null
  fotokey: string | null
  contributor: {
    id: string
    legacyPhotographerId: number | null
    displayName: string
  }
  event: {
    id: string
    name: string
    eventDate: string | null
    city: string | null
    location: string | null
  } | null
  batch: {
    id: string
    status: string
    submittedAt: string | null
  }
  createdAt: string
  updatedAt: string
  canApprove: boolean
}

export interface StaffContributorUploadsListResponse {
  ok: true
  uploads: StaffContributorUploadDto[]
  pagination: { limit: number; offset: number; total: number }
}

export interface StaffContributorUploadsApproveResponse {
  ok: true
  approvedCount: number
  publishJobId: string | null
  items: Array<{ imageAssetId: string; fotokey: string; status: "APPROVED" }>
  skipped: Array<{ imageAssetId: string; reason: string }>
}

export interface StaffContributorUploadsListParams {
  status?: StaffContributorUploadStatusFilter
  assetType?: "IMAGE" | "VIDEO" | "CARICATURE" | "all"
  eventId?: string
  contributorId?: string
  batchId?: string
  q?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export async function listStaffContributorUploads(params: StaffContributorUploadsListParams = {}) {
  const search = new URLSearchParams()
  if (params.status) search.set("status", params.status)
  if (params.assetType && params.assetType !== "all") search.set("assetType", params.assetType)
  if (params.eventId) search.set("eventId", params.eventId)
  if (params.contributorId) search.set("contributorId", params.contributorId)
  if (params.batchId) search.set("batchId", params.batchId)
  if (params.q) search.set("q", params.q)
  if (params.from) search.set("from", params.from)
  if (params.to) search.set("to", params.to)
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.offset !== undefined) search.set("offset", String(params.offset))

  return internalApiJson<StaffContributorUploadsListResponse>({
    path: withQuery(internalApiRoutes.adminContributorUploads(), search),
    headers: await staffActorHeaders(),
  })
}

export async function approveStaffContributorUploads(imageAssetIds: string[]) {
  return internalApiJson<StaffContributorUploadsApproveResponse>({
    path: internalApiRoutes.adminContributorUploadsApprove(),
    method: "POST",
    body: { imageAssetIds },
    headers: await staffActorHeaders(),
  })
}

export async function fetchStaffContributorUploadOriginal(imageAssetId: string) {
  return internalApiFetch({
    path: internalApiRoutes.adminContributorUploadOriginal(imageAssetId),
    headers: await staffActorHeaders(),
  })
}

export function getStaffContributorOriginalUrl(imageAssetId: string) {
  return `/staff/contributor-uploads/${encodeURIComponent(imageAssetId)}/original`
}

export interface StaffContributorUploadBatchDetailResponse {
  ok: true
  batch: {
    id: string
    status: string
    assetType: string
    submittedAt: string | null
    createdAt: string
  }
  contributor: {
    id: string
    displayName: string
  } | null
  event: {
    id: string
    name: string
  } | null
  items: StaffContributorUploadDto[]
}

export async function getStaffContributorUploadBatch(batchId: string) {
  return internalApiJson<StaffContributorUploadBatchDetailResponse>({
    path: internalApiRoutes.adminContributorUploadBatchDetail(batchId),
    headers: await staffActorHeaders(),
  })
}

async function staffActorHeaders(): Promise<HeadersInit> {
  return getStaffInternalAdminActorHeaders()
}
