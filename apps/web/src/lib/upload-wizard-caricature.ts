import type { UploadBatchAssetType } from "@/components/contributor/contributor-upload-types"

export const UPLOAD_STEPS_EDITORIAL = [
  { id: 1, label: "Asset type" },
  { id: 2, label: "Event" },
  { id: 3, label: "Upload" },
  { id: 4, label: "Metadata" },
] as const

export const UPLOAD_STEPS_CARICATURE = [
  { id: 1, label: "Asset type" },
  { id: 2, label: "Details" },
  { id: 3, label: "Upload" },
  { id: 4, label: "Metadata" },
] as const

export function uploadStepsForAssetType(assetType: UploadBatchAssetType) {
  if (assetType === "CARICATURE") return UPLOAD_STEPS_CARICATURE
  return UPLOAD_STEPS_EDITORIAL
}

export function uploadWizardAssetTypeHint(assetType: UploadBatchAssetType): string {
  if (assetType === "CARICATURE") {
    return "Choose the asset type for this upload, then continue to caricature details."
  }
  return "Choose the asset type for this batch, then continue to event details."
}

export function caricatureUploadActionTitle(step: number): string {
  switch (step) {
    case 2:
      return "Continue"
    case 3:
      return "Continue to metadata"
    case 4:
      return "Save caricature"
    default:
      return ""
  }
}

export function editorialUploadActionTitle(step: number): string {
  switch (step) {
    case 2:
      return "Create event"
    case 3:
      return "Upload images"
    case 4:
      return "Submit batch"
    default:
      return ""
  }
}
