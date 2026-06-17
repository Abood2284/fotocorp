import { CARICATURE_DERIVATIVE_TYPES } from "../db/schema/caricature-derivatives"

/** Shared public previews bucket (same as editorial `MEDIA_PREVIEWS_BUCKET`). Keys live under `caricatures/`. */
export const CARICATURE_PREVIEWS_BUCKET_NAME = "fotocorp-2026-previews"

export const CARICATURE_BLUR_VERSION = "fotocorp_caricature_blur_v1"
export const CARICATURE_STRIP_VERSION = "fotocorp_caricature_strip_v1"

export type CaricaturePreviewVariant = "card" | "detail"

type CaricatureDerivativeType = (typeof CARICATURE_DERIVATIVE_TYPES)[number]

export function caricaturePreviewVariantFromDerivativeType(
  derivativeType: string,
): CaricaturePreviewVariant | null {
  if (derivativeType === "BLURRED_CARD") return "card"
  if (derivativeType === "BLURRED_DETAIL") return "detail"
  return null
}

export function caricatureDerivativeTypeFromPreviewVariant(
  variant: CaricaturePreviewVariant,
): CaricatureDerivativeType {
  return variant === "card" ? "BLURRED_CARD" : "BLURRED_DETAIL"
}

export function buildCaricaturePreviewStorageKey(input: {
  assetId: string
  variant: CaricaturePreviewVariant
}): string {
  const suffix = input.variant === "card" ? "blurred-card" : "blurred-detail"
  return `caricatures/${input.assetId}/${suffix}.webp`
}
