import { createHash } from "node:crypto"
import sharp from "sharp"
import {
  DEFAULT_LIMIT_INPUT_PIXELS,
  PREVIEW_VARIANT_PROFILES,
  type PreviewVariant,
  expectedWatermarkProfile,
} from "./profiles"

export type DiagonalWatermarkTone = "light" | "dark"

interface DiagonalWatermarkToneProfile {
  tone: DiagonalWatermarkTone
  medianLuma: number
  shadowLuma: number
}

interface StripLayout {
  x: number
  y: number
  width: number
  height: number
}

export interface GenerateProtectedPreviewInput {
  source: Buffer
  variant: PreviewVariant
  label: string
  website?: string
}

export interface GeneratedProtectedPreview {
  buffer: Buffer
  width: number
  height: number
  byteSize: number
  quality: number
  checksum: string
  watermarked: boolean
  watermarkProfile: string
  diagonalWatermarkTone: DiagonalWatermarkTone
  stripPlacement?: string
}

export async function decodePreviewSource(source: Buffer): Promise<Buffer> {
  return sharp(source, {
    failOn: "none",
    limitInputPixels: DEFAULT_LIMIT_INPUT_PIXELS,
  })
    .rotate()
    .toBuffer()
}

export async function generateProtectedPreview(
  input: GenerateProtectedPreviewInput,
): Promise<GeneratedProtectedPreview> {
  const profile = PREVIEW_VARIANT_PROFILES[input.variant]
  const website = input.website?.trim() || "fotocorp.com"

  const metadata = await sharp(input.source, {
    failOn: "none",
    limitInputPixels: DEFAULT_LIMIT_INPUT_PIXELS,
  }).metadata()

  const targetWidth = metadata.width
    ? Math.min(metadata.width, profile.width)
    : profile.width

  let bestCandidate: GeneratedProtectedPreview | undefined

  for (const quality of profile.qualities) {
    const resized = await sharp(input.source, {
      failOn: "none",
      limitInputPixels: DEFAULT_LIMIT_INPUT_PIXELS,
    })
      .resize({ width: targetWidth, withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true })

    const width = resized.info.width
    const height = resized.info.height

    if (!width || !height) {
      throw new Error(`Unable to determine dimensions for ${input.variant}.`)
    }

    const diagonalTone = await detectDiagonalWatermarkTone(resized.data, input.variant)

    const encoded = await renderWatermarkedPreview({
      input: resized.data,
      width,
      height,
      variant: input.variant,
      quality,
      label: input.label,
      website,
      diagonalTone,
    })

    const candidate: GeneratedProtectedPreview = {
      width: encoded.info.width ?? width,
      height: encoded.info.height ?? height,
      byteSize: encoded.data.byteLength,
      quality,
      buffer: encoded.data,
      checksum: createHash("sha256").update(encoded.data).digest("hex"),
      watermarked: true,
      watermarkProfile: expectedWatermarkProfile(input.variant),
      diagonalWatermarkTone: diagonalTone.tone,
    }

    if (variantUsesStrip(input.variant)) {
      candidate.stripPlacement = "flush-right-bottom"
    }

    if (!bestCandidate || candidate.byteSize < bestCandidate.byteSize) {
      bestCandidate = candidate
    }

    if (candidate.byteSize <= profile.targetMaxBytes) {
      return candidate
    }
  }

  if (!bestCandidate) {
    throw new Error(`Unable to generate ${input.variant} preview.`)
  }

  return bestCandidate
}

function variantUsesStrip(variant: PreviewVariant): boolean {
  return variant === "card" || variant === "detail"
}

function getDiagonalOpacity(variant: PreviewVariant) {
  if (variant === "thumb") return 0.055
  if (variant === "card") return 0.18
  return 0.34
}

function getDiagonalToneThreshold(variant: PreviewVariant) {
  if (variant === "thumb") return 122
  if (variant === "card") return 58
  return 54
}

