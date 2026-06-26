import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import {
  helpArticleFeedback,
  helpArticleMedia,
  helpArticleRelated,
  helpArticles,
  helpArticleTags,
  helpArticleViews,
  helpCategories,
  helpTags,
} from "../../db/schema/help-center"
import { AppError } from "../errors"
import {
  canManageHelpContent,
  isArticleVisibleToStaffRole,
  type HelpArticleDifficulty,
  type HelpArticleStatus,
  type HelpArticleVisibility,
  type HelpMediaType,
} from "./constants"
import {
  loadHelpArticleMediaForManage,
  loadHelpArticleMediaForRead,
} from "./help-media-service"

export interface HelpCategorySummary {
  id: string
  name: string
  slug: string
  description: string | null
  displayOrder: number
  articleCount: number
}

export interface HelpCategoryManageSummary extends HelpCategorySummary {
  isActive: boolean
  totalArticleCount: number
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
  audienceRoles: string[]
  difficulty: string | null
  estimatedMinutes: number | null
  publishedAt: string | null
  updatedAt: string
}

export interface HelpArticleDetail extends HelpArticleListItem {
  bodyMarkdown: string
  visibility: string
  sortOrder: number
  media: HelpArticleMediaItem[]
  relatedArticles: HelpArticleRelatedItem[]
  createdByStaffId: string
  updatedByStaffId: string
  createdAt: string
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
  displayUrl?: string
  uploadStatus?: string
  uploadedAt?: string | null
}

export interface HelpArticleRelatedItem {
  id: string
  title: string
  slug: string
  summary: string
}

export interface ListHelpArticlesInput {
  staffRole: string
  canManage: boolean
  q?: string
  categorySlug?: string
  tagSlug?: string
  status?: HelpArticleStatus
  role?: string
  limit: number
  cursor?: string | null
}

export interface ListHelpArticlesResult {
  items: HelpArticleListItem[]
  nextCursor: string | null
}

export interface HelpArticleMediaInput {
  mediaType: HelpMediaType
  title?: string | null
  description?: string | null
  storageKey?: string | null
  mimeType?: string | null
  fileSizeBytes?: number | null
  durationSeconds?: number | null
  width?: number | null
  height?: number | null
  sortOrder?: number
}

export interface CreateHelpArticleInput {
  categoryId: string
  title: string
  slug: string
  summary: string
  bodyMarkdown: string
  status: HelpArticleStatus
  visibility?: HelpArticleVisibility
  audienceRoles: string[]
  difficulty?: HelpArticleDifficulty | null
  estimatedMinutes?: number | null
  sortOrder?: number
  tagIds?: string[]
  media?: HelpArticleMediaInput[]
  relatedArticleIds?: string[]
  createdByStaffId: string
}

export interface UpdateHelpArticleInput {
  articleId: string
  categoryId?: string
  title?: string
  slug?: string
  summary?: string
  bodyMarkdown?: string
  status?: HelpArticleStatus
  audienceRoles?: string[]
  difficulty?: HelpArticleDifficulty | null
  estimatedMinutes?: number | null
  sortOrder?: number
  tagIds?: string[]
  media?: HelpArticleMediaInput[]
  relatedArticleIds?: string[]
  updatedByStaffId: string
}

interface ArticleListCursor {
  categoryDisplayOrder: number
  sortOrder: number
  publishedAt: string | null
  title: string
  id: string
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

function audienceRolePredicate(staffRole: string): SQL {
  return sql`(
    cardinality(${helpArticles.audienceRoles}) = 0
    or ${staffRole} = any(${helpArticles.audienceRoles})
  )`
}

function buildSearchPredicate(query: string): SQL {
  const pattern = `%${query.trim()}%`
  return or(
    ilike(helpArticles.title, pattern),
    ilike(helpArticles.summary, pattern),
    ilike(helpArticles.bodyMarkdown, pattern),
    sql`exists (
      select 1
      from help_article_tags hat
      join help_tags ht on ht.id = hat.tag_id
      where hat.article_id = ${helpArticles.id}
        and (
          ht.slug ilike ${pattern}
          or ht.name ilike ${pattern}
        )
    )`,
  )!
}

function resolveStatusFilter(input: ListHelpArticlesInput): HelpArticleStatus | undefined {
  if (input.canManage) return input.status
  return "PUBLISHED"
}

export function encodeHelpArticleCursor(cursor: ArticleListCursor): string {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

export function decodeHelpArticleCursor(value: string): ArticleListCursor {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
    const parsed = JSON.parse(atob(padded)) as Partial<ArticleListCursor>
    if (
      typeof parsed.categoryDisplayOrder !== "number" ||
      typeof parsed.sortOrder !== "number" ||
      typeof parsed.title !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("invalid cursor")
    }
    return {
      categoryDisplayOrder: parsed.categoryDisplayOrder,
      sortOrder: parsed.sortOrder,
      publishedAt: parsed.publishedAt ?? null,
      title: parsed.title,
      id: parsed.id,
    }
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "The pagination cursor is invalid.")
  }
}

