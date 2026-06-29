export const METADATA_SCAN_STATUSES = ["PENDING", "SUCCESS", "FAILED", "SKIPPED"] as const
export const SOURCE_QUALITY_BUCKETS = [
  "LOW_SOURCE",
  "STANDARD_SOURCE",
  "HIGH_SOURCE",
  "VERY_HIGH_SOURCE",
  "UNKNOWN",
] as const
export const DOWNLOAD_QUALITY_CEILINGS = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"] as const

export type MetadataScanStatus = (typeof METADATA_SCAN_STATUSES)[number]
export type SourceQualityBucket = (typeof SOURCE_QUALITY_BUCKETS)[number]
export type DownloadQualityCeiling = (typeof DOWNLOAD_QUALITY_CEILINGS)[number]

export interface OriginalImageMetadataRow {
  imageAssetId: string
  originalWidth: number | null
  originalHeight: number | null
  displayWidth: number | null
  displayHeight: number | null
  originalLongEdge: number | null
  originalShortEdge: number | null
  originalMegapixels: string | null
  originalDpi: number | null
  originalResolutionUnit: string | null
  originalFormat: string | null
  originalSizeBytes: number | null
  originalColorSpace: string | null
  originalChannels: number | null
  originalBitDepth: number | null
  originalHasAlpha: boolean
  originalOrientation: number | null
  originalHasProfile: boolean
  originalHasExif: boolean
  originalHasIptc: boolean
  originalHasXmp: boolean
  sourceQualityBucket: SourceQualityBucket
  downloadQualityCeiling: DownloadQualityCeiling
  canGenerateMedium: boolean
  canGenerateLow: boolean
  technicalMetadataScannedAt: string
  metadataScanStatus: MetadataScanStatus
  metadataScanError: string | null
}
