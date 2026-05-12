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

export type IngestionRunStatus = "running" | "completed" | "failed"

export interface IngestionError {
  id: string
  assetId: string
  stage: "metadata" | "preview" | "storage"
  message: string
}

export interface IngestionRun {
  id: string
  source: string
  startedAt: string
  endedAt?: string
  status: IngestionRunStatus
  successCount: number
  failureCount: number
  pendingCount: number
  errors: IngestionError[]
}

export interface StorageEnvironmentSummary {
  environment: "development" | "staging" | "production"
  bucket: string
  totalObjects: number
  totalSizeGb: number
  healthy: boolean
  lastSyncAt: string
}

export interface StorageObjectRecord {
  key: string
  contentType: string
  sizeMb: number
  etag: string
  lastModifiedAt: string
  status: "available" | "stale" | "pending-delete"
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

export const INGESTION_RUNS: IngestionRun[] = [
  {
    id: "run-2026-04-22-01",
    source: "r2://uploads/daily-drop",
    startedAt: "2026-04-22T08:00:00Z",
    endedAt: "2026-04-22T08:14:10Z",
    status: "completed",
    successCount: 128,
    failureCount: 4,
    pendingCount: 0,
    errors: [
      {
        id: "err-01",
        assetId: "asset-004",
        stage: "metadata",
        message: "Missing required EXIF timestamp",
      },
      {
        id: "err-02",
        assetId: "asset-010",
        stage: "preview",
        message: "Preview resize timeout (3000ms)",
      },
    ],
  },
  {
    id: "run-2026-04-23-01",
    source: "r2://uploads/reprocess",
    startedAt: "2026-04-23T07:30:00Z",
    status: "running",
    successCount: 41,
    failureCount: 2,
    pendingCount: 17,
    errors: [
      {
        id: "err-03",
        assetId: "asset-002",
        stage: "storage",
        message: "Object checksum mismatch",
      },
    ],
  },
  {
    id: "run-2026-04-21-02",
    source: "r2://uploads/backfill-2025",
    startedAt: "2026-04-21T05:10:00Z",
    endedAt: "2026-04-21T05:49:02Z",
    status: "failed",
    successCount: 212,
    failureCount: 38,
    pendingCount: 0,
    errors: [
      {
        id: "err-04",
        assetId: "asset-008",
        stage: "metadata",
        message: "Keyword tokenizer panic in parser step",
      },
      {
        id: "err-05",
        assetId: "asset-011",
        stage: "storage",
        message: "Source object not found in staging bucket",
      },
    ],
  },
]

export const STORAGE_SUMMARY: StorageEnvironmentSummary[] = [
  {
    environment: "development",
    bucket: "fotocorp-dev-assets",
    totalObjects: 1482,
    totalSizeGb: 86.2,
    healthy: true,
    lastSyncAt: "2026-04-23T09:00:00Z",
  },
  {
    environment: "staging",
    bucket: "fotocorp-staging-assets",
    totalObjects: 48120,
    totalSizeGb: 2194.3,
    healthy: true,
    lastSyncAt: "2026-04-23T08:58:21Z",
  },
  {
    environment: "production",
    bucket: "fotocorp-prod-assets",
    totalObjects: 320442,
    totalSizeGb: 18440.1,
    healthy: false,
    lastSyncAt: "2026-04-23T08:51:03Z",
  },
]

export const STORAGE_OBJECTS: StorageObjectRecord[] = ADMIN_ASSET_RECORDS.slice(0, 8).map(
  (record, index) => ({
    key: `assets/previews/${record.asset.id}.webp`,
    contentType: "image/webp",
    sizeMb: Number((0.35 + index * 0.06).toFixed(2)),
    etag: `W/"${record.asset.id}-${index}a9d"`,
    lastModifiedAt: `2026-04-${String(12 + index).padStart(2, "0")}T11:0${index}:00Z`,
    status: index === 5 ? "stale" : index === 7 ? "pending-delete" : "available",
  }),
)
