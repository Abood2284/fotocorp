import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { helpArticles, helpCategories, helpContextualLinks } from "../../db/schema/help-center"
import { AppError } from "../errors"
import { isArticleVisibleToStaffRole, type HelpContextualPlacement } from "./constants"
import { isValidHelpContextKey } from "./help-contexts"
import { loadTagsByArticleIds } from "./help-center-service"

export interface ContextualHelpLinkArticle {
  id: string
  title: string
  slug: string
  summary: string
  category: {
    id: string
    name: string
    slug: string
  }
  tags: Array<{ id: string; name: string; slug: string }>
}

export interface StaffContextualHelpLink {
  id: string
  contextKey: string
  label: string
  description: string
  placement: HelpContextualPlacement
  displayOrder: number
  article: ContextualHelpLinkArticle
}

export interface ManageContextualHelpLink {
  id: string
  contextKey: string
  label: string | null
  description: string | null
  placement: HelpContextualPlacement
  displayOrder: number
  isActive: boolean
  article: {
    id: string
    title: string
    slug: string
    status: string
    summary: string
    category: {
      id: string
      name: string
      slug: string
    }
    tags: Array<{ id: string; name: string; slug: string }>
  }
  createdAt: string
  updatedAt: string
}

function toIso(value: Date | string | null | undefined): string {
  if (value == null) return new Date(0).toISOString()
  return value instanceof Date ? value.toISOString() : String(value)
}

function audienceRolePredicate(staffRole: string): SQL {
  return sql`(
    cardinality(${helpArticles.audienceRoles}) = 0
    or ${staffRole} = any(${helpArticles.audienceRoles})
  )`
}

export function assertValidHelpContextKey(contextKey: string) {
  if (!isValidHelpContextKey(contextKey)) {
    throw new AppError(
      400,
      "INVALID_HELP_CONTEXT_KEY",
      "Context key must use lowercase dot-separated segments (for example staff.assets.upload).",
    )
  }
}

export function resolveContextualLinkLabel(label: string | null, articleTitle: string) {
  return label?.trim() || articleTitle
}

export function resolveContextualLinkDescription(description: string | null, articleSummary: string) {
  return description?.trim() || articleSummary
}

export function isContextualLinkVisibleToStaff(input: {
  linkActive: boolean
  articleStatus: string
  audienceRoles: string[]
  staffRole: string
}) {
  if (!input.linkActive) return false
  if (input.articleStatus !== "PUBLISHED") return false
  return isArticleVisibleToStaffRole(input.audienceRoles, input.staffRole)
}

async function loadManageArticleBundle(db: DrizzleClient, articleIds: string[]) {
  if (!articleIds.length) return new Map<string, ManageContextualHelpLink["article"]>()

  const rows = await db
    .select({
      id: helpArticles.id,
      title: helpArticles.title,
      slug: helpArticles.slug,
      status: helpArticles.status,
      summary: helpArticles.summary,
      categoryId: helpCategories.id,
      categoryName: helpCategories.name,
      categorySlug: helpCategories.slug,
    })
    .from(helpArticles)
    .innerJoin(helpCategories, eq(helpCategories.id, helpArticles.categoryId))
    .where(inArray(helpArticles.id, articleIds))

  const tagsByArticle = await loadTagsByArticleIds(db, articleIds)
  const map = new Map<string, ManageContextualHelpLink["article"]>()

  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      summary: row.summary,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug,
      },
      tags: tagsByArticle.get(row.id) ?? [],
    })
  }

  return map
}

