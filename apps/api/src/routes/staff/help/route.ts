import type { Context } from "hono"
import { zValidator } from "@hono/zod-validator"
import { getCookie } from "hono/cookie"
import { Hono } from "hono"
import type { Env } from "../../../appTypes"
import type { AppRequestVariables } from "../../../db"
import { createHttpDb } from "../../../db"
import { AppError } from "../../../lib/errors"
import {
  canManageHelpContent,
  slugifyHelpText,
} from "../../../lib/help-center/constants"
import {
  confirmHelpMediaUpload,
  createHelpMediaUploadIntent,
  deleteHelpMedia,
  getHelpMediaDeliveryResponse,
  reorderHelpMedia,
  updateHelpMediaMetadata,
} from "../../../lib/help-center/help-media-service"
import {
  createHelpArticle,
  createHelpCategory,
  createHelpTag,
  getHelpArticleBySlug,
  getHelpArticleForManageById,
  listHelpArticles,
  listHelpCategoriesForManage,
  listHelpCategoriesWithCounts,
  listHelpTags,
  loadArticleMedia,
  loadTagsByArticleIds,
  serializeHelpArticleRecord,
  submitHelpArticleFeedback,
  updateHelpArticle,
  updateHelpCategory,
} from "../../../lib/help-center/help-center-service"
import {
  createContextualHelpLink,
  deactivateContextualHelpLink,
  listContextualHelpLinksForManage,
  listContextualHelpLinksForStaff,
  updateContextualHelpLink,
} from "../../../lib/help-center/help-contextual-links-service"
import { json } from "../../../lib/http"
import { methodNotAllowed } from "../../../lib/route-errors"
import { STAFF_SESSION_COOKIE, requireStaffSession } from "../auth/service"
import {
  createHelpArticleBodySchema,
  createHelpCategoryBodySchema,
  createHelpTagBodySchema,
  helpArticleDetailQuerySchema,
  helpArticleFeedbackBodySchema,
  helpArticleIdParamSchema,
  helpArticleSlugParamSchema,
  helpCategoryIdParamSchema,
  listHelpArticlesQuerySchema,
  updateHelpArticleBodySchema,
  updateHelpCategoryBodySchema,
  helpMediaIdParamSchema,
  helpArticleMediaParamsSchema,
  helpMediaUploadIntentBodySchema,
  helpMediaConfirmBodySchema,
  helpMediaUpdateBodySchema,
  helpMediaReorderBodySchema,
  listContextualHelpLinksQuerySchema,
  listManageContextualHelpLinksQuerySchema,
  createContextualHelpLinkBodySchema,
  updateContextualHelpLinkBodySchema,
  contextualHelpLinkIdParamSchema,
} from "./validators"

export const staffHelpRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>()

function database(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}

async function requireStaff(c: Context<{ Bindings: Env; Variables: AppRequestVariables }>) {
  const db = database(c.env)
  const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE))
  return { db, staff: session.staff }
}

async function requireHelpManager(c: Context<{ Bindings: Env; Variables: AppRequestVariables }>) {
  const context = await requireStaff(c)
  if (!canManageHelpContent(context.staff.role)) {
    throw new AppError(403, "STAFF_FORBIDDEN", "You do not have access to manage help center content.")
  }
  return context
}

staffHelpRoutes.get("/api/v1/staff/help/manage/categories", async (c) => {
  const { db } = await requireHelpManager(c)
  const items = await listHelpCategoriesForManage(db)
  return json({ ok: true as const, items })
})

staffHelpRoutes.all("/api/v1/staff/help/manage/categories", () => methodNotAllowed())

staffHelpRoutes.get(
  "/api/v1/staff/help/manage/articles/:articleId",
  zValidator("param", helpArticleIdParamSchema),
  async (c) => {
    const { db } = await requireHelpManager(c)
    const { articleId } = c.req.valid("param")
    const article = await getHelpArticleForManageById(db, articleId)
    return json({ ok: true as const, article })
  },
)

staffHelpRoutes.all("/api/v1/staff/help/manage/articles/:articleId", () => methodNotAllowed())

staffHelpRoutes.get("/api/v1/staff/help/categories", async (c) => {
  const { db, staff } = await requireStaff(c)
  const items = await listHelpCategoriesWithCounts(db, staff.role)
  return json({ ok: true as const, items })
})

