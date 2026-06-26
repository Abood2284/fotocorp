export const STAFF_MEMBER_ROLES = [
  "SUPER_ADMIN",
  "CATALOG_MANAGER",
  "REVIEWER",
  "CAPTION_MANAGER",
  "CAPTION_WRITER",
  "FINANCE",
  "SUPPORT",
] as const

export type StaffMemberRole = (typeof STAFF_MEMBER_ROLES)[number]

export const HELP_CONTENT_MANAGER_ROLES = new Set<StaffMemberRole>(["SUPER_ADMIN", "CATALOG_MANAGER"])

export const HELP_ARTICLE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const
export type HelpArticleStatus = (typeof HELP_ARTICLE_STATUSES)[number]

export const HELP_ARTICLE_VISIBILITY = ["STAFF_ONLY"] as const
export type HelpArticleVisibility = (typeof HELP_ARTICLE_VISIBILITY)[number]

export const HELP_ARTICLE_DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const
export type HelpArticleDifficulty = (typeof HELP_ARTICLE_DIFFICULTIES)[number]

export const HELP_MEDIA_TYPES = ["IMAGE", "VIDEO"] as const
export type HelpMediaType = (typeof HELP_MEDIA_TYPES)[number]

export const HELP_MEDIA_UPLOAD_STATUSES = ["PENDING", "READY", "FAILED"] as const
export type HelpMediaUploadStatus = (typeof HELP_MEDIA_UPLOAD_STATUSES)[number]

export const HELP_CONTEXTUAL_PLACEMENTS = ["PAGE_HEADER", "SIDEBAR_CARD", "INLINE_PANEL"] as const
export type HelpContextualPlacement = (typeof HELP_CONTEXTUAL_PLACEMENTS)[number]

export const HELP_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
export const HELP_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const

export const HELP_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const HELP_VIDEO_MAX_BYTES = 100 * 1024 * 1024
export const HELP_VIDEO_MAX_DURATION_SECONDS = 5 * 60

export function canManageHelpContent(role: string): boolean {
  return HELP_CONTENT_MANAGER_ROLES.has(role as StaffMemberRole)
}

export function isArticleVisibleToStaffRole(audienceRoles: string[], staffRole: string): boolean {
  if (audienceRoles.length === 0) return true
  return audienceRoles.includes(staffRole)
}

export function slugifyHelpText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}
