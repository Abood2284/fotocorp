import sharp from "sharp"
import type {
  DownloadQualityCeiling,
  OriginalImageMetadataRow,
  SourceQualityBucket,
} from "./types"

const ORIENTATION_SWAP_VALUES = new Set([5, 6, 7, 8])

export interface ComputeOriginalImageMetadataInput {
  imageAssetId: string
  buffer: Buffer
}

export function toPositiveInt(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : null
}

export function resolveDisplayDimensions(
  width: number | null,
  height: number | null,
  orientation: number | null,
): { displayWidth: number | null; displayHeight: number | null } {
  if (width === null || height === null) {
    return { displayWidth: null, displayHeight: null }
  }

  if (orientation !== null && ORIENTATION_SWAP_VALUES.has(orientation)) {
    return { displayWidth: height, displayHeight: width }
  }

  return { displayWidth: width, displayHeight: height }
}

export function resolveEdges(
  width: number | null,
  height: number | null,
): { longEdge: number | null; shortEdge: number | null } {
  if (width === null || height === null) return { longEdge: null, shortEdge: null }
  return {
    longEdge: Math.max(width, height),
    shortEdge: Math.min(width, height),
  }
}

export function computeMegapixels(width: number | null, height: number | null): string | null {
  if (width === null || height === null) return null
  return (Math.round(((width * height) / 1_000_000) * 10_000) / 10_000).toFixed(4)
}

export function computeSourceQualityBucket(longEdge: number | null): SourceQualityBucket {
  if (longEdge === null) return "UNKNOWN"
  if (longEdge < 1200) return "LOW_SOURCE"
  if (longEdge < 2500) return "STANDARD_SOURCE"
  if (longEdge < 4000) return "HIGH_SOURCE"
  return "VERY_HIGH_SOURCE"
}

export function computeDownloadQualityCeiling(longEdge: number | null): DownloadQualityCeiling {
  if (longEdge === null) return "UNKNOWN"
  if (longEdge < 1600) return "LOW"
  if (longEdge < 2500) return "MEDIUM"
  return "HIGH"
}

export function mapResolutionUnit(value: string | undefined): string | null {
  if (!value) return null
  if (value === "inch" || value === "cm") return value
  return null
}

export function mapBitDepth(depth: string | undefined): number | null {
  if (!depth) return null
  const normalized = depth.toLowerCase()
  if (normalized.includes("uchar") || normalized === "char") return 8
  if (normalized.includes("ushort")) return 16
  if (normalized.includes("uint")) return 32
  if (normalized.includes("float")) return 32
  if (normalized.includes("double")) return 64
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function conciseMetadataError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.length > 240 ? `${message.slice(0, 237)}...` : message
}

export function truncateMetadataScanError(error: string): string {
  return error.length > 500 ? `${error.slice(0, 497)}...` : error
}

export async function computeOriginalImageMetadata(
  input: ComputeOriginalImageMetadataInput,
): Promise<OriginalImageMetadataRow> {
  const metadata = await sharp(input.buffer, { failOn: "none" }).metadata()
  const originalWidth = toPositiveInt(metadata.width)
  const originalHeight = toPositiveInt(metadata.height)
  const orientation = toPositiveInt(metadata.orientation)
  const { displayWidth, displayHeight } = resolveDisplayDimensions(originalWidth, originalHeight, orientation)
  const { longEdge, shortEdge } = resolveEdges(displayWidth, displayHeight)
  const sourceQualityBucket = computeSourceQualityBucket(longEdge)
  const downloadQualityCeiling = computeDownloadQualityCeiling(longEdge)

  return {
    imageAssetId: input.imageAssetId,
    originalWidth,
    originalHeight,
    displayWidth,
    displayHeight,
    originalLongEdge: longEdge,
    originalShortEdge: shortEdge,
    originalMegapixels: computeMegapixels(displayWidth, displayHeight),
    originalDpi: toPositiveInt(metadata.density),
    originalResolutionUnit: mapResolutionUnit(metadata.resolutionUnit),
    originalFormat: metadata.format ?? null,
    originalSizeBytes: metadata.size ?? input.buffer.byteLength,
    originalColorSpace: metadata.space ?? null,
    originalChannels: toPositiveInt(metadata.channels),
    originalBitDepth: mapBitDepth(metadata.depth),
    originalHasAlpha: metadata.hasAlpha === true,
    originalOrientation: orientation,
    originalHasProfile: Boolean(metadata.icc) || metadata.hasProfile === true,
    originalHasExif: Boolean(metadata.exif),
    originalHasIptc: Boolean(metadata.iptc),
    originalHasXmp: Boolean(metadata.xmp),
    sourceQualityBucket,
    downloadQualityCeiling,
    canGenerateMedium: longEdge !== null && longEdge >= 1600,
    canGenerateLow: longEdge !== null && longEdge >= 900,
    technicalMetadataScannedAt: new Date().toISOString(),
    metadataScanStatus: "SUCCESS",
    metadataScanError: null,
  }
}
