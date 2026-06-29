"use server"

import { revalidatePath } from "next/cache"
import {
  getAdminAsset,
  getAdminAssetFilters,
  updateAdminAssetEditorial,
  updateAdminAssetState,
  updateAdminAssetEditorialBulk,
  updateAdminAssetStateBulk,
  deleteAdminAsset,
} from "@/lib/api/admin-assets-api"
import type {
  AdminCatalogAssetItem,
  AdminCatalogEditorialUpdateInput,
  AdminCatalogPublishUpdateInput,
} from "@/features/assets/admin-catalog-types"
import { listAllFilteredAdminCatalogAssets } from "@/lib/server/staff-catalog-list"

export async function fetchAdminAssetAction(assetId: string) {
  return getAdminAsset(assetId)
}

export async function fetchAdminAssetFiltersAction() {
  return getAdminAssetFilters()
}

export async function updateAdminAssetEditorialAction(assetId: string, payload: AdminCatalogEditorialUpdateInput) {
  const result = await updateAdminAssetEditorial(assetId, payload)
  return result
}

export async function updateAdminAssetStateAction(assetId: string, payload: AdminCatalogPublishUpdateInput) {
  const result = await updateAdminAssetState(assetId, payload)
  revalidatePath("/staff/catalog")
  return result
}

export async function deleteAdminAssetAction(assetId: string) {
  const result = await deleteAdminAsset(assetId)
  revalidatePath("/staff/catalog")
  return result
}

export async function updateAdminAssetEditorialBulkAction(payload: { assetIds: string[], categoryId?: string | null, eventId?: string | null }) {
  const result = await updateAdminAssetEditorialBulk(payload)
  revalidatePath("/staff/catalog")
  return result
}

export async function updateAdminAssetStateBulkAction(payload: { assetIds: string[], status: "APPROVED" | "REVIEW" | "REJECTED"; visibility: "PUBLIC" | "PRIVATE" }) {
  const result = await updateAdminAssetStateBulk(payload)
  revalidatePath("/staff/catalog")
  return result
}

export async function fetchAdminAssetsForEventBulkEditAction(eventId: string): Promise<AdminCatalogAssetItem[]> {
  const query = new URLSearchParams({ eventId, sort: "newest" })
  const result = await listAllFilteredAdminCatalogAssets(query)
  return result.items
}