export async function listHelpCategoriesWithCounts(
  db: DrizzleClient,
  staffRole: string,
): Promise<HelpCategorySummary[]> {
  const rows = await db
    .select({
      id: helpCategories.id,
      name: helpCategories.name,
      slug: helpCategories.slug,
      description: helpCategories.description,
      displayOrder: helpCategories.displayOrder,
      articleCount: sql<number>`count(${helpArticles.id})::int`,
    })
    .from(helpCategories)
    .leftJoin(
      helpArticles,
      and(
        eq(helpArticles.categoryId, helpCategories.id),
        eq(helpArticles.status, "PUBLISHED"),
        audienceRolePredicate(staffRole),
      ),
    )
    .where(eq(helpCategories.isActive, true))
    .groupBy(
      helpCategories.id,
      helpCategories.name,
      helpCategories.slug,
      helpCategories.description,
      helpCategories.displayOrder,
    )
    .orderBy(asc(helpCategories.displayOrder), asc(helpCategories.name))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    displayOrder: row.displayOrder,
    articleCount: row.articleCount,
  }))
}

export async function listHelpCategoriesForManage(db: DrizzleClient): Promise<HelpCategoryManageSummary[]> {
  const rows = await db
    .select({
      id: helpCategories.id,
      name: helpCategories.name,
      slug: helpCategories.slug,
      description: helpCategories.description,
      displayOrder: helpCategories.displayOrder,
      isActive: helpCategories.isActive,
      publishedCount: sql<number>`count(${helpArticles.id}) filter (where ${helpArticles.status} = 'PUBLISHED')::int`,
      totalCount: sql<number>`count(${helpArticles.id})::int`,
    })
    .from(helpCategories)
    .leftJoin(helpArticles, eq(helpArticles.categoryId, helpCategories.id))
    .groupBy(
      helpCategories.id,
      helpCategories.name,
      helpCategories.slug,
      helpCategories.description,
      helpCategories.displayOrder,
      helpCategories.isActive,
    )
    .orderBy(asc(helpCategories.displayOrder), asc(helpCategories.name))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    articleCount: row.publishedCount,
    totalArticleCount: row.totalCount,
  }))
}

export async function getHelpArticleForManageById(db: DrizzleClient, articleId: string) {
  const row = await getHelpArticleById(db, articleId)
  if (!row) throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")

  const categoryRows = await db
    .select({
      id: helpCategories.id,
      name: helpCategories.name,
      slug: helpCategories.slug,
      displayOrder: helpCategories.displayOrder,
    })
    .from(helpCategories)
    .where(eq(helpCategories.id, row.categoryId))
    .limit(1)

  const category = categoryRows[0]
  if (!category) throw new AppError(404, "HELP_CATEGORY_NOT_FOUND", "Help category was not found.")

  const [tagsByArticle, media, relatedArticleIds] = await Promise.all([
    loadTagsByArticleIds(db, [row.id]),
    loadHelpArticleMediaForManage(db, row.id),
    loadRelatedArticleIds(db, row.id),
  ])

  return {
    id: row.id,
    categoryId: row.categoryId,
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      displayOrder: category.displayOrder,
    },
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    bodyMarkdown: row.bodyMarkdown,
    status: row.status,
    visibility: row.visibility,
    audienceRoles: row.audienceRoles,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimatedMinutes,
    sortOrder: row.sortOrder,
    publishedAt: toIso(row.publishedAt),
    createdByStaffId: row.createdByStaffId,
    updatedByStaffId: row.updatedByStaffId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    tags: tagsByArticle.get(row.id) ?? [],
    media,
    relatedArticleIds,
  }
}

