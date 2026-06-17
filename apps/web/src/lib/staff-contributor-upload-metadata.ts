import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import type { StaffContributorUploadDto } from "@/lib/api/staff-contributor-uploads-api"
import type { UploadWizardMetadataPatchBody } from "@/lib/use-upload-wizard-metadata"

export function getStaffContributorUploadOriginalUrl(imageAssetId: string) {
  return `/staff/contributor-uploads/${encodeURIComponent(imageAssetId)}/original`
}

export function staffUploadItemToTrackedFile(item: StaffContributorUploadDto): TrackedFile {
  return {
    key: item.imageAssetId,
    file: null,
    fileName: item.originalFileName,
    sizeBytes: item.sizeBytes ?? 0,
    status: "done",
    errorMessage: null,
    itemId: item.uploadItemId,
    imageAssetId: item.imageAssetId,
    instruction: null,
    uploadProgress: null,
    previewUrl: `${getStaffContributorUploadOriginalUrl(item.imageAssetId)}?v=${encodeURIComponent(item.updatedAt)}`,
    whoIsInPicture: item.whoIsInPicture ?? "",
    caption: item.caption ?? "",
    keywords: item.keywords ?? "",
    assetUpdatedAt: item.updatedAt,
    saveState: "idle",
    saveHint: null,
  }
}

export function staffUploadItemsToTrackedFiles(items: StaffContributorUploadDto[]): TrackedFile[] {
  return items.filter((item) => item.canApprove).map(staffUploadItemToTrackedFile)
}

export class StaffContributorUploadMetadataError extends Error {
  code: string
  detail?: unknown

  constructor(message: string, code: string, detail?: unknown) {
    super(message)
    this.name = "StaffContributorUploadMetadataError"
    this.code = code
    this.detail = detail
  }
}

interface StaffMetadataPatchOk {
  ok: true
  whoIsInPicture: string | null
  caption: string | null
  keywords: string | null
  updatedAt: string
}

export async function patchStaffContributorUploadMetadata(
  _batchId: string,
  imageAssetId: string,
  body: UploadWizardMetadataPatchBody,
): Promise<{ updatedAt: string }> {
  if (!body.expectedUpdatedAt) {
    throw new StaffContributorUploadMetadataError(
      "Missing expectedUpdatedAt for metadata save.",
      "INVALID_PAYLOAD",
    )
  }

  const response = await fetch(
    `/api/staff/contributor-uploads/${encodeURIComponent(imageAssetId)}/metadata`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedUpdatedAt: body.expectedUpdatedAt,
        whoIsInPicture: body.whoIsInPicture,
        caption: body.caption,
        keywords: body.keywords,
      }),
      cache: "no-store",
    },
  )

  const payload = (await response.json().catch(() => null)) as
    | StaffMetadataPatchOk
    | { error?: { code?: string; message?: string; detail?: unknown } }
    | null

  if (response.status === 409 && payload && "error" in payload && payload.error?.code === "METADATA_CONFLICT") {
    throw new StaffContributorUploadMetadataError(
      payload.error.message ?? "Updated elsewhere — form refreshed.",
      "METADATA_CONFLICT",
      payload.error.detail,
    )
  }

  if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
    const message =
      payload && "error" in payload ? payload.error?.message ?? "Save failed." : "Save failed."
    throw new StaffContributorUploadMetadataError(message, payload && "error" in payload ? payload.error?.code ?? "SAVE_FAILED" : "SAVE_FAILED")
  }

  return { updatedAt: payload.updatedAt }
}

export function trackedFilesToStaffUploadPatches(
  tracked: TrackedFile[],
): Record<string, Partial<StaffContributorUploadDto>> {
  const patches: Record<string, Partial<StaffContributorUploadDto>> = {}

  for (const row of tracked) {
    if (!row.imageAssetId) continue
    patches[row.imageAssetId] = {
      whoIsInPicture: row.whoIsInPicture.trim() || null,
      caption: row.caption.trim() || null,
      keywords: row.keywords.trim() || null,
      updatedAt: row.assetUpdatedAt ?? undefined,
    }
  }

  return patches
}
