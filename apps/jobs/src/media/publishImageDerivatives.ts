/**
 * WebP preview derivatives for the publish pipeline (clean THUMB; watermarked CARD/DETAIL).
 * Logic aligned with apps/api/scripts/media/process-image-publish-jobs.ts (sizes, qualities, paths).
 */
import { createHash } from "node:crypto"
import sharp from "sharp"
import { PREVIEW_KEY_PREFIX } from "../lib/r2Client"

export type PublishVariant = "THUMB" | "CARD" | "DETAIL"

export const REQUIRED_PUBLISH_VARIANTS: PublishVariant[] = ["THUMB", "CARD", "DETAIL"]

export const PREVIEW_MIME_TYPE = "image/webp"

interface PreviewVariantProfile {
  width: number
  qualities: number[]
  targetMaxBytes?: number
}

const PREVIEW_VARIANT_PROFILES: Record<PublishVariant, PreviewVariantProfile> = {
  THUMB: { width: 220, qualities: [26, 22] },
  CARD: { width: 300, qualities: [14], targetMaxBytes: 22 * 1024 },
  DETAIL: { width: 520, qualities: [20, 16, 12], targetMaxBytes: 120 * 1024 }
}

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
  fotokey: string
): Promise<GeneratedPublishPreview> {
  const profile = PREVIEW_VARIANT_PROFILES[variant]
  const metadata = await sharp(original, { failOn: "none" }).metadata()
  const targetWidth = metadata.width ? Math.min(metadata.width, profile.width) : profile.width
  let bestCandidate: GeneratedPublishPreview | undefined

  for (const quality of profile.qualities) {
    const candidate =
      variant === "DETAIL"
        ? await renderWatermarkedPreview(original, targetWidth, quality)
        : await renderCleanPreview(original, targetWidth, quality)
    if (!bestCandidate || candidate.byteSize < bestCandidate.byteSize) bestCandidate = candidate
    if (!profile.targetMaxBytes || candidate.byteSize <= profile.targetMaxBytes) return candidate
  }

  if (!bestCandidate) throw new Error(`Unable to generate ${variant} derivative for ${fotokey}.`)
  return bestCandidate
}

async function renderCleanPreview(
  original: Buffer,
  targetWidth: number,
  quality: number
): Promise<GeneratedPublishPreview> {
  const encoded = await sharp(original, { failOn: "none" })
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toBuffer({ resolveWithObject: true })
  const width = encoded.info.width
  const height = encoded.info.height
  if (!width || !height) throw new Error("Unable to determine derivative dimensions.")
  return {
    buffer: encoded.data,
    width,
    height,
    byteSize: encoded.data.byteLength,
    checksum: createHash("sha256").update(encoded.data).digest("hex"),
    selectedQuality: quality
  }
}

async function renderWatermarkedPreview(
  original: Buffer,
  targetWidth: number,
  quality: number
): Promise<GeneratedPublishPreview> {
  const resized = await sharp(original, { failOn: "none" })
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true })
  const width = resized.info.width
  const height = resized.info.height
  if (!width || !height) throw new Error("Unable to determine derivative dimensions.")

  const watermark = Buffer.from(buildWatermarkSvg(width, height))
  const encoded = await sharp(resized.data, { failOn: "none" })
    .composite([{ input: watermark, top: 0, left: 0 }])
    .webp({ quality, effort: 6, smartSubsample: true })
    .toBuffer({ resolveWithObject: true })

  return {
    buffer: encoded.data,
    width: encoded.info.width ?? width,
    height: encoded.info.height ?? height,
    byteSize: encoded.data.byteLength,
    checksum: createHash("sha256").update(encoded.data).digest("hex"),
    selectedQuality: quality
  }
}

function buildWatermarkSvg(width: number, height: number) {
  const tileWidth = 190
  const tileHeight = 105
  const tiles: string[] = []

  for (let y = -tileHeight; y < height + tileHeight; y += tileHeight) {
    for (let x = -tileWidth; x < width + tileWidth; x += tileWidth) {
      tiles.push(`
       <g transform="translate(${x} ${y}) rotate(-28 95 52.5)">
         <text
           x="95"
           y="57"
           text-anchor="middle"
           font-family="Arial, Helvetica, sans-serif"
           font-size="27"
           font-weight="800"
           letter-spacing="3"
           fill="#111111"
           fill-opacity="0.52"
           stroke="#ffffff"
           stroke-opacity="0.20"
           stroke-width="1.0"
         >fotocorp</text>
       </g>
      `)
    }
  }

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="none"/>
      ${tiles.join("\n")}
    </svg>
  `
}
