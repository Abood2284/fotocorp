import type { TrackedFile, UploadBatchAssetType, UploadWizardStep } from "@/components/contributor/contributor-upload-types"
import type { ContributorUploadBatchItemDto } from "@/lib/api/contributor-api"
import type { StaffWizardUploadBatchItemDto } from "@/lib/staff-upload-wizard-client"
import { getStaffContributorUploadOriginalUrl } from "@/lib/staff-contributor-upload-metadata"

export type UploadWizardFlowKind = "contributor" | "staff"

export interface UploadBatchItemLike {
  id: string
  fileName: string
  uploadStatus: string
  mimeType: string | null
  sizeBytes: number | null
  imageAssetId: string | null
  whoIsInPicture: string | null
  caption: string | null
  keywords: string | null
  assetUpdatedAt: string | null
  failureCode: string | null
  failureMessage: string | null
}

export interface UploadBatchDetailLike {
  batch: {
    id: string
    eventId: string
    status: string
    assetType?: string
  }
  event: {
    id: string
    name: string
  }
  items: UploadBatchItemLike[]
  contributor?: {
    id: string
    displayName: string
  }
}

export interface UploadWizardDraft {
  version: 1
  currentStep: UploadWizardStep
  completedSteps: number[]
  batchAssetType: UploadBatchAssetType
  eventId: string
  batchEventName: string
  batchId: string | null
  caricatureAssetId: string | null
  targetContributorId: string
  newEventName: string
  newCategoryId: string
  newEventDate: string
  updatedAt: number
}

export interface UploadWizardResumeState {
  batchId: string
  eventId: string
  batchEventName: string
  batchAssetType: UploadBatchAssetType
  targetContributorId: string
  currentStep: UploadWizardStep
  completedSteps: Set<number>
  tracked: TrackedFile[]
}

const DRAFT_STORAGE_KEYS: Record<UploadWizardFlowKind, string> = {
  contributor: "fotocorp:upload-wizard:contributor",
  staff: "fotocorp:upload-wizard:staff",
}

function normalizeBatchAssetType(value: string | undefined): UploadBatchAssetType {
  const upper = value?.trim().toUpperCase()
  if (upper === "VIDEO") return "VIDEO"
  if (upper === "CARICATURE") return "CARICATURE"
  return "IMAGE"
}

export function getTrackedDisplayName(row: TrackedFile): string {
  return row.file?.name ?? row.fileName
}

export function getTrackedSizeBytes(row: TrackedFile): number {
  return row.file?.size ?? row.sizeBytes
}

function mapUploadStatusToUiStatus(uploadStatus: string): TrackedFile["status"] {
  switch (uploadStatus) {
    case "ASSET_CREATED":
      return "done"
    case "FAILED":
      return "failed"
    case "UPLOADED":
    case "PENDING":
      return "failed"
    default:
      return "failed"
  }
}

function failureMessageForUploadStatus(item: UploadBatchItemLike): string | null {
  if (item.uploadStatus === "FAILED") return item.failureMessage ?? "Upload failed."
  if (item.uploadStatus === "PENDING" || item.uploadStatus === "UPLOADED") {
    return "Re-add file to continue upload."
  }
  return null
}

function contributorPreviewUrl(imageAssetId: string | null, flow: UploadWizardFlowKind): string | null {
  if (!imageAssetId || flow !== "contributor") return null
  return `/api/contributor/images/${encodeURIComponent(imageAssetId)}/preview/card`
}

/** Preview URL for upload-wizard metadata thumbnails and editor. */
export function resolveUploadWizardPreviewUrl(input: {
  flow: UploadWizardFlowKind
  imageAssetId: string | null
  assetUpdatedAt?: string | null
  cacheKey?: string
  existingPreviewUrl?: string | null
  /** After upload completes, prefer a durable staff original URL over a local blob. */
  preferServerPreview?: boolean
}): string | null {
  const {
    flow,
    imageAssetId,
    assetUpdatedAt,
    cacheKey,
    existingPreviewUrl,
    preferServerPreview = false,
  } = input

  if (existingPreviewUrl?.startsWith("blob:") && !preferServerPreview) return existingPreviewUrl
  if (!imageAssetId) return existingPreviewUrl ?? null

  const version = assetUpdatedAt ?? cacheKey ?? imageAssetId
  if (flow === "staff") {
    return `${getStaffContributorUploadOriginalUrl(imageAssetId)}?v=${encodeURIComponent(version)}`
  }
  return contributorPreviewUrl(imageAssetId, flow) ?? existingPreviewUrl ?? null
}

/** Refresh cache-buster on staff original preview URLs after metadata save. */
export function refreshStoredPreviewUrlVersion(
  previewUrl: string | null,
  imageAssetId: string | null,
  version: string,
): string | null {
  if (!previewUrl || previewUrl.startsWith("blob:")) return previewUrl
  if (!imageAssetId) return previewUrl
  if (!previewUrl.includes("/staff/contributor-uploads/") || !previewUrl.includes("/original")) {
    return previewUrl
  }
  return `${getStaffContributorUploadOriginalUrl(imageAssetId)}?v=${encodeURIComponent(version)}`
}

