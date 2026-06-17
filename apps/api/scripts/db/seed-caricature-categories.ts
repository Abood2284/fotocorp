#!/usr/bin/env node
/**
 * Idempotent seed for caricature_categories MVP taxonomy.
 *
 *   pnpm --dir apps/api db:seed:caricature-categories -- --dry-run
 *   pnpm --dir apps/api db:seed:caricature-categories
 */
import dotenv from "dotenv"
import { sql } from "drizzle-orm"
import pg from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

import { CARICATURE_CATEGORY_SEEDS } from "../../src/lib/caricatures/caricature-category-taxonomy"
import { caricatureCategories } from "../../src/db/schema/caricature-categories"

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
    const existing = await db
      .select({ slug: caricatureCategories.slug, name: caricatureCategories.name })
      .from(caricatureCategories)

    const existingSlugs = new Set(existing.map((row) => row.slug))
    const planned = CARICATURE_CATEGORY_SEEDS.map((seed) => ({
      ...seed,
      action: existingSlugs.has(seed.slug) ? "update" : "insert",
    }))

    console.log(
      JSON.stringify(
        {
          phase: "plan",
          dryRun,
          totalPlanned: planned.length,
          inserts: planned.filter((row) => row.action === "insert").length,
          updates: planned.filter((row) => row.action === "update").length,
          items: planned,
        },
        null,
        2,
      ),
    )

    if (dryRun) {
      console.log("Dry run complete — no rows written.")
      return
    }

    for (const seed of CARICATURE_CATEGORY_SEEDS) {
      await db
        .insert(caricatureCategories)
        .values({
          name: seed.name,
          slug: seed.slug,
          sortOrder: seed.sortOrder,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: caricatureCategories.slug,
          set: {
            name: seed.name,
            sortOrder: seed.sortOrder,
            isActive: true,
            updatedAt: sql`now()`,
          },
        })
    }

    const after = await db
      .select({
        slug: caricatureCategories.slug,
        name: caricatureCategories.name,
        sortOrder: caricatureCategories.sortOrder,
        isActive: caricatureCategories.isActive,
      })
      .from(caricatureCategories)
      .orderBy(caricatureCategories.sortOrder)

    console.log(JSON.stringify({ phase: "apply", count: after.length, items: after }, null, 2))
    console.log(`OK seeded ${after.length} caricature categories.`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
