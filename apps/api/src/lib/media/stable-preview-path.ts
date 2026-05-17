import type { MediaPreviewVariant } from "./preview-token"

export function buildPublicStablePreviewPath(assetId: string, variant: MediaPreviewVariant): string {
  return `/api/media/assets/${encodeURIComponent(assetId)}/preview/${variant}`
}
