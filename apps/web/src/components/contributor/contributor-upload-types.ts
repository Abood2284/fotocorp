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
}

export const UPLOAD_STEPS = [
  { id: 1, label: "Event" },
  { id: 2, label: "Upload" },
  { id: 3, label: "Metadata" },
] as const

export type UploadWizardStep = (typeof UPLOAD_STEPS)[number]["id"]

export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const MAX_FILES_PER_PREPARE = 100
export const UPLOAD_CONCURRENCY = 3
