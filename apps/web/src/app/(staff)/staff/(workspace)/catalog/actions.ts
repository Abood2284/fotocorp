"use server"

import { revalidatePath } from "next/cache"
import {
  getAdminAsset,
  updateAdminAssetEditorial,
  updateAdminAssetState,
  updateAdminAssetEditorialBulk,
  updateAdminAssetStateBulk,
} from "@/lib/api/admin-assets-api"
import type {
  AdminCatalogEditorialUpdateInput,
  AdminCatalogPublishUpdateInput,
} from "@/features/assets/admin-catalog-types"

export async function fetchAdminAssetAction(assetId: string) {
  return getAdminAsset(assetId)
}

export async function updateAdminAssetEditorialAction(assetId: string, payload: AdminCatalogEditorialUpdateInput) {
  const result = await updateAdminAssetEditorial(assetId, payload)
  revalidatePath("/staff/catalog")
  return result
}

export async function updateAdminAssetStateAction(assetId: string, payload: AdminCatalogPublishUpdateInput) {
  const result = await updateAdminAssetState(assetId, payload)
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