staffHelpRoutes.all("/api/v1/staff/help/categories", () => methodNotAllowed())

staffHelpRoutes.post(
  "/api/v1/staff/help/categories",
  zValidator("json", createHelpCategoryBodySchema),
  async (c) => {
    const { db } = await requireHelpManager(c)
    const body = c.req.valid("json")
    const category = await createHelpCategory(db, body)
    return json({ ok: true as const, category }, 201)
  },
)

staffHelpRoutes.patch(
  "/api/v1/staff/help/categories/:categoryId",
  zValidator("param", helpCategoryIdParamSchema),
  zValidator("json", updateHelpCategoryBodySchema),
  async (c) => {
    const { db } = await requireHelpManager(c)
    const { categoryId } = c.req.valid("param")
    const body = c.req.valid("json")
    const category = await updateHelpCategory(db, categoryId, body)
    return json({ ok: true as const, category })
  },
)

staffHelpRoutes.get("/api/v1/staff/help/tags", async (c) => {
  const { db } = await requireStaff(c)
  const items = await listHelpTags(db)
  return json({ ok: true as const, items })
})

staffHelpRoutes.all("/api/v1/staff/help/tags", () => methodNotAllowed())

staffHelpRoutes.post(
  "/api/v1/staff/help/tags",
  zValidator("json", createHelpTagBodySchema),
  async (c) => {
    const { db } = await requireHelpManager(c)
    const body = c.req.valid("json")
    const tag = await createHelpTag(db, body)
    return json({ ok: true as const, tag }, 201)
  },
)

staffHelpRoutes.get(
  "/api/v1/staff/help/articles",
  zValidator("query", listHelpArticlesQuerySchema),
  async (c) => {
    const { db, staff } = await requireStaff(c)
    const query = c.req.valid("query")
    const result = await listHelpArticles(db, {
      staffRole: staff.role,
      canManage: canManageHelpContent(staff.role),
      q: query.q,
      categorySlug: query.category,
      tagSlug: query.tag,
      status: query.status,
      role: query.role,
      limit: query.limit,
      cursor: query.cursor ?? null,
    })
    return json({ ok: true as const, items: result.items, nextCursor: result.nextCursor })
  },
)

staffHelpRoutes.all("/api/v1/staff/help/articles", () => methodNotAllowed())

staffHelpRoutes.get(
  "/api/v1/staff/help/articles/:slug",
  zValidator("param", helpArticleSlugParamSchema),
  zValidator("query", helpArticleDetailQuerySchema),
  async (c) => {
    const { db, staff } = await requireStaff(c)
    const { slug } = c.req.valid("param")
    const query = c.req.valid("query")
    const article = await getHelpArticleBySlug(db, slug, staff, {
      searchQuery: query.searchQuery ?? null,
      recordView: true,
    })
    return json({ ok: true as const, article })
  },
)

staffHelpRoutes.post(
  "/api/v1/staff/help/articles",
  zValidator("json", createHelpArticleBodySchema),
  async (c) => {
    const { db, staff } = await requireHelpManager(c)
    const body = c.req.valid("json")
    const slug = body.slug ?? slugifyHelpText(body.title)
    if (!slug) throw new AppError(400, "INVALID_SLUG", "Could not derive a valid slug from the title.")

    const article = await createHelpArticle(db, {
      categoryId: body.categoryId,
      title: body.title,
      slug,
      summary: body.summary,
      bodyMarkdown: body.bodyMarkdown,
      status: body.status,
      visibility: body.visibility,
      audienceRoles: body.audienceRoles,
      difficulty: body.difficulty ?? null,
      estimatedMinutes: body.estimatedMinutes ?? null,
      sortOrder: body.sortOrder,
      tagIds: body.tagIds,
      media: body.media,
      relatedArticleIds: body.relatedArticleIds,
      createdByStaffId: staff.id,
    })

    const [tagsByArticle, media] = await Promise.all([
      loadTagsByArticleIds(db, [article!.id]),
      loadArticleMedia(db, article!.id),
    ])

    return json(
      {
        ok: true as const,
        article: serializeHelpArticleRecord(article!, {
          tags: tagsByArticle.get(article!.id) ?? [],
          media,
          relatedArticleIds: body.relatedArticleIds ?? [],
        }),
      },
      201,
    )
  },
)

