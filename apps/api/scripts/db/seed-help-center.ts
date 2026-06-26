#!/usr/bin/env node
/**
 * Idempotent seed for staff Help Center categories, tags, and optional draft articles.
 *
 *   pnpm --dir apps/api db:seed:help-center -- --dry-run
 *   pnpm --dir apps/api db:seed:help-center
 */
import dotenv from "dotenv"
import { eq, sql } from "drizzle-orm"
import pg from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

import {
  HELP_ARTICLE_SEEDS,
  HELP_CATEGORY_SEEDS,
  HELP_TAG_SEEDS,
} from "../../src/lib/help-center/help-center-taxonomy"
import {
  helpArticleTags,
  helpArticles,
  helpCategories,
  helpTags,
} from "../../src/db/schema/help-center"
import { staffMembers } from "../../src/db/schema/staff-members"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg
const dryRun = process.argv.includes("--dry-run")

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("FAIL DATABASE_URL is required.")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const db = drizzle(pool)

  try {
    console.log(
      JSON.stringify(
        {
          phase: "plan",
          dryRun,
          categories: HELP_CATEGORY_SEEDS.length,
          tags: HELP_TAG_SEEDS.length,
          draftArticles: HELP_ARTICLE_SEEDS.length,
        },
        null,
        2,
      ),
    )

    if (dryRun) {
      console.log("Dry run complete — no rows written.")
      return
    }

    for (const seed of HELP_CATEGORY_SEEDS) {
      await db
        .insert(helpCategories)
        .values({
          name: seed.name,
          slug: seed.slug,
          description: seed.description,
          displayOrder: seed.displayOrder,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: helpCategories.slug,
          set: {
            name: seed.name,
            description: seed.description,
            displayOrder: seed.displayOrder,
            isActive: true,
            updatedAt: sql`now()`,
          },
        })
    }

    for (const seed of HELP_TAG_SEEDS) {
      await db
        .insert(helpTags)
        .values({
          name: seed.name,
          slug: seed.slug,
        })
        .onConflictDoUpdate({
          target: helpTags.slug,
          set: {
            name: seed.name,
            updatedAt: sql`now()`,
          },
        })
    }

    const categoryRows = await db
      .select({ id: helpCategories.id, slug: helpCategories.slug })
      .from(helpCategories)
    const tagRows = await db.select({ id: helpTags.id, slug: helpTags.slug }).from(helpTags)
    const categoryBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]))
    const tagBySlug = new Map(tagRows.map((row) => [row.slug, row.id]))

    const adminRows = await db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(eq(staffMembers.role, "SUPER_ADMIN"))
      .limit(1)
    const seedStaffId = adminRows[0]?.id ?? null

    let seededArticles = 0
    if (seedStaffId) {
      for (const seed of HELP_ARTICLE_SEEDS) {
        const categoryId = categoryBySlug.get(seed.categorySlug)
        if (!categoryId) continue

        const [article] = await db
          .insert(helpArticles)
          .values({
            categoryId,
            title: seed.title,
            slug: seed.slug,
            summary: seed.summary,
            bodyMarkdown: seed.bodyMarkdown,
            status: "DRAFT",
            visibility: "STAFF_ONLY",
            audienceRoles: seed.audienceRoles,
            difficulty: seed.difficulty,
            estimatedMinutes: seed.estimatedMinutes,
            sortOrder: seed.sortOrder,
            createdByStaffId: seedStaffId,
            updatedByStaffId: seedStaffId,
          })
          .onConflictDoUpdate({
            target: helpArticles.slug,
            set: {
              title: seed.title,
              summary: seed.summary,
              bodyMarkdown: seed.bodyMarkdown,
              categoryId,
              audienceRoles: seed.audienceRoles,
              difficulty: seed.difficulty,
              estimatedMinutes: seed.estimatedMinutes,
              sortOrder: seed.sortOrder,
              updatedByStaffId: seedStaffId,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: helpArticles.id })

        await db.delete(helpArticleTags).where(eq(helpArticleTags.articleId, article.id))
        const tagIds = seed.tagSlugs
          .map((slug) => tagBySlug.get(slug))
          .filter((value): value is string => Boolean(value))

        if (tagIds.length) {
          await db.insert(helpArticleTags).values(
            tagIds.map((tagId) => ({
              articleId: article.id,
              tagId,
            })),
          )
        }

        seededArticles += 1
      }
    } else {
      console.warn("WARN No SUPER_ADMIN staff member found — skipped draft article seeds.")
    }

    const summary = {
      phase: "apply",
      categories: categoryRows.length,
      tags: tagRows.length,
      draftArticles: seededArticles,
    }
    console.log(JSON.stringify(summary, null, 2))
    console.log("OK seeded help center taxonomy.")
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