export async function listHelpTags(db: DrizzleClient): Promise<HelpTagSummary[]> {
  const rows = await db
    .select({
      id: helpTags.id,
      name: helpTags.name,
      slug: helpTags.slug,
    })
    .from(helpTags)
    .orderBy(asc(helpTags.name))

  return rows
}

export async function listHelpArticles(
  db: DrizzleClient,
  input: ListHelpArticlesInput,
): Promise<ListHelpArticlesResult> {
  const statusFilter = resolveStatusFilter(input)
  const filters: SQL[] = []

  if (!input.canManage) {
    filters.push(audienceRolePredicate(input.staffRole))
  }

  if (statusFilter) filters.push(eq(helpArticles.status, statusFilter))
  if (input.categorySlug) {
    filters.push(eq(helpCategories.slug, input.categorySlug))
  }
  if (input.tagSlug) {
    filters.push(
      sql`exists (
        select 1
        from help_article_tags hat
        join help_tags ht on ht.id = hat.tag_id
        where hat.article_id = ${helpArticles.id}
          and ht.slug = ${input.tagSlug}
      )`,
    )
  }
  if (input.role) {
    filters.push(
      sql`(
        cardinality(${helpArticles.audienceRoles}) = 0
        or ${input.role} = any(${helpArticles.audienceRoles})
      )`,
    )
  }
  if (input.q?.trim()) {
    filters.push(buildSearchPredicate(input.q))
  }

  if (input.cursor) {
    const cursor = decodeHelpArticleCursor(input.cursor)
    filters.push(
      sql`(
        ${helpCategories.displayOrder},
        ${helpArticles.sortOrder},
        coalesce(${helpArticles.publishedAt}, 'epoch'::timestamptz),
        ${helpArticles.title},
        ${helpArticles.id}
      ) > (
        ${cursor.categoryDisplayOrder},
        ${cursor.sortOrder},
        coalesce(${cursor.publishedAt}::timestamptz, 'epoch'::timestamptz),
        ${cursor.title},
        ${cursor.id}::uuid
      )`,
    )
  }

  const rows = await db
    .select({
      id: helpArticles.id,
      title: helpArticles.title,
      slug: helpArticles.slug,
      summary: helpArticles.summary,
      status: helpArticles.status,
      difficulty: helpArticles.difficulty,
      estimatedMinutes: helpArticles.estimatedMinutes,
      publishedAt: helpArticles.publishedAt,
      updatedAt: helpArticles.updatedAt,
      sortOrder: helpArticles.sortOrder,
      audienceRoles: helpArticles.audienceRoles,
      categoryId: helpCategories.id,
      categoryName: helpCategories.name,
      categorySlug: helpCategories.slug,
      categoryDisplayOrder: helpCategories.displayOrder,
    })
    .from(helpArticles)
    .innerJoin(helpCategories, eq(helpCategories.id, helpArticles.categoryId))
    .where(and(...filters))
    .orderBy(
      asc(helpCategories.displayOrder),
      asc(helpArticles.sortOrder),
      desc(helpArticles.publishedAt),
      asc(helpArticles.title),
      asc(helpArticles.id),
    )
    .limit(input.limit + 1)

  const pageRows = rows.slice(0, input.limit)
  const articleIds = pageRows.map((row) => row.id)
  const tagsByArticle = await loadTagsByArticleIds(db, articleIds)

  const items: HelpArticleListItem[] = pageRows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
      displayOrder: row.categoryDisplayOrder,
    },
    tags: tagsByArticle.get(row.id) ?? [],
    status: row.status,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimatedMinutes,
    audienceRoles: row.audienceRoles,
    publishedAt: toIso(row.publishedAt),
    updatedAt: toIso(row.updatedAt) ?? new Date(0).toISOString(),
  }))

  const last = pageRows.at(-1)
  const nextCursor =
    rows.length > input.limit && last
      ? encodeHelpArticleCursor({
          categoryDisplayOrder: last.categoryDisplayOrder,
          sortOrder: last.sortOrder,
          publishedAt: toIso(last.publishedAt),
          title: last.title,
          id: last.id,
        })
      : null

  return { items, nextCursor }
}

