import type { AdminCatalogAssetItem } from "@/features/assets/admin-catalog-types"

export function getStaffCatalogPreviewVariant(
  asset: AdminCatalogAssetItem,
): "thumb" | "card" | "detail" | null {
  if (!asset.readyPreviewVariants?.length) return null
  if (asset.readyPreviewVariants.includes("card")) return "card"
  if (asset.readyPreviewVariants.includes("detail")) return "detail"
  if (asset.readyPreviewVariants.includes("thumb")) return "thumb"
  return null
}

export function getStaffCatalogPreviewUrl(asset: AdminCatalogAssetItem): string | null {
  const variant = getStaffCatalogPreviewVariant(asset)
  if (!variant) return null
  const version = asset.updatedAt ?? asset.id
  return `/staff/catalog/${asset.id}/preview-image?variant=${variant}&v=${encodeURIComponent(version)}`
}
