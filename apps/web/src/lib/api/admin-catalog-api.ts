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
