import { z } from "zod"
import {
  HELP_ARTICLE_DIFFICULTIES,
  HELP_ARTICLE_STATUSES,
  HELP_ARTICLE_VISIBILITY,
  HELP_CONTEXTUAL_PLACEMENTS,
  HELP_MEDIA_TYPES,
  STAFF_MEMBER_ROLES,
} from "../../../lib/help-center/constants"
import { HELP_CONTEXT_KEYS } from "../../../lib/help-center/help-contexts"

const helpSlugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(120, "Slug must be at most 120 characters.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and dashes.")

const staffRoleSchema = z.enum(STAFF_MEMBER_ROLES)

export const helpArticleSlugParamSchema = z.object({
  slug: helpSlugSchema,
})

export const helpArticleIdParamSchema = z.object({
  articleId: z.string().uuid(),
})

export const helpCategoryIdParamSchema = z.object({
  categoryId: z.string().uuid(),
})

export const listHelpArticlesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: helpSlugSchema.optional(),
  tag: helpSlugSchema.optional(),
  status: z.enum(HELP_ARTICLE_STATUSES).optional(),
  role: staffRoleSchema.optional(),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  cursor: z.string().trim().min(1).optional(),
})

export const helpArticleFeedbackBodySchema = z.object({
  wasHelpful: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
})

const helpMediaInputSchema = z.object({
  mediaType: z.enum(HELP_MEDIA_TYPES),
  title: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  storageKey: z.string().trim().max(500).optional().nullable(),
  mimeType: z.string().trim().max(120).optional().nullable(),
  fileSizeBytes: z.number().int().min(0).optional().nullable(),
  durationSeconds: z.number().int().min(0).optional().nullable(),
  width: z.number().int().min(1).optional().nullable(),
  height: z.number().int().min(1).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
})

export const createHelpArticleBodySchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(200),
  slug: helpSlugSchema.optional(),
  summary: z.string().trim().min(1, "Summary is required.").max(500),
  bodyMarkdown: z.string().trim().min(1, "Body is required.").max(100_000),
  status: z.enum(HELP_ARTICLE_STATUSES),
  visibility: z.enum(HELP_ARTICLE_VISIBILITY).optional(),
  audienceRoles: z.array(staffRoleSchema).min(1, "At least one audience role is required."),
  difficulty: z.enum(HELP_ARTICLE_DIFFICULTIES).optional().nullable(),
  estimatedMinutes: z.number().int().min(1).max(240).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  media: z.array(helpMediaInputSchema).optional(),
  relatedArticleIds: z.array(z.string().uuid()).optional(),
})

export const updateHelpArticleBodySchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    slug: helpSlugSchema.optional(),
    summary: z.string().trim().min(1).max(500).optional(),
    bodyMarkdown: z.string().trim().min(1).max(100_000).optional(),
    status: z.enum(HELP_ARTICLE_STATUSES).optional(),
    audienceRoles: z.array(staffRoleSchema).min(1).optional(),
    difficulty: z.enum(HELP_ARTICLE_DIFFICULTIES).optional().nullable(),
    estimatedMinutes: z.number().int().min(1).max(240).optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    media: z.array(helpMediaInputSchema).optional(),
    relatedArticleIds: z.array(z.string().uuid()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  })

export const createHelpCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: helpSlugSchema,
  description: z.string().trim().max(1000).optional().nullable(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const updateHelpCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: helpSlugSchema.optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  })

export const createHelpTagBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: helpSlugSchema,
})

export const helpArticleDetailQuerySchema = z.object({
  searchQuery: z.string().trim().max(200).optional(),
})

export const helpMediaIdParamSchema = z.object({
  mediaId: z.string().uuid(),
})

export const helpArticleMediaParamsSchema = z.object({
  articleId: z.string().uuid(),
  mediaId: z.string().uuid(),
})

export const helpMediaUploadIntentBodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  fileSizeBytes: z.number().int().min(1),
  mediaType: z.enum(HELP_MEDIA_TYPES),
  title: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
})

export const helpMediaConfirmBodySchema = z.object({
  width: z.number().int().min(1).optional().nullable(),
  height: z.number().int().min(1).optional().nullable(),
  durationSeconds: z.number().int().min(1).max(300).optional().nullable(),
})

export const helpMediaUpdateBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  })

export const helpMediaReorderBodySchema = z.object({
  items: z
    .array(
      z.object({
        mediaId: z.string().uuid(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1),
})

const helpContextKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, "Context key must use lowercase dot-separated segments.")

export const contextualHelpLinkIdParamSchema = z.object({
  linkId: z.string().uuid(),
})

export const listContextualHelpLinksQuerySchema = z.object({
  contextKey: helpContextKeySchema,
  placement: z.enum(HELP_CONTEXTUAL_PLACEMENTS).optional(),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : 5))
    .pipe(z.number().int().min(1).max(20)),
})

export const listManageContextualHelpLinksQuerySchema = z.object({
  contextKey: helpContextKeySchema.optional(),
  articleId: z.string().uuid().optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : 100))
    .pipe(z.number().int().min(1).max(200)),
})

export const createContextualHelpLinkBodySchema = z.object({
  contextKey: helpContextKeySchema,
  articleId: z.string().uuid(),
  label: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  placement: z.enum(HELP_CONTEXTUAL_PLACEMENTS).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const updateContextualHelpLinkBodySchema = z
  .object({
    contextKey: helpContextKeySchema.optional(),
    articleId: z.string().uuid().optional(),
    label: z.string().trim().max(200).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    placement: z.enum(HELP_CONTEXTUAL_PLACEMENTS).optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  })

export const helpContextKeyOptionsSchema = z.enum(HELP_CONTEXT_KEYS)
