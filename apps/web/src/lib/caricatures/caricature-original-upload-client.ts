import {
  completeContributorCaricatureOriginalUpload,
  createContributorCaricatureUploadShell,
  presignContributorCaricatureOriginalUpload,
  putContributorFileToSignedUrl,
  getContributorCaricatureAsset,
} from "@/lib/api/contributor-api"
import type { CaricatureAssetRecord } from "@/lib/caricatures/caricature-upload-metadata"
import {
  completeStaffCaricatureOriginalUpload,
  createStaffCaricatureUploadShell,
  presignStaffCaricatureOriginalUpload,
  staffWizardGetCaricatureAsset,
  StaffWizardApiError,
} from "@/lib/staff-upload-wizard-client"

export interface CaricatureOriginalPresignResponse {
  assetId: string
  storageKey: string
  uploadMethod: "SIGNED_PUT"
  uploadUrl: string
  expiresAt: string
  headers: { "content-type": string }
}

export interface CaricatureOriginalUploadInput {
  file: File
  credit: string
  existingAssetId?: string | null
  onProgress?: (percent0to100: number) => void
}

export interface CaricatureOriginalUploadResult {
  assetId: string
  asset: CaricatureAssetRecord
}

export async function uploadCaricatureOriginalViaStaffWizard(
  input: CaricatureOriginalUploadInput,
): Promise<CaricatureOriginalUploadResult> {
  return uploadCaricatureOriginalCore({
    ...input,
    ensureAssetId: async () => {
      if (input.existingAssetId) return input.existingAssetId
      const shell = await createStaffCaricatureUploadShell({
        credit: input.credit,
        fileName: input.file.name,
      })
      return shell.id
    },
    presign: (assetId) =>
      presignStaffCaricatureOriginalUpload(assetId, {
        fileName: input.file.name,
        mimeType: resolveCaricatureMimeType(input.file),
        sizeBytes: input.file.size,
      }),
    complete: (assetId, dimensions) => completeStaffCaricatureOriginalUpload(assetId, dimensions),
    loadAsset: (assetId) => staffWizardGetCaricatureAsset(assetId),
    putFile: putContributorFileToSignedUrl,
  })
}

export async function uploadCaricatureOriginalViaContributorApi(
  input: CaricatureOriginalUploadInput,
): Promise<CaricatureOriginalUploadResult> {
  return uploadCaricatureOriginalCore({
    ...input,
    ensureAssetId: async () => {
      if (input.existingAssetId) return input.existingAssetId
      const shell = await createContributorCaricatureUploadShell({
        credit: input.credit,
        fileName: input.file.name,
      })
      return shell.id
    },
    presign: (assetId) =>
      presignContributorCaricatureOriginalUpload(assetId, {
        fileName: input.file.name,
        mimeType: resolveCaricatureMimeType(input.file),
        sizeBytes: input.file.size,
      }),
    complete: (assetId, dimensions) => completeContributorCaricatureOriginalUpload(assetId, dimensions),
    loadAsset: (assetId) => getContributorCaricatureAsset(assetId),
    putFile: putContributorFileToSignedUrl,
  })
}

async function uploadCaricatureOriginalCore(input: {
  file: File
  credit: string
  existingAssetId?: string | null
  onProgress?: (percent0to100: number) => void
  ensureAssetId: () => Promise<string>
  presign: (assetId: string) => Promise<CaricatureOriginalPresignResponse>
  complete: (
    assetId: string,
    dimensions: { width?: number | null; height?: number | null },
  ) => Promise<{ ok: true; assetId: string; hasOriginalFile: true }>
  loadAsset: (assetId: string) => Promise<CaricatureAssetRecord>
  putFile: typeof putContributorFileToSignedUrl
}): Promise<CaricatureOriginalUploadResult> {
  const assetId = await input.ensureAssetId()
  const presign = await input.presign(assetId)
  if (presign.uploadMethod !== "SIGNED_PUT" || !presign.uploadUrl) {
    throw new Error("Caricature upload storage is not configured.")
  }

  const mime = presign.headers["content-type"] || resolveCaricatureMimeType(input.file)
  const putRes = await input.putFile(presign.uploadUrl, input.file, mime, input.onProgress)
  if (!putRes.ok) {
    throw new Error(`Upload to storage failed (${putRes.status}).`)
  }

  const dimensions = await readLocalImageDimensions(input.file)
  await input.complete(assetId, dimensions)
  const asset = await input.loadAsset(assetId)
  return { assetId, asset }
}

export function resolveCaricatureMimeType(file: File): string {
  const trimmed = file.type.trim().toLowerCase()
  if (trimmed) return trimmed
  const name = file.name.trim().toLowerCase()
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

export function readLocalImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

export function isStaffWizardUploadError(error: unknown): error is StaffWizardApiError {
  return error instanceof Error && error.name === "StaffWizardApiError"
}