export async function getHelpArticleBySlug(
  db: DrizzleClient,
  slug: string,
  staff: { id: string; role: string },
  options: { searchQuery?: string | null; recordView?: boolean },
): Promise<HelpArticleDetail> {
  const rows = await db
    .select({
      id: helpArticles.id,
      title: helpArticles.title,
      slug: helpArticles.slug,
      summary: helpArticles.summary,
      bodyMarkdown: helpArticles.bodyMarkdown,
      status: helpArticles.status,
      visibility: helpArticles.visibility,
      audienceRoles: helpArticles.audienceRoles,
      difficulty: helpArticles.difficulty,
      estimatedMinutes: helpArticles.estimatedMinutes,
      sortOrder: helpArticles.sortOrder,
      publishedAt: helpArticles.publishedAt,
      createdAt: helpArticles.createdAt,
      updatedAt: helpArticles.updatedAt,
      createdByStaffId: helpArticles.createdByStaffId,
      updatedByStaffId: helpArticles.updatedByStaffId,
      categoryId: helpCategories.id,
      categoryName: helpCategories.name,
      categorySlug: helpCategories.slug,
      categoryDisplayOrder: helpCategories.displayOrder,
    })
    .from(helpArticles)
    .innerJoin(helpCategories, eq(helpCategories.id, helpArticles.categoryId))
    .where(eq(helpArticles.slug, slug))
    .limit(1)

  const row = rows[0]
  if (!row) throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")

  if (!canManageHelpContent(staff.role) && row.status !== "PUBLISHED") {
    throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")
  }

  if (!isArticleVisibleToStaffRole(row.audienceRoles, staff.role)) {
    throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")
  }

  const [tagsByArticle, media, relatedArticles] = await Promise.all([
    loadTagsByArticleIds(db, [row.id]),
    loadHelpArticleMediaForRead(db, row.id),
    loadRelatedArticles(db, row.id, staff.role),
  ])

  if (options.recordView !== false) {
    await recordHelpArticleView(db, {
      articleId: row.id,
      staffId: staff.id,
      searchQuery: options.searchQuery ?? null,
    })
  }

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    bodyMarkdown: row.bodyMarkdown,
    visibility: row.visibility,
    audienceRoles: row.audienceRoles,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
      displayOrder: row.categoryDisplayOrder,
    },
    tags: tagsByArticle.get(row.id) ?? [],
    status: row.status,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimatedMinutes,
    sortOrder: row.sortOrder,
    publishedAt: toIso(row.publishedAt),
    updatedAt: toIso(row.updatedAt) ?? new Date(0).toISOString(),
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    media,
    relatedArticles,
    createdByStaffId: row.createdByStaffId,
    updatedByStaffId: row.updatedByStaffId,
  }
}

export async function getHelpArticleById(db: DrizzleClient, articleId: string) {
  const rows = await db.select().from(helpArticles).where(eq(helpArticles.id, articleId)).limit(1)
  return rows[0] ?? null
}

export async function submitHelpArticleFeedback(
  db: DrizzleClient,
  input: {
    articleId: string
    staff: { id: string; role: string }
    wasHelpful: boolean
    comment?: string | null
  },
) {
  const article = await getHelpArticleById(db, input.articleId)
  if (!article) throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")

  if (!canManageHelpContent(input.staff.role) && article.status !== "PUBLISHED") {
    throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")
  }

  if (!isArticleVisibleToStaffRole(article.audienceRoles, input.staff.role)) {
    throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")
  }

  const [feedback] = await db
    .insert(helpArticleFeedback)
    .values({
      articleId: input.articleId,
      staffId: input.staff.id,
      wasHelpful: input.wasHelpful,
      comment: input.comment ?? null,
    })
    .onConflictDoUpdate({
      target: [helpArticleFeedback.articleId, helpArticleFeedback.staffId],
      set: {
        wasHelpful: input.wasHelpful,
        comment: input.comment ?? null,
        createdAt: sql`now()`,
      },
    })
    .returning({
      id: helpArticleFeedback.id,
      wasHelpful: helpArticleFeedback.wasHelpful,
      comment: helpArticleFeedback.comment,
      createdAt: helpArticleFeedback.createdAt,
    })

  return {
    id: feedback.id,
    wasHelpful: feedback.wasHelpful,
    comment: feedback.comment,
    createdAt: toIso(feedback.createdAt),
  }
}

