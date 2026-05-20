export type PreviewVariant = "thumb" | "card" | "detail"

export type UpperPreviewVariant = "THUMB" | "CARD" | "DETAIL"

export const THUMB_LIGHT_PREVIEW_PROFILE = "fotocorp_thumb_light_preview_v1"
export const CARD_LIGHT_PREVIEW_PROFILE = "fotocorp_card_light_preview_v1"
export const DETAIL_PREVIEW_PROFILE = "fotocorp_detail_preview_v1"

export const PREVIEW_VARIANTS: PreviewVariant[] = ["thumb", "card", "detail"]

export const DEFAULT_PREVIEW_LABEL = "Fotocorp"
export const DEFAULT_PREVIEW_WEBSITE = "fotocorp.com"

export const DEFAULT_LIMIT_INPUT_PIXELS = 268_402_689

export interface PreviewVariantProfile {
  width: number
  qualities: number[]
  targetMaxBytes: number
}

export const PREVIEW_VARIANT_PROFILES: Record<PreviewVariant, PreviewVariantProfile> = {
  thumb: {
    width: 360,
    qualities: [72, 68, 64],
    targetMaxBytes: 120 * 1024,
  },
  card: {
    width: 612,
    qualities: [78, 74, 70],
    targetMaxBytes: 260 * 1024,
  },
  detail: {
    width: 1024,
    qualities: [82, 78, 74],
    targetMaxBytes: 520 * 1024,
  },
}

export function variantIsWatermarked(_variant: PreviewVariant | UpperPreviewVariant): boolean {
  return true
}

export function expectedWatermarkProfile(variant: PreviewVariant | UpperPreviewVariant): string {
  const normalized = variant.toLowerCase() as PreviewVariant
  if (normalized === "thumb") return THUMB_LIGHT_PREVIEW_PROFILE
  if (normalized === "card") return CARD_LIGHT_PREVIEW_PROFILE
  return DETAIL_PREVIEW_PROFILE
}

export function toLowerPreviewVariant(variant: UpperPreviewVariant): PreviewVariant {
  return variant.toLowerCase() as PreviewVariant
}

export function toUpperPreviewVariant(variant: PreviewVariant): UpperPreviewVariant {
  return variant.toUpperCase() as UpperPreviewVariant
}
