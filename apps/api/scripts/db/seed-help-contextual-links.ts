#!/usr/bin/env node
/**
 * Idempotent seed for contextual help links (maps workflow context keys to article slugs).
 *
 *   pnpm --dir apps/api db:seed:help-contextual-links -- --dry-run
 *   pnpm --dir apps/api db:seed:help-contextual-links
 */
import dotenv from "dotenv"
import { eq, sql } from "drizzle-orm"
import pg from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

import { HELP_CONTEXTUAL_LINK_SEEDS } from "../../src/lib/help-center/help-contextual-link-seeds"
import { helpArticles, helpContextualLinks } from "../../src/db/schema/help-center"
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
    const [seedStaff] = await db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(eq(staffMembers.role, "SUPER_ADMIN"))
      .limit(1)

    if (!seedStaff) {
      console.log("SKIP No SUPER_ADMIN staff member found — contextual link seed requires a manager account.")
      return
    }

    const articleRows = await db
      .select({ id: helpArticles.id, slug: helpArticles.slug })
      .from(helpArticles)

    const articleIdBySlug = new Map(articleRows.map((row) => [row.slug, row.id]))
    const skipped: string[] = []
    const planned: Array<{ contextKey: string; articleSlug: string }> = []

    for (const seed of HELP_CONTEXTUAL_LINK_SEEDS) {
      const articleId = articleIdBySlug.get(seed.articleSlug)
      if (!articleId) {
        skipped.push(`${seed.contextKey} -> ${seed.articleSlug}`)
        continue
      }
      planned.push({ contextKey: seed.contextKey, articleSlug: seed.articleSlug })

      if (dryRun) continue

      await db
        .insert(helpContextualLinks)
        .values({
          contextKey: seed.contextKey,
          articleId,
          label: seed.label?.trim() || null,
          description: seed.description?.trim() || null,
          placement: "PAGE_HEADER",
          displayOrder: seed.displayOrder ?? 10,
          isActive: true,
          createdByStaffId: seedStaff.id,
          updatedByStaffId: seedStaff.id,
        })
        .onConflictDoUpdate({
          target: [helpContextualLinks.contextKey, helpContextualLinks.articleId],
          set: {
            label: seed.label?.trim() || null,
            description: seed.description?.trim() || null,
            displayOrder: seed.displayOrder ?? 10,
            isActive: true,
            updatedByStaffId: seedStaff.id,
            updatedAt: sql`now()`,
          },
        })
    }

    console.log(
      JSON.stringify(
        {
          phase: dryRun ? "dry-run" : "complete",
          planned: planned.length,
          skipped: skipped.length,
          skippedMappings: skipped,
        },
        null,
        2,
      ),
    )
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
