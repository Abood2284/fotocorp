import { staffJson, StaffApiError } from "@/lib/api/staff-api"

export { StaffApiError }

export interface HelpCategorySummary {
  id: string
  name: string
  slug: string
  description: string | null
  displayOrder: number
  articleCount: number
}

export interface HelpTagSummary {
  id: string
  name: string
  slug: string
}

export interface HelpArticleListItem {
  id: string
  title: string
  slug: string
  summary: string
  category: {
    id: string
    name: string
    slug: string
    displayOrder: number
  }
  tags: HelpTagSummary[]
  status: string
  audienceRoles?: string[]
  difficulty: string | null
  estimatedMinutes: number | null
  publishedAt: string | null
  updatedAt: string
}

export interface HelpCategoryManageSummary extends HelpCategorySummary {
  isActive: boolean
  totalArticleCount: number
}

export interface HelpArticleManageDetail {
  id: string
  categoryId: string
  category: {
    id: string
    name: string
    slug: string
    displayOrder: number
  }
  title: string
  slug: string
  summary: string
  bodyMarkdown: string
  status: string
  visibility: string
  audienceRoles: string[]
  difficulty: string | null
  estimatedMinutes: number | null
  sortOrder: number
  publishedAt: string | null
  createdByStaffId: string
  updatedByStaffId: string
  createdAt: string
  updatedAt: string
  tags: HelpTagSummary[]
  media: HelpArticleMediaItem[]
  relatedArticleIds: string[]
}

export interface HelpArticleMediaItem {
  id: string
  mediaType: string
  title: string | null
  description: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  sortOrder: number
  uploadStatus?: string
  uploadedAt?: string | null
  displayUrl?: string | null
}

export interface HelpRelatedArticle {
  id: string
  title: string
  slug: string
  summary: string
}

export interface HelpArticleDetail extends HelpArticleListItem {
  bodyMarkdown: string
  visibility: string
  audienceRoles: string[]
  sortOrder: number
  media: HelpArticleMediaItem[]
  relatedArticles: HelpRelatedArticle[]
  createdByStaffId: string
  updatedByStaffId: string
  createdAt: string
}

export interface ListHelpArticlesOptions {
  cookieHeader?: string
  q?: string
  category?: string
  tag?: string
  status?: string
  limit?: number
  cursor?: string
}

