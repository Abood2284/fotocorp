export const CARICATURE_PREVIEWS_BUCKET_NAME = "fotocorp-2026-previews"
export const CARICATURE_ORIGINALS_BUCKET_NAME = "fotocorp-caricature-originals"

export const CARICATURE_BLUR_VERSION = "fotocorp_caricature_blur_v1"
export const CARICATURE_STRIP_VERSION = "fotocorp_caricature_strip_v1"

export type CaricaturePreviewVariant = "card" | "detail"

export function caricatureDerivativeTypeFromPreviewVariant(variant: CaricaturePreviewVariant): string {
  return variant === "card" ? "BLURRED_CARD" : "BLURRED_DETAIL"
}

export function buildCaricaturePreviewStorageKey(input: {
  assetId: string
  variant: CaricaturePreviewVariant
}): string {
  const suffix = input.variant === "card" ? "blurred-card" : "blurred-detail"
  return `caricatures/${input.assetId}/${suffix}.webp`
}

export function buildCaricaturePreviewPublicUrl(baseUrl: string | undefined, storageKey: string): string | null {
  const cleanBaseUrl = baseUrl?.trim().replace(/\/+$/, "")
  if (!cleanBaseUrl) return null
  const cleanStorageKey = storageKey.trim().replace(/^\/+/, "")
  if (!cleanStorageKey) return null
  return `${cleanBaseUrl}/${cleanStorageKey}`
}