staffHelpRoutes.patch(
  "/api/v1/staff/help/articles/:articleId",
  zValidator("param", helpArticleIdParamSchema),
  zValidator("json", updateHelpArticleBodySchema),
  async (c) => {
    const { db, staff } = await requireHelpManager(c)
    const { articleId } = c.req.valid("param")
    const body = c.req.valid("json")

    const article = await updateHelpArticle(db, {
      articleId,
      categoryId: body.categoryId,
      title: body.title,
      slug: body.slug,
      summary: body.summary,
      bodyMarkdown: body.bodyMarkdown,
      status: body.status,
      audienceRoles: body.audienceRoles,
      difficulty: body.difficulty,
      estimatedMinutes: body.estimatedMinutes,
      sortOrder: body.sortOrder,
      tagIds: body.tagIds,
      media: body.media,
      relatedArticleIds: body.relatedArticleIds,
      updatedByStaffId: staff.id,
    })

    const [tagsByArticle, media] = await Promise.all([
      loadTagsByArticleIds(db, [article!.id]),
      loadArticleMedia(db, article!.id),
    ])

    return json({
      ok: true as const,
      article: serializeHelpArticleRecord(article!, {
        tags: tagsByArticle.get(article!.id) ?? [],
        media,
        relatedArticleIds: body.relatedArticleIds,
      }),
    })
  },
)

staffHelpRoutes.get(
  "/api/v1/staff/help/media/:mediaId",
  zValidator("param", helpMediaIdParamSchema),
  async (c) => {
    const { db, staff } = await requireStaff(c)
    const { mediaId } = c.req.valid("param")
    return getHelpMediaDeliveryResponse(db, c.env, mediaId, staff, c.req.header("range") ?? null)
  },
)

staffHelpRoutes.all("/api/v1/staff/help/media/:mediaId", () => methodNotAllowed())

staffHelpRoutes.post(
  "/api/v1/staff/help/articles/:articleId/media/upload-intent",
  zValidator("param", helpArticleIdParamSchema),
  zValidator("json", helpMediaUploadIntentBodySchema),
  async (c) => {
    const { db, staff } = await requireHelpManager(c)
    const { articleId } = c.req.valid("param")
    const body = c.req.valid("json")
    const intent = await createHelpMediaUploadIntent(db, c.env, articleId, body, staff.id)
    return json({ ok: true as const, ...intent }, 201)
  },
)

staffHelpRoutes.post(
  "/api/v1/staff/help/articles/:articleId/media/:mediaId/confirm",
  zValidator("param", helpArticleMediaParamsSchema),
  zValidator("json", helpMediaConfirmBodySchema),
  async (c) => {
    const { db, staff } = await requireHelpManager(c)
    const { articleId, mediaId } = c.req.valid("param")
    const body = c.req.valid("json")
    const media = await confirmHelpMediaUpload(db, c.env, articleId, mediaId, body, staff.id)
    return json({ ok: true as const, media })
  },
)

staffHelpRoutes.patch(
  "/api/v1/staff/help/articles/:articleId/media/:mediaId",
  zValidator("param", helpArticleMediaParamsSchema),
  zValidator("json", helpMediaUpdateBodySchema),
  async (c) => {
    const { db, staff } = await requireHelpManager(c)
    const { articleId, mediaId } = c.req.valid("param")
    const body = c.req.valid("json")
    const media = await updateHelpMediaMetadata(db, articleId, mediaId, body, staff.id)
    return json({ ok: true as const, media })
  },
)

staffHelpRoutes.delete(
  "/api/v1/staff/help/articles/:articleId/media/:mediaId",
  zValidator("param", helpArticleMediaParamsSchema),
  async (c) => {
    const { db } = await requireHelpManager(c)
    const { articleId, mediaId } = c.req.valid("param")
    const result = await deleteHelpMedia(db, c.env, articleId, mediaId)
    return json(result)
  },
)

