import type {
  AdminCatalogAssetItem,
  AdminCatalogFilters,
} from "@/features/assets/admin-catalog-types"

export type AdminAssetPreviewVariant = "thumb" | "card" | "detail"

export function bestAdminAssetPreviewVariant(asset: AdminCatalogAssetItem): AdminAssetPreviewVariant | null {
  if (!asset.readyPreviewVariants) return null
  if (asset.readyPreviewVariants.includes("card")) return "card"
  if (asset.readyPreviewVariants.includes("detail")) return "detail"
  if (asset.readyPreviewVariants.includes("thumb")) return "thumb"
  return null
}

export function bestAdminAssetDetailPreviewVariant(asset: AdminCatalogAssetItem): AdminAssetPreviewVariant | null {
  if (!asset.readyPreviewVariants) return null
  if (asset.readyPreviewVariants.includes("detail")) return "detail"
  if (asset.readyPreviewVariants.includes("card")) return "card"
  if (asset.readyPreviewVariants.includes("thumb")) return "thumb"
  return null
}

export function staffCatalogPreviewImageUrl(assetId: string, variant: AdminAssetPreviewVariant) {
  return `/staff/catalog/${assetId}/preview-image?variant=${variant}`
}

export function adminAssetDisplayCode(asset: AdminCatalogAssetItem) {
  return asset.fotokey ?? asset.legacyImageCode ?? asset.id.split("-")[0]
}

/** Public title is always the linked event name. */
export function adminAssetEventTitle(asset: AdminCatalogAssetItem) {
  return asset.event?.name?.trim() || null
}

export function adminAssetDisplayTitle(asset: AdminCatalogAssetItem) {
  return adminAssetEventTitle(asset)
}

export function hasAdminAssetEvent(asset: AdminCatalogAssetItem) {
  return Boolean(asset.event?.id)
}

export function isAdminAssetEventLocked(asset: AdminCatalogAssetItem) {
  return hasAdminAssetEvent(asset)
}

export function adminAssetEventOptions(
  asset: AdminCatalogAssetItem,
  filterEvents: AdminCatalogFilters["events"],
) {
  if (!asset.event?.id) return filterEvents
  if (filterEvents.some((event) => event.id === asset.event?.id)) return filterEvents

  return [
    {
      id: asset.event.id,
      name: asset.event.name,
      eventDate: asset.event.eventDate,
      assetCount: 0,
    },
    ...filterEvents,
  ]
}

export function isAdminAssetCaptionWorkComplete(asset: AdminCatalogAssetItem) {
  return Boolean(
    asset.whoIsInPicture?.trim()
    && asset.caption?.trim()
    && hasAdminAssetEvent(asset)
    && asset.category,
  )
}
