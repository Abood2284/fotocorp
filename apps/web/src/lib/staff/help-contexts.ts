import { HELP_CONTEXT_KEYS } from "@/lib/staff/help-context-keys"

export const STAFF_HELP_CONTEXTS = [
  {
    key: "staff.assets.upload",
    label: "Asset upload",
    description: "Help shown on staff and contributor upload workflows.",
  },
  {
    key: "staff.assets.list",
    label: "Asset catalog",
    description: "Help shown while browsing and searching the staff catalog.",
  },
  {
    key: "staff.assets.detail",
    label: "Asset detail",
    description: "Help shown on individual asset metadata pages.",
  },
  {
    key: "staff.assets.caption-edit",
    label: "Caption editing",
    description: "Help shown on caption queue and caption editing workflows.",
  },
  {
    key: "staff.uploads.review",
    label: "Contributor upload review",
    description: "Help shown while reviewing contributor upload batches.",
  },
  {
    key: "staff.contributors.applications",
    label: "Contributor applications",
    description: "Help shown while reviewing contributor access applications.",
  },
  {
    key: "staff.customer-access.inquiries",
    label: "Customer access inquiries",
    description: "Help shown while reviewing customer access requests.",
  },
  {
    key: "staff.download-logs.list",
    label: "Download logs",
    description: "Help shown on download log review workflows.",
  },
  {
    key: "staff.videos.upload",
    label: "Video upload",
    description: "Help shown on event video or media upload pages.",
  },
  {
    key: "staff.caricatures.upload",
    label: "Caricature upload",
    description: "Help shown on caricature upload and review pages.",
  },
  {
    key: "staff.staff-management",
    label: "Staff management",
    description: "Help shown on staff user administration pages.",
  },
] as const satisfies ReadonlyArray<{
  key: (typeof HELP_CONTEXT_KEYS)[number]
  label: string
  description: string
}>

export function getStaffHelpContextLabel(contextKey: string) {
  return STAFF_HELP_CONTEXTS.find((context) => context.key === contextKey)?.label ?? contextKey
}

export function buildContextualHelpArticleHref(slug: string) {
  return `/staff/help/${encodeURIComponent(slug)}`
}
