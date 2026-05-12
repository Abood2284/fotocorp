export const ASSET_STATUSES = [
  "DRAFT",
  "REVIEW",
  "APPROVED",
  "READY",
  "PUBLISHED",
  "ARCHIVED",
  "REJECTED",
] as const
export const ASSET_VISIBILITIES = ["PRIVATE", "PUBLIC", "UNLISTED"] as const
export const ASSET_SOURCES = ["LEGACY_IMPORT", "ADMIN_UPLOAD", "PHOTOGRAPHER_UPLOAD"] as const
export const ASSET_MEDIA_TYPES = ["IMAGE", "VIDEO", "OTHER"] as const

export const PHOTOGRAPHER_PROFILE_SOURCES = [
  "LEGACY_IMPORT",
  "ADMIN_CREATED",
  "SELF_REGISTERED",
] as const

export const PHOTOGRAPHER_PROFILE_STATUSES = [
  "LEGACY_ONLY",
  "ACTIVE",
  "INACTIVE",
  "BLOCKED",
] as const

export const ASSET_IMPORT_BATCH_STATUSES = [
  "RUNNING",
  "COMPLETED",
  "COMPLETED_WITH_ISSUES",
  "FAILED",
  "CANCELLED",
] as const

export const ASSET_IMPORT_ISSUE_TYPES = [
  "MISSING_R2_OBJECT",
  "DUPLICATE_IMAGECODE",
  "MISSING_EVENT",
  "MISSING_CATEGORY",
  "MISSING_PHOTOGRAPHER",
  "INVALID_DATE",
  "UNKNOWN_STATUS",
  "IMPORT_ERROR",
] as const

export const ASSET_IMPORT_ISSUE_SEVERITIES = ["INFO", "WARNING", "ERROR"] as const

export type AssetStatus = (typeof ASSET_STATUSES)[number]
export type AssetVisibility = (typeof ASSET_VISIBILITIES)[number]
export type AssetSource = (typeof ASSET_SOURCES)[number]
export type AssetMediaType = (typeof ASSET_MEDIA_TYPES)[number]
export type PhotographerProfileSource = (typeof PHOTOGRAPHER_PROFILE_SOURCES)[number]
export type PhotographerProfileStatus = (typeof PHOTOGRAPHER_PROFILE_STATUSES)[number]
export type AssetImportBatchStatus = (typeof ASSET_IMPORT_BATCH_STATUSES)[number]
export type AssetImportIssueType = (typeof ASSET_IMPORT_ISSUE_TYPES)[number]
export type AssetImportIssueSeverity = (typeof ASSET_IMPORT_ISSUE_SEVERITIES)[number]
