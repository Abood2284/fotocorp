import type { ContributorPrepareUploadItemInstruction } from "@/lib/api/contributor-api"

export type FileUiStatus =
  | "queued"
  | "preparing"
  | "ready"
  | "uploading"
  | "finalizing"
  | "done"
  | "failed"

export interface TrackedFile {
  key: string
  file: File | null
  fileName: string
  sizeBytes: number
  status: FileUiStatus
  errorMessage: string | null
  itemId: string | null
  imageAssetId: string | null
  instruction: ContributorPrepareUploadItemInstruction | null
  uploadProgress: number | null
  previewUrl: string | null
  whoIsInPicture: string
  caption: string
  keywords: string
  assetUpdatedAt: string | null
  saveState: "idle" | "saving" | "saved" | "error"
  saveHint: string | null
  metadataRevision?: number
  resumedFromServer?: boolean
  /** Catalog bulk import: original upload filename (Excel matching). */
  originalFileName?: string | null
  /** Catalog bulk import: canonical public business id. */
  fotokey?: string | null
  /** Catalog bulk import: legacy filename/code fallback. */
  legacyImageCode?: string | null
}

export type UploadBatchAssetType = "IMAGE" | "VIDEO" | "CARICATURE"

export const UPLOAD_ASSET_TYPE_OPTIONS: ReadonlyArray<{
  value: UploadBatchAssetType
  label: string
  description: string
  enabled: boolean
}> = [
  {
    value: "IMAGE",
    label: "Editorial",
    description: "JPEG images (JPG / JPEG only).",
    enabled: true,
  },
  {
    value: "VIDEO",
    label: "Videos",
    description: "MP4 video files.",
    enabled: false,
  },
  {
    value: "CARICATURE",
    label: "Caricature",
    description: "Single caricature artwork (JPG, PNG, or WebP).",
    enabled: true,
  },
]

export const UPLOAD_STEPS = [
  { id: 1, label: "Asset type" },
  { id: 2, label: "Event" },
  { id: 3, label: "Upload" },
  { id: 4, label: "Metadata" },
] as const

export type UploadWizardStep = (typeof UPLOAD_STEPS)[number]["id"]

export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const MAX_FILES_PER_PREPARE = 100
export const UPLOAD_CONCURRENCY = 3
