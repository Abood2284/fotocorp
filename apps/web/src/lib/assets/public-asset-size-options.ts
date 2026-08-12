import type { AssetSizeOption } from "@/components/assets/asset-detail-actions"
import type { PublicAssetTechnicalMetadata } from "@/features/assets/types"

const LOW_MAX_LONG_EDGE = 1200
const MEDIUM_MAX_LONG_EDGE = 2400
const LOW_OUTPUT_DPI = 72
const MEDIUM_OUTPUT_DPI = 300

const SIZE_OPTION_DESCRIPTIONS: Record<AssetSizeOption["id"], string> = {
  web: "Best for web and screen preview",
  medium: "Best for editorial and digital publishing",
  large: "Best for print and archive delivery",
}

export function buildPublicAssetSizeOptions(
  technicalMetadata: PublicAssetTechnicalMetadata | null | undefined,
): AssetSizeOption[] {
  const displayWidth = technicalMetadata?.displayWidth ?? null
  const displayHeight = technicalMetadata?.displayHeight ?? null
  const longEdge = technicalMetadata?.originalLongEdge
    ?? (displayWidth !== null && displayHeight !== null
      ? Math.max(displayWidth, displayHeight)
      : null)
  const originalDpi = technicalMetadata?.originalDpi ?? null
  const originalMegapixels = technicalMetadata?.originalMegapixels ?? null
  const hasScannedDimensions = displayWidth !== null && displayHeight !== null && longEdge !== null

  return [
    {
      id: "web",
      label: "Low",
      dimensions: hasScannedDimensions
        ? formatScaledTierDimensions({
            displayWidth,
            displayHeight,
            longEdge,
            maxLongEdge: LOW_MAX_LONG_EDGE,
            dpi: LOW_OUTPUT_DPI,
          })
        : null,
      description: SIZE_OPTION_DESCRIPTIONS.web,
      selectable: true,
      downloadAvailable: true,
    },
    {
      id: "medium",
      label: "Medium",
      dimensions: hasScannedDimensions
        ? formatScaledTierDimensions({
            displayWidth,
            displayHeight,
            longEdge,
            maxLongEdge: MEDIUM_MAX_LONG_EDGE,
            dpi: MEDIUM_OUTPUT_DPI,
          })
        : null,
      description: SIZE_OPTION_DESCRIPTIONS.medium,
      selectable: true,
      downloadAvailable: true,
    },
    {
      id: "large",
      label: "High",
      dimensions: formatHighDimensions({
        displayWidth,
        displayHeight,
        longEdge,
        originalDpi,
        originalMegapixels,
      }),
      description: SIZE_OPTION_DESCRIPTIONS.large,
      selectable: true,
      downloadAvailable: true,
    },
  ]
}

function formatScaledTierDimensions(input: {
  displayWidth: number
  displayHeight: number
  longEdge: number
  maxLongEdge: number
  dpi: number
}): string | null {
  const scaled = scaleToMaxLongEdge(input.displayWidth, input.displayHeight, input.maxLongEdge, input.longEdge)
  if (!scaled) return null

  return joinDetailSegments([
    `${scaled.width.toLocaleString()} × ${scaled.height.toLocaleString()} px`,
    `${input.dpi} dpi`,
  ])
}

function formatHighDimensions(input: {
  displayWidth: number | null
  displayHeight: number | null
  longEdge: number | null
  originalDpi: number | null
  originalMegapixels: string | null
}): string | null {
  const segments: string[] = []

  if (input.displayWidth !== null && input.displayHeight !== null) {
    segments.push(
      `${input.displayWidth.toLocaleString()} × ${input.displayHeight.toLocaleString()} px`,
    )
  } else if (input.longEdge !== null) {
    segments.push(`${input.longEdge.toLocaleString()} px long edge`)
  }

  if (input.originalDpi !== null) {
    segments.push(`${input.originalDpi} dpi`)
  }

  const megapixelsLabel = formatMegapixelsLabel(input.originalMegapixels)
  if (megapixelsLabel) segments.push(megapixelsLabel)

  return joinDetailSegments(segments)
}

function scaleToMaxLongEdge(
  width: number,
  height: number,
  maxLongEdge: number,
  longEdge: number,
): { width: number; height: number } | null {
  if (width <= 0 || height <= 0 || longEdge <= 0) return null

  const targetLongEdge = Math.min(maxLongEdge, longEdge)
  const scale = targetLongEdge / longEdge
  const scaledWidth = Math.max(1, Math.round(width * scale))
  const scaledHeight = Math.max(1, Math.round(height * scale))

  return { width: scaledWidth, height: scaledHeight }
}

function formatMegapixelsLabel(value: string | null): string | null {
  if (!value) return null
  const megapixels = Number(value)
  if (!Number.isFinite(megapixels) || megapixels <= 0) return null
  const formatted = megapixels >= 10 ? megapixels.toFixed(1) : megapixels.toFixed(2)
  return `${formatted} MP`
}

function joinDetailSegments(segments: string[]): string | null {
  if (segments.length === 0) return null
  return segments.join(" • ")
}