export function mapBatchItemToTrackedFile(
  item: UploadBatchItemLike,
  flow: UploadWizardFlowKind,
): TrackedFile | null {
  if (item.uploadStatus !== "ASSET_CREATED") return null

  return {
    key: item.id,
    file: null,
    fileName: item.fileName,
    sizeBytes: item.sizeBytes ?? 0,
    status: mapUploadStatusToUiStatus(item.uploadStatus),
    errorMessage: failureMessageForUploadStatus(item),
    itemId: item.id,
    imageAssetId: item.imageAssetId,
    instruction: null,
    uploadProgress: null,
    previewUrl: resolveUploadWizardPreviewUrl({
      flow,
      imageAssetId: item.imageAssetId,
      assetUpdatedAt: item.assetUpdatedAt,
      cacheKey: item.id,
    }),
    whoIsInPicture: item.whoIsInPicture ?? "",
    caption: item.caption ?? "",
    keywords: item.keywords ?? "",
    assetUpdatedAt: item.assetUpdatedAt,
    saveState: "idle",
    saveHint: null,
    resumedFromServer: true,
  }
}

export function deriveWizardStepFromBatch(items: UploadBatchItemLike[], batchStatus: string): {
  currentStep: UploadWizardStep
  completedSteps: Set<number>
} {
  const completedSteps = new Set<number>()
  if (batchStatus !== "OPEN") {
    return { currentStep: 1, completedSteps }
  }

  completedSteps.add(1)
  completedSteps.add(2)
  const hasUploaded = items.some((item) => item.uploadStatus === "ASSET_CREATED")
  if (hasUploaded) {
    completedSteps.add(3)
    return { currentStep: 4, completedSteps }
  }

  if (items.length > 0) {
    return { currentStep: 3, completedSteps }
  }

  return { currentStep: 3, completedSteps }
}

export function buildResumeStateFromBatchDetail(
  detail: UploadBatchDetailLike,
  flow: UploadWizardFlowKind,
): UploadWizardResumeState {
  const tracked = detail.items
    .map((item) => mapBatchItemToTrackedFile(item, flow))
    .filter((row): row is TrackedFile => row !== null)
  const { currentStep, completedSteps } = deriveWizardStepFromBatch(detail.items, detail.batch.status)

  return {
    batchId: detail.batch.id,
    eventId: detail.batch.eventId,
    batchEventName: detail.event.name,
    batchAssetType: normalizeBatchAssetType(detail.batch.assetType),
    targetContributorId: detail.contributor?.id ?? "",
    currentStep,
    completedSteps,
    tracked,
  }
}

export function toUploadBatchDetailLike(
  detail:
    | {
        batch: { id: string; eventId: string; status: string; assetType?: string }
        event: { id: string; name: string }
        items: ContributorUploadBatchItemDto[]
      }
    | {
        batch: { id: string; eventId: string; status: string; assetType?: string }
        event: { id: string; name: string }
        items: StaffWizardUploadBatchItemDto[]
        contributor: { id: string; displayName: string }
      },
): UploadBatchDetailLike {
  return {
    batch: detail.batch,
    event: detail.event,
    items: detail.items,
    contributor: "contributor" in detail ? detail.contributor : undefined,
  }
}

export function readUploadWizardDraft(flow: UploadWizardFlowKind): UploadWizardDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEYS[flow])
    if (!raw) return null
    const parsed = JSON.parse(raw) as UploadWizardDraft
    if (parsed.version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export function writeUploadWizardDraft(flow: UploadWizardFlowKind, draft: UploadWizardDraft): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(DRAFT_STORAGE_KEYS[flow], JSON.stringify(draft))
}

export function clearUploadWizardDraft(flow: UploadWizardFlowKind): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(DRAFT_STORAGE_KEYS[flow])
}

export function syncBatchIdToUrl(pathname: string, batchId: string): string {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "")
  params.set("batchId", batchId)
  return `${pathname}?${params.toString()}`
}

/** Updates the URL without a Next.js navigation so in-flight upload state is preserved. */
export function persistBatchIdInBrowserUrl(pathname: string, batchId: string): void {
  if (typeof window === "undefined") return
  const params = new URLSearchParams(window.location.search)
  if (params.get("batchId") === batchId) return
  params.set("batchId", batchId)
  const nextUrl = `${pathname}?${params.toString()}`
  window.history.replaceState(window.history.state, "", nextUrl)
}

export function createTrackedFileFromLocal(file: File, index: number): TrackedFile {
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${index}-${file.name}`
  const previewUrl = URL.createObjectURL(file)
  return {
    key,
    file,
    fileName: file.name,
    sizeBytes: file.size,
    status: "queued",
    errorMessage: null,
    itemId: null,
    imageAssetId: null,
    instruction: null,
    uploadProgress: null,
    previewUrl,
    whoIsInPicture: "",
    caption: "",
    keywords: "",
    assetUpdatedAt: null,
    saveState: "idle",
    saveHint: null,
  }
}