export async function listContextualHelpLinksForStaff(
  db: DrizzleClient,
  input: {
    contextKey: string
    staffRole: string
    placement?: HelpContextualPlacement
    limit?: number
  },
): Promise<StaffContextualHelpLink[]> {
  assertValidHelpContextKey(input.contextKey)
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 20)

  const filters = [
    eq(helpContextualLinks.contextKey, input.contextKey),
    eq(helpContextualLinks.isActive, true),
    eq(helpArticles.status, "PUBLISHED"),
    audienceRolePredicate(input.staffRole),
  ]

  if (input.placement) {
    filters.push(eq(helpContextualLinks.placement, input.placement))
  }

  const rows = await db
    .select({
      id: helpContextualLinks.id,
      contextKey: helpContextualLinks.contextKey,
      label: helpContextualLinks.label,
      description: helpContextualLinks.description,
      placement: helpContextualLinks.placement,
      displayOrder: helpContextualLinks.displayOrder,
      articleId: helpArticles.id,
      articleTitle: helpArticles.title,
      articleSlug: helpArticles.slug,
      articleSummary: helpArticles.summary,
      categoryId: helpCategories.id,
      categoryName: helpCategories.name,
      categorySlug: helpCategories.slug,
    })
    .from(helpContextualLinks)
    .innerJoin(helpArticles, eq(helpArticles.id, helpContextualLinks.articleId))
    .innerJoin(helpCategories, eq(helpCategories.id, helpArticles.categoryId))
    .where(and(...filters))
    .orderBy(asc(helpContextualLinks.displayOrder), asc(helpArticles.title))
    .limit(limit)

  const tagsByArticle = await loadTagsByArticleIds(
    db,
    rows.map((row) => row.articleId),
  )

  return rows.map((row) => ({
    id: row.id,
    contextKey: row.contextKey,
    label: resolveContextualLinkLabel(row.label, row.articleTitle),
    description: resolveContextualLinkDescription(row.description, row.articleSummary),
    placement: row.placement as HelpContextualPlacement,
    displayOrder: row.displayOrder,
    article: {
      id: row.articleId,
      title: row.articleTitle,
      slug: row.articleSlug,
      summary: row.articleSummary,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug,
      },
      tags: tagsByArticle.get(row.articleId) ?? [],
    },
  }))
}

export async function listContextualHelpLinksForManage(
  db: DrizzleClient,
  input: {
    contextKey?: string
    articleId?: string
    isActive?: boolean
    limit?: number
  } = {},
): Promise<ManageContextualHelpLink[]> {
  const filters: SQL[] = []

  if (input.contextKey) {
    assertValidHelpContextKey(input.contextKey)
    filters.push(eq(helpContextualLinks.contextKey, input.contextKey))
  }
  if (input.articleId) filters.push(eq(helpContextualLinks.articleId, input.articleId))
  if (typeof input.isActive === "boolean") filters.push(eq(helpContextualLinks.isActive, input.isActive))

  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200)

  const rows = await db
    .select({
      id: helpContextualLinks.id,
      contextKey: helpContextualLinks.contextKey,
      label: helpContextualLinks.label,
      description: helpContextualLinks.description,
      placement: helpContextualLinks.placement,
      displayOrder: helpContextualLinks.displayOrder,
      isActive: helpContextualLinks.isActive,
      articleId: helpContextualLinks.articleId,
      createdAt: helpContextualLinks.createdAt,
      updatedAt: helpContextualLinks.updatedAt,
    })
    .from(helpContextualLinks)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(helpContextualLinks.contextKey), asc(helpContextualLinks.displayOrder), desc(helpContextualLinks.updatedAt))
    .limit(limit)

  const articlesById = await loadManageArticleBundle(
    db,
    rows.map((row) => row.articleId),
  )

  return rows
    .map((row) => {
      const article = articlesById.get(row.articleId)
      if (!article) return null
      return {
        id: row.id,
        contextKey: row.contextKey,
        label: row.label,
        description: row.description,
        placement: row.placement as HelpContextualPlacement,
        displayOrder: row.displayOrder,
        isActive: row.isActive,
        article,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      }
    })
    .filter((row): row is ManageContextualHelpLink => row != null)
}

async function assertArticleExists(db: DrizzleClient, articleId: string) {
  const [row] = await db
    .select({ id: helpArticles.id })
    .from(helpArticles)
    .where(eq(helpArticles.id, articleId))
    .limit(1)

  if (!row) {
    throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")
  }
}

