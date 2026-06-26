export const HELP_CONTEXT_KEY_PATTERN = /^[a-z0-9]+(\.[a-z0-9-]+)+$/

export const HELP_CONTEXT_KEYS = [
  "staff.assets.upload",
  "staff.assets.list",
  "staff.assets.detail",
  "staff.assets.caption-edit",
  "staff.uploads.review",
  "staff.contributors.applications",
  "staff.customer-access.inquiries",
  "staff.download-logs.list",
  "staff.videos.upload",
  "staff.caricatures.upload",
  "staff.staff-management",
] as const

export type HelpContextKey = (typeof HELP_CONTEXT_KEYS)[number]

export function isValidHelpContextKey(value: string): value is HelpContextKey {
  return HELP_CONTEXT_KEY_PATTERN.test(value)
}
