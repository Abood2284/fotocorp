import "server-only"

import type {
  AdminCatalogAssetResponse,
  AdminCatalogAssetsResponse,
  AdminCatalogEditorialUpdateInput,
  AdminCatalogFilters,
  AdminCatalogPublishUpdateInput,
  AdminCatalogStats,
  AdminCatalogUserResponse,
  AdminCatalogUsersResponse,
} from "@/features/assets/admin-catalog-types"
import { getStaffInternalAdminActorHeaders } from "@/lib/staff-session"
import {
  InternalApiRequestError,
  internalApiFetch,
  internalApiJson,
  internalApiRoutes,
  withQuery,
} from "@/lib/server/internal-api"

export async function listAdminCatalogAssets(searchParams: URLSearchParams) {
  return adminJson<AdminCatalogAssetsResponse>({
    path: withQuery(internalApiRoutes.adminAssets(), searchParams),
  })
}

export async function getAdminCatalogAsset(assetId: string) {
  try {
    return await adminJson<AdminCatalogAssetResponse>({
      path: internalApiRoutes.adminAsset(assetId),
    })
  } catch (error) {
    if (error instanceof InternalApiRequestError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function getAdminCatalogStats() {
  return adminJson<AdminCatalogStats>({
    path: internalApiRoutes.adminCatalogStats(),
  })
}

export interface AdminMediaPipelineStatusResponse {
  watermarkProfile: string
  /** Expected `watermark_profile` strings per variant (thumb/card clean, detail watermarked). */
  derivativeProfiles: {
    thumbProfile: string
    cardProfile: string
    detailProfile: string
  }
  generatedAt: string
  totalImageAssets: number
  assetsWithOriginalStorageKey: number
  assetsWithR2ExistsTrue: number
  assetsWithR2ExistsFalse: number
  assetsWithR2ExistsNull: number
  assetsMissingOriginalOrR2Mapping: number
  derivativeByVariant: Record<string, { ready: number; failed: number; missing: number }>
  assetsReadyForPublicListing: number
  assetsCurrentlyVisibleInPublicApi: number
  assetsEligibleForPublicListing: number
  assetsVisibleThroughCurrentPublicApiConditions: number
  latestFailedDerivatives: Array<{
    assetId: string
    legacyImageCode: string | null
    variant: string
    generationStatus: string
    watermarkProfile: string | null
    updatedAt: string | null
    storageKeyMasked: string | null
    hasErrorData: boolean
  }>
}

export async function getAdminMediaPipelineStatus() {
  return adminJson<AdminMediaPipelineStatusResponse>({
    path: internalApiRoutes.adminMediaPipelineStatus(),
  })
}

export async function getAdminCatalogFilters() {
  return adminJson<AdminCatalogFilters>({
    path: internalApiRoutes.adminFilters(),
  })
}

export async function updateAdminAsset(assetId: string, payload: AdminCatalogEditorialUpdateInput) {
  return adminJson<AdminCatalogAssetResponse>({
    path: internalApiRoutes.adminAsset(assetId),
    method: "PATCH",
    body: payload,
  })
}

export async function updateAdminAssetPublishState(assetId: string, payload: AdminCatalogPublishUpdateInput) {
  return adminJson<AdminCatalogAssetResponse>({
    path: internalApiRoutes.adminAssetPublishState(assetId),
    method: "POST",
    body: payload,
  })
}

export async function updateAdminAssetBulk(payload: { assetIds: string[], categoryId?: string | null, eventId?: string | null }) {
  return adminJson<AdminCatalogAssetsResponse>({
    path: "/api/v1/internal/admin/assets/bulk/editorial",
    method: "PATCH",
    body: payload,
  })
}

export async function updateAdminAssetPublishStateBulk(payload: { assetIds: string[], status: "APPROVED" | "REVIEW" | "REJECTED"; visibility: "PUBLIC" | "PRIVATE" }) {
  return adminJson<AdminCatalogAssetsResponse>({
    path: "/api/v1/internal/admin/assets/bulk/publish-state",
    method: "POST",
    body: payload,
  })
}

export async function fetchAdminAssetOriginal(assetId: string) {
  return adminFetch({
    path: internalApiRoutes.adminAssetOriginal(assetId),
  })
}

export async function fetchAdminAssetPreview(assetId: string, variant: "thumb" | "card" | "detail") {
  const params = new URLSearchParams({ variant })
  return adminFetch({
    path: withQuery(internalApiRoutes.adminAssetPreview(assetId), params),
  })
}

export async function listAdminUsers(searchParams: URLSearchParams) {
  return adminJson<AdminCatalogUsersResponse>({
    path: withQuery(internalApiRoutes.adminUsers(), searchParams),
  })
}

export async function updateAdminUserSubscription(authUserId: string, payload: { isSubscriber: boolean }) {
  return adminJson<AdminCatalogUserResponse>({
    path: internalApiRoutes.adminUserSubscription(authUserId),
    method: "PATCH",
    body: payload,
  })
}

async function adminJson<T>(input: {
  path: string
  method?: "GET" | "PATCH" | "POST"
  body?: unknown
}): Promise<T> {
  return internalApiJson<T>({
    ...input,
    headers: await adminActorHeaders(),
  })
}

async function adminFetch(input: {
  path: string
  method?: "GET" | "PATCH" | "POST"
  body?: unknown
}) {
  return internalApiFetch({
    ...input,
    headers: await adminActorHeaders(),
  })
}

async function adminActorHeaders(): Promise<HeadersInit> {
  return getStaffInternalAdminActorHeaders()
}
