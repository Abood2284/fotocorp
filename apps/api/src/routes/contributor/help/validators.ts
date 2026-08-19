import { z } from "zod"

const helpSlugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(120, "Slug must be at most 120 characters.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and dashes.")

export const contributorHelpArticleSlugParamSchema = z.object({
  slug: helpSlugSchema,
})

export const contributorHelpMediaIdParamSchema = z.object({
  mediaId: z.string().uuid(),
})
