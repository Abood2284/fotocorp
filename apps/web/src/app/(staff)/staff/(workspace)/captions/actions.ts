"use server"

import { revalidatePath } from "next/cache"
import { updateAdminAsset } from "@/lib/api/admin-catalog-api"

export async function updateCaptionDataAction(assetId: string, formData: FormData) {
  try {
    const payload = {
      headline: formData.get("headline")?.toString().trim() || null,
      caption: formData.get("caption")?.toString().trim() || null,
      description: undefined as any, // Ignored in our UI but required by type to explicitly be null or string
      keywords: formData.get("keywords")?.toString().split(",").map(k => k.trim()).filter(Boolean) || null,
      categoryId: formData.get("categoryId")?.toString() || null,
      eventId: formData.get("eventId")?.toString() || null,
      contributorId: undefined as any // We're not letting them change contributor here right now
    }

    const response = await updateAdminAsset(assetId, payload)
    
    revalidatePath("/staff/captions")
    
    return { success: true, asset: response.asset }
  } catch (error: any) {
    return { error: error.message || "Failed to update asset data" }
  }
}