export async function recordHelpArticleView(
  db: DrizzleClient,
  input: { articleId: string; staffId: string; searchQuery?: string | null },
) {
  await db.insert(helpArticleViews).values({
    articleId: input.articleId,
    staffId: input.staffId,
    searchQuery: input.searchQuery ?? null,
  })
}

export async function createHelpArticle(db: DrizzleClient, input: CreateHelpArticleInput) {
  await assertCategoryExists(db, input.categoryId)
  await assertUniqueArticleSlug(db, input.slug)
  if (input.tagIds?.length) await assertTagsExist(db, input.tagIds)
  if (input.relatedArticleIds?.length) await assertRelatedArticlesExist(db, input.relatedArticleIds)

  const publishedAt = input.status === "PUBLISHED" ? new Date() : null
  const [article] = await db
    .insert(helpArticles)
    .values({
      categoryId: input.categoryId,
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      bodyMarkdown: input.bodyMarkdown,
      status: input.status,
      visibility: input.visibility ?? "STAFF_ONLY",
      audienceRoles: input.audienceRoles,
      difficulty: input.difficulty ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdByStaffId: input.createdByStaffId,
      updatedByStaffId: input.createdByStaffId,
      publishedAt,
    })
    .returning({ id: helpArticles.id })

  await replaceArticleTags(db, article.id, input.tagIds ?? [])
  await replaceArticleMedia(db, article.id, input.media ?? [])
  await replaceRelatedArticles(db, article.id, input.relatedArticleIds ?? [])

  return getHelpArticleById(db, article.id)
}

export async function updateHelpArticle(db: DrizzleClient, input: UpdateHelpArticleInput) {
  const existing = await getHelpArticleById(db, input.articleId)
  if (!existing) throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")

  if (input.categoryId) await assertCategoryExists(db, input.categoryId)
  if (input.slug && input.slug !== existing.slug) await assertUniqueArticleSlug(db, input.slug)
  if (input.tagIds) await assertTagsExist(db, input.tagIds)
  if (input.relatedArticleIds) await assertRelatedArticlesExist(db, input.relatedArticleIds)

  const nextStatus = input.status ?? existing.status
  let publishedAt = existing.publishedAt
  if (nextStatus === "PUBLISHED" && existing.status !== "PUBLISHED" && !publishedAt) {
    publishedAt = new Date()
  }

  await db
    .update(helpArticles)
    .set({
      categoryId: input.categoryId,
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      bodyMarkdown: input.bodyMarkdown,
      status: input.status,
      audienceRoles: input.audienceRoles,
      difficulty: input.difficulty === undefined ? undefined : input.difficulty,
      estimatedMinutes: input.estimatedMinutes === undefined ? undefined : input.estimatedMinutes,
      sortOrder: input.sortOrder,
      updatedByStaffId: input.updatedByStaffId,
      publishedAt,
      updatedAt: sql`now()`,
    })
    .where(eq(helpArticles.id, input.articleId))

  if (input.tagIds) await replaceArticleTags(db, input.articleId, input.tagIds)
  if (input.media) await replaceArticleMedia(db, input.articleId, input.media)
  if (input.relatedArticleIds) await replaceRelatedArticles(db, input.articleId, input.relatedArticleIds)

  return getHelpArticleById(db, input.articleId)
}

export async function createHelpCategory(
  db: DrizzleClient,
  input: {
    name: string
    slug: string
    description?: string | null
    displayOrder?: number
    isActive?: boolean
  },
) {
  await assertUniqueCategorySlug(db, input.slug)
  const [row] = await db
    .insert(helpCategories)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    })
    .returning()

  return serializeCategory(row)
}

