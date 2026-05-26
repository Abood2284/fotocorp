import { FIXTURE_ASSETS } from "@/lib/fixtures/assets"
import type { AssetListItem } from "@/types"

export type AdminAssetStatus =
  | "mapped"
  | "missing-metadata"
  | "preview-ready"
  | "ingestion-error"

export interface AdminAssetRecord {
  asset: AssetListItem
  status: AdminAssetStatus
  mappedFields: number
  missingFields: string[]
  bucketKey: string
  checksum: string
  fileSizeMb: number
  lastIngestedAt: string
}



const STATUS_ROTATION: AdminAssetStatus[] = [
  "mapped",
  "preview-ready",
  "missing-metadata",
  "mapped",
  "ingestion-error",
  "preview-ready",
]

export const ADMIN_ASSET_RECORDS: AdminAssetRecord[] = FIXTURE_ASSETS.map((asset, index) => {
  const status = STATUS_ROTATION[index % STATUS_ROTATION.length]
  const missingFields =
    status === "missing-metadata"
      ? ["title", "keywords"]
      : status === "ingestion-error"
        ? ["previewChecksum"]
        : []

  return {
    asset,
    status,
    mappedFields: missingFields.length > 0 ? 8 : 12,
    missingFields,
    bucketKey: "redacted",
    checksum: `sha256:${(1000 + index).toString(16)}ab${(4000 + index).toString(16)}`,
    fileSizeMb: 4.5 + index * 0.7,
    lastIngestedAt: `2026-04-${String(5 + index).padStart(2, "0")}T09:3${index % 6}:00Z`,
  }
})


