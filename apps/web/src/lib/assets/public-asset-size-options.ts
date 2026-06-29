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
  const longEdge = technicalMetadata?.originalLongEdge ?? null
  const displayWidth = technicalMetadata?.displayWidth ?? null
  const displayHeight = technicalMetadata?.displayHeight ?? null
  const originalDpi = technicalMetadata?.originalDpi ?? null
  const originalMegapixels = technicalMetadata?.originalMegapixels ?? null

  return [
    {
      id: "web",
      label: "Low",
      dimensions: formatLowDimensions(longEdge),
      description: SIZE_OPTION_DESCRIPTIONS.web,
      selectable: true,
      downloadAvailable: true,
    },
    {
      id: "medium",
      label: "Medium",
      dimensions: formatMediumDimensions(longEdge),
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

function formatLowDimensions(longEdge: number | null): string | null {
  if (longEdge === null) return null
  return joinDetailSegments([
    `${Math.min(LOW_MAX_LONG_EDGE, longEdge).toLocaleString()} px max edge`,
    `${LOW_OUTPUT_DPI} dpi`,
  ])
}

function formatMediumDimensions(longEdge: number | null): string | null {
  if (longEdge === null) return null
  return joinDetailSegments([
    `${Math.min(MEDIUM_MAX_LONG_EDGE, longEdge).toLocaleString()} px max edge`,
    `${MEDIUM_OUTPUT_DPI} dpi`,
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
    segments.push(`${input.longEdge.toLocaleString()} px max edge`)
  }

  if (input.originalDpi !== null) {
    segments.push(`${input.originalDpi} dpi`)
  }

  const megapixelsLabel = formatMegapixelsLabel(input.originalMegapixels)
  if (megapixelsLabel) segments.push(megapixelsLabel)

  return joinDetailSegments(segments)
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
