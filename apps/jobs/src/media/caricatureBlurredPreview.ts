import { createHash } from "node:crypto"
import sharp from "sharp"

import {
  CARICATURE_BLUR_VERSION,
  CARICATURE_STRIP_VERSION,
  type CaricaturePreviewVariant,
} from "../lib/caricatureStorageKeys"

const DEFAULT_LIMIT_INPUT_PIXELS = 268_402_689

export interface CaricatureBlurredPreviewProfile {
  maxWidth: number
  blurSigma: number
  qualities: number[]
  targetMaxBytes: number
}

export const CARICATURE_BLURRED_PREVIEW_PROFILES: Record<CaricaturePreviewVariant, CaricatureBlurredPreviewProfile> = {
  card: {
    maxWidth: 480,
    blurSigma: 28,
    qualities: [62, 58, 54],
    targetMaxBytes: 180 * 1024,
  },
  detail: {
    maxWidth: 900,
    blurSigma: 22,
    qualities: [68, 64, 60],
    targetMaxBytes: 320 * 1024,
  },
}

export interface GenerateCaricatureBlurredPreviewInput {
  source: Buffer
  variant: CaricaturePreviewVariant
  label: string
}

export interface GeneratedCaricatureBlurredPreview {
  buffer: Buffer
  width: number
  height: number
  byteSize: number
  quality: number
  checksum: string
  blurVersion: string
  watermarkVersion: string
}

export async function generateCaricatureBlurredPreview(
  input: GenerateCaricatureBlurredPreviewInput,
): Promise<GeneratedCaricatureBlurredPreview> {
  const profile = CARICATURE_BLURRED_PREVIEW_PROFILES[input.variant]
  const label = input.label.trim() || "Fotocorp"

  const resized = await sharp(input.source, {
    failOn: "none",
    limitInputPixels: DEFAULT_LIMIT_INPUT_PIXELS,
  })
    .rotate()
    .resize({ width: profile.maxWidth, withoutEnlargement: true })
    .blur(profile.blurSigma)
    .toBuffer({ resolveWithObject: true })

  const width = resized.info.width
  const height = resized.info.height
  if (!width || !height) {
    throw new Error(`Unable to determine caricature ${input.variant} preview dimensions.`)
  }

  let bestCandidate: GeneratedCaricatureBlurredPreview | undefined

  for (const quality of profile.qualities) {
    const overlay = Buffer.from(buildCaricatureStripSvg({ width, height, label }))
    const encoded = await sharp(resized.data, { failOn: "none" })
      .composite([{ input: overlay, top: 0, left: 0 }])
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer({ resolveWithObject: true })

    const buffer = encoded.data
    const candidate: GeneratedCaricatureBlurredPreview = {
      buffer,
      width: encoded.info.width ?? width,
      height: encoded.info.height ?? height,
      byteSize: buffer.byteLength,
      quality,
      checksum: createHash("sha256").update(buffer).digest("hex"),
      blurVersion: CARICATURE_BLUR_VERSION,
      watermarkVersion: CARICATURE_STRIP_VERSION,
    }

    if (!bestCandidate || candidate.byteSize < bestCandidate.byteSize) {
      bestCandidate = candidate
    }
    if (candidate.byteSize <= profile.targetMaxBytes) {
      return candidate
    }
  }

  if (!bestCandidate) {
    throw new Error(`Unable to generate caricature ${input.variant} preview.`)
  }
  return bestCandidate
}

function buildCaricatureStripSvg(input: { width: number; height: number; label: string }) {
  const stripHeight = clamp(Math.round(input.width * 0.05), 32, 48)
  const fontSize = clamp(Math.round(stripHeight * 0.44), 12, 20)
  const paddingLeft = clamp(Math.round(input.width * 0.042), 18, 28)
  const badgeText = `© Fotocorp · ${escapeXml(input.label)}`
  const stripWidth = Math.min(input.width, estimateBadgeTextWidth(badgeText, fontSize) + paddingLeft)
  const x = input.width - stripWidth
  const y = input.height - stripHeight
  const textX = input.width - clamp(Math.round(input.width * 0.02), 8, 16)
  const textY = y + Math.round(stripHeight * 0.68)

  return `
    <svg width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${x}" y="${y}" width="${stripWidth}" height="${stripHeight}" fill="#050505" fill-opacity="0.5"/>
      <text
        x="${textX}"
        y="${textY}"
        text-anchor="end"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="600"
        letter-spacing="0.35"
        fill="#ffffff"
        fill-opacity="0.92"
      >${escapeXml(badgeText)}</text>
    </svg>
  `
}

function estimateBadgeTextWidth(text: string, fontSize: number) {
  return Math.round(text.length * fontSize * 0.56)
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