async function detectDiagonalWatermarkTone(
  image: Buffer,
  variant: PreviewVariant,
): Promise<DiagonalWatermarkToneProfile> {
  const { data } = await sharp(image, { failOn: "none" })
    .resize(128, 128, { fit: "cover", position: "centre" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const samples = [...data].sort((left, right) => left - right)
  const medianLuma = samples[Math.floor(samples.length / 2)] ?? 128
  const shadowLuma = samples[Math.floor(samples.length * 0.25)] ?? medianLuma
  const contrastScore = shadowLuma * 0.62 + medianLuma * 0.38
  const toneBias = variant === "thumb" ? 0 : 22
  const adjustedScore = contrastScore - toneBias

  return {
    tone: adjustedScore < getDiagonalToneThreshold(variant) ? "light" : "dark",
    medianLuma,
    shadowLuma,
  }
}

function getDiagonalTileStyle(tone: DiagonalWatermarkTone, variant: PreviewVariant) {
  const fillOpacity = getDiagonalOpacity(variant)
  const isCard = variant === "card"
  const isDetail = variant === "detail"
  const strokeBoost = variant === "thumb" ? 1 : isCard ? 1.32 : 1.45

  if (tone === "light") {
    return {
      fill: isDetail ? "#6e6e6e" : isCard ? "#787878" : "#ffffff",
      fillOpacity: Math.min(
        fillOpacity * (isDetail || isCard ? 1 : 1.12),
        isDetail ? 0.32 : isCard ? 0.22 : 0.22,
      ),
      stroke: "#111111",
      strokeOpacity: Math.min(0.14 * strokeBoost, isDetail ? 0.28 : isCard ? 0.24 : 0.24),
      strokeWidth: isDetail ? 1.1 : isCard ? 1 : variant === "thumb" ? 0.6 : 0.9,
    }
  }

  return {
    fill: "#000000",
    fillOpacity: isDetail
      ? Math.min(fillOpacity * 1.05, 0.42)
      : isCard
        ? Math.min(fillOpacity * 1.08, 0.32)
        : fillOpacity,
    stroke: isDetail || isCard ? "#000000" : "#ffffff",
    strokeOpacity: isDetail
      ? Math.min(0.22 * strokeBoost, 0.34)
      : isCard
        ? Math.min(0.18 * strokeBoost, 0.28)
        : Math.min(0.08 * strokeBoost, 0.2),
    strokeWidth: isDetail ? 1.2 : isCard ? 1 : variant === "thumb" ? 0.6 : 0.9,
  }
}

function getDiagonalTileMetrics(variant: PreviewVariant, width: number) {
  if (variant === "detail") {
    return {
      tileWidthRatio: 0.36,
      tileWidthMin: 180,
      tileWidthMax: 480,
      tileHeightRatio: 0.44,
      tileHeightMin: 90,
      tileHeightMax: 210,
      fontSizeRatio: 0.034,
      fontSizeMin: 14,
      fontSizeMax: 40,
      letterSpacing: 2.8,
    }
  }

  if (variant === "card") {
    return {
      tileWidthRatio: 0.4,
      tileWidthMin: 165,
      tileWidthMax: 440,
      tileHeightRatio: 0.43,
      tileHeightMin: 85,
      tileHeightMax: 200,
      fontSizeRatio: 0.031,
      fontSizeMin: 12,
      fontSizeMax: 34,
      letterSpacing: 2.6,
    }
  }

  return {
    tileWidthRatio: 0.42,
    tileWidthMin: 150,
    tileWidthMax: 420,
    tileHeightRatio: 0.42,
    tileHeightMin: 80,
    tileHeightMax: 190,
    fontSizeRatio: 0.026,
    fontSizeMin: 10,
    fontSizeMax: 34,
    letterSpacing: 2.4,
  }
}

async function renderWatermarkedPreview(input: {
  input: Buffer
  width: number
  height: number
  variant: PreviewVariant
  quality: number
  label: string
  website: string
  diagonalTone: DiagonalWatermarkToneProfile
}) {
  const stripLayout = variantUsesStrip(input.variant)
    ? getEditorialStripLayout(input.width, input.height, input.label)
    : undefined
  const overlay = Buffer.from(
    buildProtectedWatermarkSvg({
      width: input.width,
      height: input.height,
      variant: input.variant,
      label: input.label,
      stripLayout,
      diagonalTone: input.diagonalTone,
    }),
  )

  return sharp(input.input, { failOn: "none" })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .webp({
      quality: input.quality,
      effort: 6,
      smartSubsample: true,
    })
    .toBuffer({ resolveWithObject: true })
}

function estimateBadgeTextWidth(text: string, fontSize: number) {
  return Math.round(text.length * fontSize * 0.56)
}

function getEditorialStripLayout(width: number, height: number, label: string): StripLayout {
  const stripHeight = clamp(Math.round(width * 0.05), 32, 48)
  const fontSize = clamp(Math.round(stripHeight * 0.44), 12, 20)
  const paddingLeft = clamp(Math.round(width * 0.042), 18, 28)
  const badgeText = `© Fotocorp · ${label}`
  const stripWidth = Math.min(
    width,
    estimateBadgeTextWidth(badgeText, fontSize) + paddingLeft,
  )
  const bottomOffset = Math.round(height * 0.3)

  return {
    x: width - stripWidth,
    y: clamp(height - stripHeight - bottomOffset, 0, height - stripHeight),
    width: stripWidth,
    height: stripHeight,
  }
}

function buildProtectedWatermarkSvg(input: {
  width: number
  height: number
  variant: PreviewVariant
  label: string
  stripLayout?: StripLayout
  diagonalTone: DiagonalWatermarkToneProfile
}) {
  const { width, height, variant, label, stripLayout, diagonalTone } = input

  const safeLabel = escapeXml(label)
  const tileStyle = getDiagonalTileStyle(diagonalTone.tone, variant)
  const tileMetrics = getDiagonalTileMetrics(variant, width)

  const tileWidth = clamp(
    Math.round(width * tileMetrics.tileWidthRatio),
    tileMetrics.tileWidthMin,
    tileMetrics.tileWidthMax,
  )
  const tileHeight = clamp(
    Math.round(tileWidth * tileMetrics.tileHeightRatio),
    tileMetrics.tileHeightMin,
    tileMetrics.tileHeightMax,
  )
  const microFontSize = clamp(
    Math.round(width * tileMetrics.fontSizeRatio),
    tileMetrics.fontSizeMin,
    tileMetrics.fontSizeMax,
  )
  const diagonalText = "fotocorp"

  const tiles: string[] = []

  for (let y = -tileHeight; y < height + tileHeight; y += tileHeight) {
    for (let x = -tileWidth; x < width + tileWidth; x += tileWidth) {
      tiles.push(`
        <g transform="translate(${x} ${y}) rotate(-28 ${tileWidth / 2} ${tileHeight / 2})">
          <text
            x="${tileWidth / 2}"
            y="${tileHeight / 2}"
            text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${microFontSize}"
            font-weight="800"
            letter-spacing="${tileMetrics.letterSpacing}"
            stroke="${tileStyle.stroke}"
            stroke-opacity="${tileStyle.strokeOpacity}"
            stroke-width="${tileStyle.strokeWidth}"
            fill="${tileStyle.fill}"
            fill-opacity="${tileStyle.fillOpacity}"
          >${diagonalText}</text>
        </g>
      `)
    }
  }

  const stripOpacity = 0.5
  const stripTextSize = stripLayout ? clamp(Math.round(stripLayout.height * 0.44), 12, 20) : 0
  const stripTextX = stripLayout ? width : 0
  const stripTextY = stripLayout
    ? stripLayout.y + Math.round(stripLayout.height * 0.68)
    : 0
  const stripBadgeText = `© Fotocorp · ${safeLabel}`
  const stripSvg = stripLayout
    ? `
      <g>
        <rect
          x="${stripLayout.x}"
          y="${stripLayout.y}"
          width="${stripLayout.width}"
          height="${stripLayout.height}"
          fill="#050505"
          fill-opacity="${stripOpacity}"
        />
        <text
          x="${stripTextX}"
          y="${stripTextY}"
          text-anchor="end"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${stripTextSize}"
          font-weight="600"
          letter-spacing="0.35"
          fill="#ffffff"
          fill-opacity="0.92"
        >${escapeXml(stripBadgeText)}</text>
      </g>
    `
    : ""

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="none"/>

      ${tiles.join("\n")}

      ${stripSvg}

      <metadata>
        variant=${escapeXml(variant)}
        label=${safeLabel}
        ${stripLayout ? "stripPlacement=flush-right-bottom" : ""}
        watermarkTemplate=${escapeXml(expectedWatermarkProfile(variant))}
        diagonalWatermarkTone=${diagonalTone.tone}
        medianLuma=${diagonalTone.medianLuma}
        shadowLuma=${diagonalTone.shadowLuma}
        generatedBy=fotocorp-media-preview
      </metadata>
    </svg>
  `
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