export async function getStaffHelpCategories(options: { cookieHeader?: string } = {}) {
  return staffJson<{ ok: true; items: HelpCategorySummary[] }>("/help/categories", {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function getStaffHelpTags(options: { cookieHeader?: string } = {}) {
  return staffJson<{ ok: true; items: HelpTagSummary[] }>("/help/tags", {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function listStaffHelpArticles(options: ListHelpArticlesOptions = {}) {
  const params = new URLSearchParams()
  if (options.q) params.set("q", options.q)
  if (options.category) params.set("category", options.category)
  if (options.tag) params.set("tag", options.tag)
  if (options.status) params.set("status", options.status)
  if (options.limit) params.set("limit", String(options.limit))
  if (options.cursor) params.set("cursor", options.cursor)
  const query = params.toString() ? `?${params.toString()}` : ""
  return staffJson<{ ok: true; items: HelpArticleListItem[]; nextCursor: string | null }>(
    `/help/articles${query}`,
    {
      method: "GET",
      cookieHeader: options.cookieHeader,
    },
  )
}

export async function listStaffHelpArticlesForManage(options: ListHelpArticlesOptions = {}) {
  return listStaffHelpArticles({ ...options, limit: options.limit ?? 100 })
}

export async function getStaffHelpArticleForEdit(
  articleId: string,
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; article: HelpArticleManageDetail }>(
    `/help/manage/articles/${encodeURIComponent(articleId)}`,
    {
      method: "GET",
      cookieHeader: options.cookieHeader,
    },
  )
}

export async function getStaffHelpCategoriesForManage(options: { cookieHeader?: string } = {}) {
  return staffJson<{ ok: true; items: HelpCategoryManageSummary[] }>("/help/manage/categories", {
    method: "GET",
    cookieHeader: options.cookieHeader,
  })
}

export async function getStaffHelpArticleBySlug(
  slug: string,
  options: { cookieHeader?: string; searchQuery?: string } = {},
) {
  const params = new URLSearchParams()
  if (options.searchQuery) params.set("searchQuery", options.searchQuery)
  const query = params.toString() ? `?${params.toString()}` : ""
  return staffJson<{ ok: true; article: HelpArticleDetail }>(
    `/help/articles/${encodeURIComponent(slug)}${query}`,
    {
      method: "GET",
      cookieHeader: options.cookieHeader,
    },
  )
}

export async function submitStaffHelpArticleFeedback(
  articleId: string,
  body: { wasHelpful: boolean; comment?: string },
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; feedback: { id: string; wasHelpful: boolean; comment: string | null; createdAt: string } }>(
    `/help/articles/${encodeURIComponent(articleId)}/feedback`,
    {
      method: "POST",
      body,
      cookieHeader: options.cookieHeader,
    },
  )
}

export function buildStaffHelpHref(filters: { q?: string; category?: string; tag?: string }) {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set("q", filters.q.trim())
  if (filters.category?.trim()) params.set("category", filters.category.trim())
  if (filters.tag?.trim()) params.set("tag", filters.tag.trim())
  const query = params.toString()
  return query ? `/staff/help?${query}` : "/staff/help"
}

export interface ContextualHelpLinkArticleSummary {
  id: string
  title: string
  slug: string
  summary: string
  category: {
    id: string
    name: string
    slug: string
  }
  tags: HelpTagSummary[]
}

export interface StaffContextualHelpLink {
  id: string
  contextKey: string
  label: string
  description: string
  placement: "PAGE_HEADER" | "SIDEBAR_CARD" | "INLINE_PANEL"
  displayOrder: number
  article: ContextualHelpLinkArticleSummary
}

export interface ManageContextualHelpLink {
  id: string
  contextKey: string
  label: string | null
  description: string | null
  placement: "PAGE_HEADER" | "SIDEBAR_CARD" | "INLINE_PANEL"
  displayOrder: number
  isActive: boolean
  article: ContextualHelpLinkArticleSummary & { status: string }
  createdAt: string
  updatedAt: string
}

export async function listContextualHelpLinks(
  contextKey: string,
  options: {
    cookieHeader?: string
    placement?: "PAGE_HEADER" | "SIDEBAR_CARD" | "INLINE_PANEL"
    limit?: number
  } = {},
) {
  const params = new URLSearchParams({ contextKey })
  if (options.placement) params.set("placement", options.placement)
  if (options.limit) params.set("limit", String(options.limit))
  return staffJson<{ ok: true; items: StaffContextualHelpLink[] }>(
    `/help/contextual-links?${params.toString()}`,
    {
      method: "GET",
      cookieHeader: options.cookieHeader,
    },
  )
}

export async function listContextualHelpLinksForManage(
  filters: {
    cookieHeader?: string
    contextKey?: string
    articleId?: string
    isActive?: boolean
    limit?: number
  } = {},
) {
  const params = new URLSearchParams()
  if (filters.contextKey) params.set("contextKey", filters.contextKey)
  if (filters.articleId) params.set("articleId", filters.articleId)
  if (typeof filters.isActive === "boolean") params.set("isActive", String(filters.isActive))
  if (filters.limit) params.set("limit", String(filters.limit))
  const query = params.toString() ? `?${params.toString()}` : ""
  return staffJson<{ ok: true; items: ManageContextualHelpLink[] }>(
    `/help/manage/contextual-links${query}`,
    {
      method: "GET",
      cookieHeader: filters.cookieHeader,
    },
  )
}

export async function createContextualHelpLink(
  payload: {
    contextKey: string
    articleId: string
    label?: string | null
    description?: string | null
    placement?: "PAGE_HEADER" | "SIDEBAR_CARD" | "INLINE_PANEL"
    displayOrder?: number
    isActive?: boolean
  },
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; link: ManageContextualHelpLink }>("/help/manage/contextual-links", {
    method: "POST",
    body: payload,
    cookieHeader: options.cookieHeader,
  })
}

export async function updateContextualHelpLink(
  linkId: string,
  payload: {
    contextKey?: string
    articleId?: string
    label?: string | null
    description?: string | null
    placement?: "PAGE_HEADER" | "SIDEBAR_CARD" | "INLINE_PANEL"
    displayOrder?: number
    isActive?: boolean
  },
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; link: ManageContextualHelpLink }>(
    `/help/manage/contextual-links/${encodeURIComponent(linkId)}`,
    {
      method: "PATCH",
      body: payload,
      cookieHeader: options.cookieHeader,
    },
  )
}

export async function deactivateContextualHelpLink(
  linkId: string,
  options: { cookieHeader?: string } = {},
) {
  return staffJson<{ ok: true; id: string; isActive: false }>(
    `/help/manage/contextual-links/${encodeURIComponent(linkId)}`,
    {
      method: "DELETE",
      cookieHeader: options.cookieHeader,
    },
  )
}
