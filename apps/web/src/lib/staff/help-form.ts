import type { HelpArticleManageDetail } from "@/lib/api/staff-help-api"

export const STAFF_HELP_ROLES = [
  "SUPER_ADMIN",
  "CATALOG_MANAGER",
  "REVIEWER",
  "CAPTION_MANAGER",
  "CAPTION_WRITER",
  "FINANCE",
  "SUPPORT",
] as const

export type StaffHelpRole = (typeof STAFF_HELP_ROLES)[number]

export const STAFF_HELP_ROLE_LABELS: Record<StaffHelpRole, string> = {
  SUPER_ADMIN: "Super Admin",
  CATALOG_MANAGER: "Catalog Manager",
  REVIEWER: "Reviewer",
  CAPTION_MANAGER: "Caption Manager",
  CAPTION_WRITER: "Caption Writer",
  FINANCE: "Finance",
  SUPPORT: "Support",
}

export const HELP_ARTICLE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const
export type HelpArticleStatus = (typeof HELP_ARTICLE_STATUSES)[number]

export const HELP_ARTICLE_DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const
export type HelpArticleDifficulty = (typeof HELP_ARTICLE_DIFFICULTIES)[number]

export function staffCanManageHelpContent(role: string) {
  return role === "SUPER_ADMIN" || role === "CATALOG_MANAGER"
}

export function slugifyHelpText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}

export function isValidHelpSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

export interface HelpArticleFormValues {
  title: string
  slug: string
  summary: string
  bodyMarkdown: string
  categoryId: string
  status: HelpArticleStatus
  audienceRoles: StaffHelpRole[]
  difficulty: HelpArticleDifficulty | ""
  estimatedMinutes: string
  sortOrder: string
  tagIds: string[]
  relatedArticleIds: string[]
}

export interface HelpArticleFormErrors {
  title?: string
  slug?: string
  summary?: string
  bodyMarkdown?: string
  categoryId?: string
  audienceRoles?: string
  estimatedMinutes?: string
  sortOrder?: string
}

export function createEmptyHelpArticleFormValues(): HelpArticleFormValues {
  return {
    title: "",
    slug: "",
    summary: "",
    bodyMarkdown: "",
    categoryId: "",
    status: "DRAFT",
    audienceRoles: [...STAFF_HELP_ROLES],
    difficulty: "BEGINNER",
    estimatedMinutes: "",
    sortOrder: "0",
    tagIds: [],
    relatedArticleIds: [],
  }
}

export function deriveSlugFromTitle(title: string, currentSlug: string, slugTouched: boolean) {
  if (slugTouched) return currentSlug
  return slugifyHelpText(title)
}

export function validateHelpArticleForm(values: HelpArticleFormValues): HelpArticleFormErrors {
  const errors: HelpArticleFormErrors = {}

  if (!values.title.trim()) errors.title = "Title is required."
  else if (values.title.trim().length > 200) errors.title = "Title must be at most 200 characters."

  if (!values.slug.trim()) errors.slug = "Slug is required."
  else if (!isValidHelpSlug(values.slug.trim())) {
    errors.slug = "Slug must use lowercase letters, numbers, and dashes only."
  }

  if (!values.summary.trim()) errors.summary = "Summary is required."
  else if (values.summary.trim().length > 500) errors.summary = "Summary must be at most 500 characters."

  if (!values.bodyMarkdown.trim()) errors.bodyMarkdown = "Body is required."
  else if (values.bodyMarkdown.trim().length > 100_000) {
    errors.bodyMarkdown = "Body must be at most 100,000 characters."
  }

  if (!values.categoryId) errors.categoryId = "Category is required."

  if (values.audienceRoles.length < 1) {
    errors.audienceRoles = "Select at least one staff role, or choose all staff roles."
  }

  if (values.estimatedMinutes.trim()) {
    const minutes = Number.parseInt(values.estimatedMinutes, 10)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
      errors.estimatedMinutes = "Estimated minutes must be between 1 and 240."
    }
  }

  if (values.sortOrder.trim()) {
    const sortOrder = Number.parseInt(values.sortOrder, 10)
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      errors.sortOrder = "Sort order must be zero or greater."
    }
  }

  return errors
}

export function buildHelpArticlePayload(values: HelpArticleFormValues, status: HelpArticleStatus) {
  const estimatedMinutes = values.estimatedMinutes.trim()
    ? Number.parseInt(values.estimatedMinutes, 10)
    : null
  const sortOrder = values.sortOrder.trim() ? Number.parseInt(values.sortOrder, 10) : 0

  return {
    categoryId: values.categoryId,
    title: values.title.trim(),
    slug: values.slug.trim(),
    summary: values.summary.trim(),
    bodyMarkdown: values.bodyMarkdown.trim(),
    status,
    visibility: "STAFF_ONLY" as const,
    audienceRoles: values.audienceRoles,
    difficulty: values.difficulty || null,
    estimatedMinutes,
    sortOrder,
    tagIds: values.tagIds,
    relatedArticleIds: values.relatedArticleIds.length ? values.relatedArticleIds : undefined,
  }
}

export function buildStaffHelpManageHref(filters: {
  q?: string
  status?: string
  category?: string
  tag?: string
}) {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set("q", filters.q.trim())
  if (filters.status?.trim()) params.set("status", filters.status.trim())
  if (filters.category?.trim()) params.set("category", filters.category.trim())
  if (filters.tag?.trim()) params.set("tag", filters.tag.trim())
  const query = params.toString()
  return query ? `/staff/help/manage?${query}` : "/staff/help/manage"
}

export function formatHelpAudienceRoles(roles: string[]) {
  if (!roles.length) return "All staff"
  return roles.map((role) => STAFF_HELP_ROLE_LABELS[role as StaffHelpRole] ?? role).join(", ")
}

export function helpArticleToFormValues(article: HelpArticleManageDetail): HelpArticleFormValues {
  return {
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    bodyMarkdown: article.bodyMarkdown,
    categoryId: article.categoryId,
    status: article.status as HelpArticleStatus,
    audienceRoles: article.audienceRoles as StaffHelpRole[],
    difficulty: (article.difficulty ?? "") as HelpArticleFormValues["difficulty"],
    estimatedMinutes: article.estimatedMinutes ? String(article.estimatedMinutes) : "",
    sortOrder: String(article.sortOrder ?? 0),
    tagIds: article.tags.map((tag) => tag.id),
    relatedArticleIds: article.relatedArticleIds,
  }
}