staffHelpRoutes.post(
  "/api/v1/staff/help/articles/:articleId/media/reorder",
  zValidator("param", helpArticleIdParamSchema),
  zValidator("json", helpMediaReorderBodySchema),
  async (c) => {
    const { db, staff } = await requireHelpManager(c)
    const { articleId } = c.req.valid("param")
    const body = c.req.valid("json")
    const items = await reorderHelpMedia(db, articleId, body.items, staff.id)
    return json({ ok: true as const, items })
  },
)

staffHelpRoutes.post(
  "/api/v1/staff/help/articles/:articleId/feedback",
  zValidator("param", helpArticleIdParamSchema),
  zValidator("json", helpArticleFeedbackBodySchema),
  async (c) => {
    const { db, staff } = await requireStaff(c)
    const { articleId } = c.req.valid("param")
    const body = c.req.valid("json")
    const feedback = await submitHelpArticleFeedback(db, {
      articleId,
      staff: { id: staff.id, role: staff.role },
      wasHelpful: body.wasHelpful,
      comment: body.comment ?? null,
    })
    return json({ ok: true as const, feedback }, 201)
  },
)

staffHelpRoutes.get(
  "/api/v1/staff/help/contextual-links",
  zValidator("query", listContextualHelpLinksQuerySchema),
  async (c) => {
    const { db, staff } = await requireStaff(c)
    const query = c.req.valid("query")
    const items = await listContextualHelpLinksForStaff(db, {
      contextKey: query.contextKey,
      staffRole: staff.role,
      placement: query.placement,
      limit: query.limit,
    })
    return json({ ok: true as const, items })
  },
)

staffHelpRoutes.all("/api/v1/staff/help/contextual-links", () => methodNotAllowed())

staffHelpRoutes.get(
  "/api/v1/staff/help/manage/contextual-links",
  zValidator("query", listManageContextualHelpLinksQuerySchema),
  async (c) => {
    const { db } = await requireHelpManager(c)
    const query = c.req.valid("query")
    const items = await listContextualHelpLinksForManage(db, {
      contextKey: query.contextKey,
      articleId: query.articleId,
      isActive: query.isActive,
      limit: query.limit,
    })
    return json({ ok: true as const, items })
  },
)

staffHelpRoutes.post(
  "/api/v1/staff/help/manage/contextual-links",
  zValidator("json", createContextualHelpLinkBodySchema),
  async (c) => {
    const { db, staff } = await requireHelpManager(c)
    const body = c.req.valid("json")
    const link = await createContextualHelpLink(db, {
      contextKey: body.contextKey,
      articleId: body.articleId,
      label: body.label ?? null,
      description: body.description ?? null,
      placement: body.placement,
      displayOrder: body.displayOrder,
      isActive: body.isActive,
      staffId: staff.id,
    })
    const items = await listContextualHelpLinksForManage(db, { limit: 200 })
    const created = items.find((item) => item.id === link.id)
    return json({ ok: true as const, link: created ?? { id: link.id } }, 201)
  },
)

staffHelpRoutes.patch(
  "/api/v1/staff/help/manage/contextual-links/:linkId",
  zValidator("param", contextualHelpLinkIdParamSchema),
  zValidator("json", updateContextualHelpLinkBodySchema),
  async (c) => {
    const { db, staff } = await requireHelpManager(c)
    const { linkId } = c.req.valid("param")
    const body = c.req.valid("json")
    const link = await updateContextualHelpLink(db, linkId, {
      contextKey: body.contextKey,
      articleId: body.articleId,
      label: body.label,
      description: body.description,
      placement: body.placement,
      displayOrder: body.displayOrder,
      isActive: body.isActive,
      staffId: staff.id,
    })
    return json({ ok: true as const, link })
  },
)

staffHelpRoutes.delete(
  "/api/v1/staff/help/manage/contextual-links/:linkId",
  zValidator("param", contextualHelpLinkIdParamSchema),
  async (c) => {
    const { db, staff } = await requireHelpManager(c)
    const { linkId } = c.req.valid("param")
    const result = await deactivateContextualHelpLink(db, linkId, staff.id)
    return json(result)
  },
)

staffHelpRoutes.all("/api/v1/staff/help/manage/contextual-links/:linkId", () => methodNotAllowed())
staffHelpRoutes.all("/api/v1/staff/help/manage/contextual-links", () => methodNotAllowed())
