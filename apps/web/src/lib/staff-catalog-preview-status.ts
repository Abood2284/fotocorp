import type { AdminCatalogAssetItem } from "@/features/assets/admin-catalog-types"

export type CatalogDerivativeState = AdminCatalogAssetItem["derivatives"]["thumb"]["state"]

const STALE_QUEUED_MS = 2 * 60 * 1000

export function getCatalogPreviewPlaceholderMessage(asset: AdminCatalogAssetItem): string {
  if (!asset.r2Exists) return "Original not verified in R2"

  const regenJob = asset.previewRegenerationJob
  if (regenJob?.status === "QUEUED") {
    if (isStaleQueuedRegeneration(regenJob.createdAt)) {
      return "Preview regeneration queued — waiting for jobs worker"
    }
    return "Preview regeneration queued"
  }
  if (regenJob?.status === "RUNNING" || asset.previewRegenerationStatus === "RUNNING") {
    return "Worker generating previews"
  }
  if (regenJob?.status === "FAILED") {
    return "Preview regeneration failed"
  }

  const states = [asset.derivatives.thumb.state, asset.derivatives.card.state, asset.derivatives.detail.state]
  if (states.some((state) => state === "FAILED")) return "Preview generation failed"
  if (states.some((state) => state === "PROCESSING")) return "Preview processing"

  return "Previews not generated yet"
}

export function canRegenerateCatalogPreviews(asset: AdminCatalogAssetItem): boolean {
  if (!asset.r2Exists || asset.previewReady) return false
  if (isCatalogPreviewRegenerationActive(asset)) return false
  return true
}

export function isCatalogPreviewRegenerationActive(asset: AdminCatalogAssetItem): boolean {
  const status = asset.previewRegenerationJob?.status ?? asset.previewRegenerationStatus
  return status === "QUEUED" || status === "RUNNING"
}

export function isCatalogPreviewRegenerationFailed(asset: AdminCatalogAssetItem): boolean {
  return asset.previewRegenerationJob?.status === "FAILED"
}

export function isStaleQueuedRegeneration(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const createdMs = Date.parse(createdAt)
  if (Number.isNaN(createdMs)) return false
  return Date.now() - createdMs > STALE_QUEUED_MS
}

export function getCatalogRegenerationTargetVariants(asset: AdminCatalogAssetItem): Array<"thumb" | "card" | "detail"> {
  return (["thumb", "card", "detail"] as const).filter(
    (variant) => asset.derivatives[variant].state !== "READY",
  )
}

export function shouldStopCatalogPreviewPolling(asset: AdminCatalogAssetItem): boolean {
  if (asset.previewReady) return true

  const regenStatus = asset.previewRegenerationJob?.status
  if (regenStatus === "FAILED") return true
  if (regenStatus === "COMPLETED") return true

  const states = [asset.derivatives.thumb.state, asset.derivatives.card.state, asset.derivatives.detail.state]
  if (states.every((state) => state === "FAILED")) return true
  if (!isCatalogPreviewRegenerationActive(asset) && asset.previewState === "MISSING" && !asset.r2Exists) {
    return true
  }
  return false
}