export async function createContextualHelpLink(
  db: DrizzleClient,
  input: {
    contextKey: string
    articleId: string
    label?: string | null
    description?: string | null
    placement?: HelpContextualPlacement
    displayOrder?: number
    isActive?: boolean
    staffId: string
  },
) {
  assertValidHelpContextKey(input.contextKey)
  await assertArticleExists(db, input.articleId)

  try {
    const [row] = await db
      .insert(helpContextualLinks)
      .values({
        contextKey: input.contextKey,
        articleId: input.articleId,
        label: input.label?.trim() || null,
        description: input.description?.trim() || null,
        placement: input.placement ?? "PAGE_HEADER",
        displayOrder: input.displayOrder ?? 10,
        isActive: input.isActive ?? true,
        createdByStaffId: input.staffId,
        updatedByStaffId: input.staffId,
      })
      .returning({ id: helpContextualLinks.id })

    return row!
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        409,
        "HELP_CONTEXTUAL_LINK_DUPLICATE",
        "This article is already linked to that workflow context.",
      )
    }
    throw error
  }
}

export async function updateContextualHelpLink(
  db: DrizzleClient,
  linkId: string,
  input: {
    contextKey?: string
    articleId?: string
    label?: string | null
    description?: string | null
    placement?: HelpContextualPlacement
    displayOrder?: number
    isActive?: boolean
    staffId: string
  },
) {
  const [existing] = await db
    .select({ id: helpContextualLinks.id })
    .from(helpContextualLinks)
    .where(eq(helpContextualLinks.id, linkId))
    .limit(1)

  if (!existing) {
    throw new AppError(404, "HELP_CONTEXTUAL_LINK_NOT_FOUND", "Contextual help link was not found.")
  }

  if (input.contextKey) assertValidHelpContextKey(input.contextKey)
  if (input.articleId) await assertArticleExists(db, input.articleId)

  const updates: {
    contextKey?: string
    articleId?: string
    label?: string | null
    description?: string | null
    placement?: HelpContextualPlacement
    displayOrder?: number
    isActive?: boolean
    updatedByStaffId: string
    updatedAt: Date
  } = {
    updatedByStaffId: input.staffId,
    updatedAt: new Date(),
  }

  if (input.contextKey !== undefined) updates.contextKey = input.contextKey
  if (input.articleId !== undefined) updates.articleId = input.articleId
  if (input.label !== undefined) updates.label = input.label?.trim() || null
  if (input.description !== undefined) updates.description = input.description?.trim() || null
  if (input.placement !== undefined) updates.placement = input.placement
  if (input.displayOrder !== undefined) updates.displayOrder = input.displayOrder
  if (input.isActive !== undefined) updates.isActive = input.isActive

  try {
    await db.update(helpContextualLinks).set(updates).where(eq(helpContextualLinks.id, linkId))
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        409,
        "HELP_CONTEXTUAL_LINK_DUPLICATE",
        "This article is already linked to that workflow context.",
      )
    }
    throw error
  }

  const items = await listContextualHelpLinksForManage(db, { limit: 200 })
  const updated = items.find((item) => item.id === linkId)
  if (!updated) {
    throw new AppError(404, "HELP_CONTEXTUAL_LINK_NOT_FOUND", "Contextual help link was not found.")
  }
  return updated
}

export async function deactivateContextualHelpLink(
  db: DrizzleClient,
  linkId: string,
  staffId: string,
) {
  const [existing] = await db
    .select({ id: helpContextualLinks.id })
    .from(helpContextualLinks)
    .where(eq(helpContextualLinks.id, linkId))
    .limit(1)

  if (!existing) {
    throw new AppError(404, "HELP_CONTEXTUAL_LINK_NOT_FOUND", "Contextual help link was not found.")
  }

  await db
    .update(helpContextualLinks)
    .set({
      isActive: false,
      updatedByStaffId: staffId,
      updatedAt: new Date(),
    })
    .where(eq(helpContextualLinks.id, linkId))

  return { ok: true as const, id: linkId, isActive: false }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  )
}