export async function updateHelpCategory(
  db: DrizzleClient,
  categoryId: string,
  input: {
    name?: string
    slug?: string
    description?: string | null
    displayOrder?: number
    isActive?: boolean
  },
) {
  const existing = await db.select().from(helpCategories).where(eq(helpCategories.id, categoryId)).limit(1)
  if (!existing[0]) throw new AppError(404, "HELP_CATEGORY_NOT_FOUND", "Help category was not found.")
  if (input.slug && input.slug !== existing[0].slug) await assertUniqueCategorySlug(db, input.slug)

  const [row] = await db
    .update(helpCategories)
    .set({
      name: input.name,
      slug: input.slug,
      description: input.description === undefined ? undefined : input.description,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
      updatedAt: sql`now()`,
    })
    .where(eq(helpCategories.id, categoryId))
    .returning()

  return serializeCategory(row)
}

export async function createHelpTag(
  db: DrizzleClient,
  input: { name: string; slug: string },
) {
  await assertUniqueTagSlug(db, input.slug)
  await assertUniqueTagName(db, input.name)

  const [row] = await db
    .insert(helpTags)
    .values({
      name: input.name,
      slug: input.slug,
    })
    .returning()

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

export async function loadTagsByArticleIds(db: DrizzleClient, articleIds: string[]) {
  const map = new Map<string, HelpTagSummary[]>()
  if (!articleIds.length) return map

  const rows = await db
    .select({
      articleId: helpArticleTags.articleId,
      id: helpTags.id,
      name: helpTags.name,
      slug: helpTags.slug,
    })
    .from(helpArticleTags)
    .innerJoin(helpTags, eq(helpTags.id, helpArticleTags.tagId))
    .where(inArray(helpArticleTags.articleId, articleIds))
    .orderBy(asc(helpTags.name))

  for (const row of rows) {
    const current = map.get(row.articleId) ?? []
    current.push({ id: row.id, name: row.name, slug: row.slug })
    map.set(row.articleId, current)
  }

  return map
}

export async function loadArticleMedia(db: DrizzleClient, articleId: string): Promise<HelpArticleMediaItem[]> {
  return loadHelpArticleMediaForRead(db, articleId)
}

async function loadRelatedArticleIds(db: DrizzleClient, articleId: string): Promise<string[]> {
  const rows = await db
    .select({ relatedArticleId: helpArticleRelated.relatedArticleId })
    .from(helpArticleRelated)
    .where(eq(helpArticleRelated.articleId, articleId))

  return rows.map((row) => row.relatedArticleId)
}

async function loadRelatedArticles(
  db: DrizzleClient,
  articleId: string,
  staffRole: string,
): Promise<HelpArticleRelatedItem[]> {
  const rows = await db
    .select({
      id: helpArticles.id,
      title: helpArticles.title,
      slug: helpArticles.slug,
      summary: helpArticles.summary,
    })
    .from(helpArticleRelated)
    .innerJoin(helpArticles, eq(helpArticles.id, helpArticleRelated.relatedArticleId))
    .where(
      and(
        eq(helpArticleRelated.articleId, articleId),
        eq(helpArticles.status, "PUBLISHED"),
        audienceRolePredicate(staffRole),
      ),
    )
    .orderBy(asc(helpArticles.title))

  return rows
}

async function replaceArticleTags(db: DrizzleClient, articleId: string, tagIds: string[]) {
  await db.delete(helpArticleTags).where(eq(helpArticleTags.articleId, articleId))
  if (!tagIds.length) return

  await db.insert(helpArticleTags).values(
    tagIds.map((tagId) => ({
      articleId,
      tagId,
    })),
  )
}

async function replaceArticleMedia(db: DrizzleClient, articleId: string, media: HelpArticleMediaInput[]) {
  await db.delete(helpArticleMedia).where(eq(helpArticleMedia.articleId, articleId))
  if (!media.length) return

  await db.insert(helpArticleMedia).values(
    media.map((item, index) => ({
      articleId,
      mediaType: item.mediaType,
      title: item.title ?? null,
      description: item.description ?? null,
      storageKey: item.storageKey ?? null,
      mimeType: item.mimeType ?? null,
      fileSizeBytes: item.fileSizeBytes ?? null,
      durationSeconds: item.durationSeconds ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      sortOrder: item.sortOrder ?? index,
    })),
  )
}

async function replaceRelatedArticles(db: DrizzleClient, articleId: string, relatedArticleIds: string[]) {
  const uniqueRelatedIds = [...new Set(relatedArticleIds.filter((id) => id !== articleId))]
  await db.delete(helpArticleRelated).where(eq(helpArticleRelated.articleId, articleId))
  if (!uniqueRelatedIds.length) return

  await db.insert(helpArticleRelated).values(
    uniqueRelatedIds.map((relatedArticleId) => ({
      articleId,
      relatedArticleId,
    })),
  )
}

async function assertCategoryExists(db: DrizzleClient, categoryId: string) {
  const rows = await db.select({ id: helpCategories.id }).from(helpCategories).where(eq(helpCategories.id, categoryId)).limit(1)
  if (!rows[0]) throw new AppError(404, "HELP_CATEGORY_NOT_FOUND", "Help category was not found.")
}

async function assertTagsExist(db: DrizzleClient, tagIds: string[]) {
  const rows = await db
    .select({ id: helpTags.id })
    .from(helpTags)
    .where(inArray(helpTags.id, tagIds))

  if (rows.length !== tagIds.length) {
    throw new AppError(400, "HELP_TAG_NOT_FOUND", "One or more help tags were not found.")
  }
}

async function assertRelatedArticlesExist(db: DrizzleClient, relatedArticleIds: string[]) {
  const uniqueIds = [...new Set(relatedArticleIds)]
  const rows = await db
    .select({ id: helpArticles.id })
    .from(helpArticles)
    .where(inArray(helpArticles.id, uniqueIds))

  if (rows.length !== uniqueIds.length) {
    throw new AppError(400, "HELP_ARTICLE_NOT_FOUND", "One or more related help articles were not found.")
  }
}

async function assertUniqueArticleSlug(db: DrizzleClient, slug: string) {
  const rows = await db.select({ id: helpArticles.id }).from(helpArticles).where(eq(helpArticles.slug, slug)).limit(1)
  if (rows[0]) throw new AppError(409, "HELP_ARTICLE_SLUG_TAKEN", "An article with this slug already exists.")
}

async function assertUniqueCategorySlug(db: DrizzleClient, slug: string) {
  const rows = await db.select({ id: helpCategories.id }).from(helpCategories).where(eq(helpCategories.slug, slug)).limit(1)
  if (rows[0]) throw new AppError(409, "HELP_CATEGORY_SLUG_TAKEN", "A category with this slug already exists.")
}

async function assertUniqueTagSlug(db: DrizzleClient, slug: string) {
  const rows = await db.select({ id: helpTags.id }).from(helpTags).where(eq(helpTags.slug, slug)).limit(1)
  if (rows[0]) throw new AppError(409, "HELP_TAG_SLUG_TAKEN", "A tag with this slug already exists.")
}

async function assertUniqueTagName(db: DrizzleClient, name: string) {
  const rows = await db.select({ id: helpTags.id }).from(helpTags).where(eq(helpTags.name, name)).limit(1)
  if (rows[0]) throw new AppError(409, "HELP_TAG_NAME_TAKEN", "A tag with this name already exists.")
}

function serializeCategory(row: typeof helpCategories.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

export function serializeHelpArticleRecord(
  row: typeof helpArticles.$inferSelect,
  extras?: {
    tags?: HelpTagSummary[]
    media?: HelpArticleMediaItem[]
    relatedArticleIds?: string[]
  },
) {
  return {
    id: row.id,
    categoryId: row.categoryId,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    bodyMarkdown: row.bodyMarkdown,
    status: row.status,
    visibility: row.visibility,
    audienceRoles: row.audienceRoles,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimatedMinutes,
    sortOrder: row.sortOrder,
    publishedAt: toIso(row.publishedAt),
    createdByStaffId: row.createdByStaffId,
    updatedByStaffId: row.updatedByStaffId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    tags: extras?.tags ?? [],
    media: extras?.media ?? [],
    relatedArticleIds: extras?.relatedArticleIds ?? [],
  }
}
