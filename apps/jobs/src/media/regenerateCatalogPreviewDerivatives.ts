import { toLowerPreviewVariant, type PreviewVariant } from "@fotocorp/media-preview/profiles"
import { expectedWatermarkProfile, variantIsWatermarked } from "@fotocorp/media-preview/profiles"
import { decodePreviewSource, generateProtectedPreview } from "@fotocorp/media-preview/generate"
import { PREVIEW_KEY_PREFIX } from "../lib/r2Client"

export type CatalogPreviewVariant = "THUMB" | "CARD" | "DETAIL"

export const CATALOG_PREVIEW_VARIANTS: CatalogPreviewVariant[] = ["THUMB", "CARD", "DETAIL"]

export const CATALOG_PREVIEW_MIME_TYPE = "image/webp"

export interface ExistingCatalogDerivativeRow {
  variant: CatalogPreviewVariant
  generationStatus: string | null
  isWatermarked: boolean | null
  watermarkProfile: string | null
  width: number | null
  height: number | null
  mimeType: string | null
}

export interface GeneratedCatalogPreviewDerivative {
  variant: CatalogPreviewVariant
  storageKey: string
  buffer: Buffer
  width: number
  height: number
  byteSize: number
  checksum: string
}

export function resolveCatalogPreviewObjectId(input: {
  assetId: string
  legacyImageCode: string | null
  originalStorageKey: string | null
}): string {
  const legacyImageCode = input.legacyImageCode?.trim()
  if (legacyImageCode) return legacyImageCode

  const originalStorageKey = input.originalStorageKey?.trim()
  if (originalStorageKey) {
    const filename = originalStorageKey.split("/").pop() ?? ""
    const stem = filename.replace(/\.[^.]+$/, "")
    if (stem) return stem
  }

  throw new Error(
    `Cannot build preview key: missing legacyImageCode/originalStorageKey for asset ${input.assetId}`,
  )
}

export function buildCatalogPreviewStorageKey(
  variant: CatalogPreviewVariant,
  objectId: string,
): string {
  return `${PREVIEW_KEY_PREFIX}/${variant.toLowerCase()}/${objectId}.webp`
}

export function isCatalogDerivativeReady(
  variant: CatalogPreviewVariant,
  existing: ExistingCatalogDerivativeRow | undefined,
): boolean {
  if (!existing) return false
  const watermarkOk = existing.isWatermarked === variantIsWatermarked(toLowerPreviewVariant(variant) as PreviewVariant)
  const profileOk = existing.watermarkProfile === expectedWatermarkProfile(toLowerPreviewVariant(variant) as PreviewVariant)
  return (
    existing.generationStatus === "READY"
    && watermarkOk
    && profileOk
    && existing.mimeType !== null
    && existing.width !== null
    && existing.height !== null
  )
}

export function listCatalogVariantsToRegenerate(
  existingByVariant: Map<CatalogPreviewVariant, ExistingCatalogDerivativeRow>,
): CatalogPreviewVariant[] {
  return CATALOG_PREVIEW_VARIANTS.filter((variant) => !isCatalogDerivativeReady(variant, existingByVariant.get(variant)))
}

export async function generateCatalogPreviewDerivative(
  original: Buffer,
  variant: CatalogPreviewVariant,
  label: string,
  objectId: string,
): Promise<GeneratedCatalogPreviewDerivative> {
  const previewVariant = toLowerPreviewVariant(variant) as PreviewVariant
  const decoded = await decodePreviewSource(original)
  const generated = await generateProtectedPreview({
    source: decoded,
    variant: previewVariant,
    label,
  })

  return {
    variant,
    storageKey: buildCatalogPreviewStorageKey(variant, objectId),
    buffer: generated.buffer,
    width: generated.width,
    height: generated.height,
    byteSize: generated.byteSize,
    checksum: generated.checksum,
  }
}
