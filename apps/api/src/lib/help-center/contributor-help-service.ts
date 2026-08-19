import { eq } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { helpArticles, helpCategories } from "../../db/schema/help-center"
import { AppError } from "../errors"
import { isContributorHelpArticleSlug, isContributorVisibleHelpArticleStatus } from "./contributor-help"

export interface ContributorHelpArticle {
  id: string
  title: string
  slug: string
  summary: string
  bodyMarkdown: string
  category: {
    name: string
    slug: string
  }
  difficulty: string | null
  estimatedMinutes: number | null
  publishedAt: string | null
  updatedAt: string
}

export async function getPublishedContributorHelpArticle(
  db: DrizzleClient,
  slug: string,
): Promise<ContributorHelpArticle> {
  if (!isContributorHelpArticleSlug(slug)) {
    throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")
  }

  const rows = await db
    .select({
      id: helpArticles.id,
      title: helpArticles.title,
      slug: helpArticles.slug,
      summary: helpArticles.summary,
      bodyMarkdown: helpArticles.bodyMarkdown,
      status: helpArticles.status,
      difficulty: helpArticles.difficulty,
      estimatedMinutes: helpArticles.estimatedMinutes,
      publishedAt: helpArticles.publishedAt,
      updatedAt: helpArticles.updatedAt,
      categoryName: helpCategories.name,
      categorySlug: helpCategories.slug,
    })
    .from(helpArticles)
    .innerJoin(helpCategories, eq(helpCategories.id, helpArticles.categoryId))
    .where(eq(helpArticles.slug, slug))
    .limit(1)

  const row = rows[0]
  if (!row || !isContributorVisibleHelpArticleStatus(row.status)) {
    throw new AppError(404, "HELP_ARTICLE_NOT_FOUND", "Help article was not found.")
  }

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    bodyMarkdown: row.bodyMarkdown,
    category: {
      name: row.categoryName,
      slug: row.categorySlug,
    },
    difficulty: row.difficulty,
    estimatedMinutes: row.estimatedMinutes,
    publishedAt: toIso(row.publishedAt),
    updatedAt: toIso(row.updatedAt) ?? new Date(0).toISOString(),
  }
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
