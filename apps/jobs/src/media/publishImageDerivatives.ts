/**
 * WebP preview derivatives for the publish pipeline.
 * Uses @fotocorp/media-preview (tiered protected previews for thumb/card/detail).
 */
import { toLowerPreviewVariant, type PreviewVariant } from "@fotocorp/media-preview/profiles"
import { decodePreviewSource, generateProtectedPreview } from "@fotocorp/media-preview/generate"
import { PREVIEW_KEY_PREFIX } from "../lib/r2Client"

export type PublishVariant = "THUMB" | "CARD" | "DETAIL"

export const REQUIRED_PUBLISH_VARIANTS: PublishVariant[] = ["THUMB", "CARD", "DETAIL"]

export const PREVIEW_MIME_TYPE = "image/webp"

export interface GeneratedPublishPreview {
  buffer: Buffer
  width: number
  height: number
  byteSize: number
  checksum: string
  selectedQuality: number
}

export function buildDerivativeStorageKey(variant: PublishVariant, fotokey: string): string {
  return `${PREVIEW_KEY_PREFIX}/${variant.toLowerCase()}/${fotokey}.webp`
}

export async function generatePublishDerivative(
  original: Buffer,
  variant: PublishVariant,
  fotokey: string,
): Promise<GeneratedPublishPreview> {
  const previewVariant = toLowerPreviewVariant(variant) as PreviewVariant
  const decoded = await decodePreviewSource(original)
  const generated = await generateProtectedPreview({
    source: decoded,
    variant: previewVariant,
    label: fotokey,
  })

  return {
    buffer: generated.buffer,
    width: generated.width,
    height: generated.height,
    byteSize: generated.byteSize,
    checksum: generated.checksum,
    selectedQuality: generated.quality,
  }
}
