import { AppError } from "../errors"

export const CONTRIBUTOR_UPLOAD_TYPES = ["EDITORIAL", "CARICATURE"] as const

export type ContributorUploadType = (typeof CONTRIBUTOR_UPLOAD_TYPES)[number]

export type UploadBatchAssetType = "IMAGE" | "VIDEO" | "CARICATURE"

const UPLOAD_TYPE_SET = new Set<string>(CONTRIBUTOR_UPLOAD_TYPES)

export function isContributorUploadType(value: string): value is ContributorUploadType {
  return UPLOAD_TYPE_SET.has(value)
}

export function normalizeAllowedUploadTypes(raw: unknown): ContributorUploadType[] {
  if (!Array.isArray(raw)) return ["EDITORIAL"]

  const unique = new Set<ContributorUploadType>()
  for (const entry of raw) {
    if (typeof entry !== "string") continue
    const value = entry.trim().toUpperCase()
    if (isContributorUploadType(value)) unique.add(value)
  }

  if (unique.size === 0) return ["EDITORIAL"]
  return CONTRIBUTOR_UPLOAD_TYPES.filter((type) => unique.has(type))
}

export function parseRequiredAllowedUploadTypes(raw: unknown): ContributorUploadType[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AppError(400, "UPLOAD_TYPES_REQUIRED", "Select at least one upload type.")
  }

  const unique = new Set<ContributorUploadType>()
  for (const entry of raw) {
    if (typeof entry !== "string") {
      throw new AppError(400, "UPLOAD_TYPES_INVALID", "Upload types must be Editorial and/or Caricature.")
    }
    const value = entry.trim().toUpperCase()
    if (!isContributorUploadType(value)) {
      throw new AppError(400, "UPLOAD_TYPES_INVALID", "Upload types must be Editorial and/or Caricature.")
    }
    unique.add(value)
  }

  return CONTRIBUTOR_UPLOAD_TYPES.filter((type) => unique.has(type))
}

export function uploadBatchAssetTypeToAllowed(assetType: UploadBatchAssetType): ContributorUploadType | null {
  switch (assetType) {
    case "IMAGE":
      return "EDITORIAL"
    case "CARICATURE":
      return "CARICATURE"
    case "VIDEO":
      return null
    default: {
      const _exhaustive: never = assetType
      return _exhaustive
    }
  }
}

export function assertContributorAllowsUploadType(
  allowedUploadTypes: readonly string[],
  required: ContributorUploadType,
) {
  const allowed = normalizeAllowedUploadTypes(allowedUploadTypes)
  if (allowed.includes(required)) return

  throw new AppError(
    403,
    "UPLOAD_TYPE_NOT_ALLOWED",
    required === "CARICATURE"
      ? "Your account is not allowed to upload caricatures."
      : "Your account is not allowed to upload editorial assets.",
  )
}

export function assertContributorAllowsBatchAssetType(
  allowedUploadTypes: readonly string[],
  assetType: UploadBatchAssetType,
) {
  const required = uploadBatchAssetTypeToAllowed(assetType)
  if (!required) {
    throw new AppError(403, "UPLOAD_TYPE_NOT_ALLOWED", "This upload type is not available for contributors.")
  }
  assertContributorAllowsUploadType(allowedUploadTypes, required)
}
