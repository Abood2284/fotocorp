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
  return buildStaffCatalogPreviewUrl(asset.id, variant, asset.updatedAt ?? asset.id)
}

export function getStaffCatalogHoverPreviewVariant(
  asset: AdminCatalogAssetItem,
): "thumb" | "card" | "detail" | null {
  if (!asset.readyPreviewVariants?.length) return null
  if (asset.readyPreviewVariants.includes("detail")) return "detail"
  if (asset.readyPreviewVariants.includes("card")) return "card"
  if (asset.readyPreviewVariants.includes("thumb")) return "thumb"
  return null
}

export function getStaffCatalogHoverPreviewUrl(asset: AdminCatalogAssetItem): string | null {
  const variant = getStaffCatalogHoverPreviewVariant(asset)
  if (!variant) return null
  return buildStaffCatalogPreviewUrl(asset.id, variant, asset.updatedAt ?? asset.id)
}

function buildStaffCatalogPreviewUrl(
  assetId: string,
  variant: "thumb" | "card" | "detail",
  version: string,
) {
  return `/staff/catalog/${assetId}/preview-image?variant=${variant}&v=${encodeURIComponent(version)}`
}
