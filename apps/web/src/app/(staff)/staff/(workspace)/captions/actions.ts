"use server"

import { revalidatePath } from "next/cache"
import { getAdminCatalogAsset, updateAdminAsset } from "@/lib/api/admin-catalog-api"
import type { AdminCatalogEditorialUpdateInput } from "@/features/assets/admin-catalog-types"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"
import { getOptionalStaffSession } from "@/lib/staff-session"

function parseNullableString(value: FormDataEntryValue | null): string | null {
  const raw = value?.toString().trim()
  return raw ? raw : null
}

function parseKeywords(value: FormDataEntryValue | null): string[] | null {
  const raw = value?.toString().trim()
  if (!raw) return null
  const list = raw.split(",").map((keyword) => keyword.trim()).filter(Boolean)
  return list.length ? list : null
}

export async function updateCaptionDataAction(assetId: string, formData: FormData) {
  const staffSession = await getOptionalStaffSession()
  if (!staffSession || !staffRoleCanAccessPath(staffSession.staff.role, "/staff/captions")) {
    return { error: "You do not have permission to edit captions." }
  }

  try {
    const existing = await getAdminCatalogAsset(assetId)
    const lockedEventId = existing?.asset.event?.id ?? null
    const lockedEventTitle = existing?.asset.event?.name?.trim() || null

    const payload: AdminCatalogEditorialUpdateInput = {
      whoIsInPicture: parseNullableString(formData.get("whoIsInPicture")),
      headline: lockedEventTitle ?? parseNullableString(formData.get("headline")),
      caption: parseNullableString(formData.get("caption")),
      description: parseNullableString(formData.get("description")),
      keywords: parseKeywords(formData.get("keywords")),
      categoryId: parseNullableString(formData.get("categoryId")),
      eventId: lockedEventId ?? parseNullableString(formData.get("eventId")),
      contributorId: parseNullableString(formData.get("contributorId")),
    }

    const response = await updateAdminAsset(assetId, payload)

    revalidatePath("/staff/captions")

    return { success: true, asset: response.asset }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update asset data"
    return { error: message }
  }
}
