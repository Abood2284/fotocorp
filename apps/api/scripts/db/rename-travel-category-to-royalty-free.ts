#!/usr/bin/env node
/**
 * ONE-TIME — delete after use. See scripts/db/ONE_TIME_SCRIPTS.md
 *
 * Rename asset_categories "Travel" → "Royalty Free".
 *
 *   pnpm --dir apps/api db:rename:travel-to-royalty-free -- --dry-run
 *   pnpm --dir apps/api db:rename:travel-to-royalty-free
 */
import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

const dryRun = process.argv.includes("--dry-run")
const TRAVEL_LEGACY_CODE = 10
const NEW_NAME = "Royalty Free"
const NEW_SLUG = "royalty-free"

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("FAIL DATABASE_URL is required.")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const before = await pool.query<{ id: string; name: string; slug: string | null; legacy_category_code: number }>(
      `
        select id, name, slug, legacy_category_code
        from asset_categories
        where legacy_category_code = $1
        limit 1
      `,
      [TRAVEL_LEGACY_CODE],
    )

    const row = before.rows[0]
    if (!row) {
      console.error(`FAIL category with legacy code ${TRAVEL_LEGACY_CODE} not found.`)
      process.exit(1)
    }

    const counts = await pool.query<{
      image_assets: string
      photo_events: string
      assets: string
    }>(
      `
        select
          (select count(*)::int from image_assets where category_id = $1::uuid) as image_assets,
          (select count(*)::int from photo_events where category_id = $1::uuid) as photo_events,
          (select count(*)::int from assets where category_id = $1::uuid) as assets
      `,
      [row.id],
    )

    console.log(JSON.stringify({
      phase: "pre_rename",
      dryRun,
      category: row,
      referenceCounts: counts.rows[0],
      targetName: NEW_NAME,
      targetSlug: NEW_SLUG,
    }, null, 2))

    if (dryRun) {
      console.log("Dry run complete — no rows written.")
      return
    }

    const result = await pool.query(
      `
        update asset_categories
        set
          name = $2,
          slug = $3,
          updated_at = now()
        where id = $1::uuid
      `,
      [row.id, NEW_NAME, NEW_SLUG],
    )

    const after = await pool.query(
      `select id, name, slug, legacy_category_code from asset_categories where id = $1::uuid`,
      [row.id],
    )

    console.log(JSON.stringify({
      phase: "apply",
      rowsUpdated: result.rowCount ?? 0,
      category: after.rows[0],
    }, null, 2))
    console.log(`OK renamed ${row.name} → ${NEW_NAME}.`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error("FAIL", error)
  process.exit(1)
})
