#!/usr/bin/env node
/**
 * ONE-TIME — delete after use. See scripts/db/ONE_TIME_SCRIPTS.md
 *
 * Backfill photo_events.category_id from dominant public image_assets.category_id.
 *
 *   pnpm --dir apps/api db:backfill:photo-events-category-id -- --dry-run
 *   pnpm --dir apps/api db:backfill:photo-events-category-id
 */
import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

const dryRun = process.argv.includes("--dry-run")

const ELIGIBLE_ASSETS_PREDICATE = `
  ia.event_id IS NOT NULL
  AND ia.category_id IS NOT NULL
  AND ia.status = 'ACTIVE'
  AND ia.visibility = 'PUBLIC'
`

const RANKED_CTE = `
  WITH ranked AS (
    SELECT
      ia.event_id,
      ia.category_id,
      COUNT(*)::int AS asset_count,
      MIN(ac.legacy_category_code) AS min_legacy_code,
      ROW_NUMBER() OVER (
        PARTITION BY ia.event_id
        ORDER BY COUNT(*) DESC, MIN(ac.legacy_category_code) ASC NULLS LAST
      ) AS rn
    FROM image_assets ia
    JOIN asset_categories ac ON ac.id = ia.category_id
    WHERE ${ELIGIBLE_ASSETS_PREDICATE}
    GROUP BY ia.event_id, ia.category_id
  )
`

const UPDATE_SQL = `
  ${RANKED_CTE}
  UPDATE photo_events pe
  SET
    category_id = ranked.category_id,
    updated_at = now()
  FROM ranked
  WHERE ranked.event_id = pe.id
    AND ranked.rn = 1
    AND pe.category_id IS NULL
`

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("FAIL DATABASE_URL is required.")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const summary = await loadDryRunSummary(pool)
    console.log(JSON.stringify({ phase: "dry_run_summary", dryRun, ...summary }, null, 2))

    const distribution = await loadProposedDistribution(pool)
    console.log(JSON.stringify({ phase: "proposed_category_distribution", items: distribution }, null, 2))

    const mixed = await loadMixedCategorySummary(pool)
    console.log(JSON.stringify({ phase: "mixed_category_summary", ...mixed }, null, 2))

    const samples = await loadMixedCategorySamples(pool, 20)
    console.log(JSON.stringify({ phase: "mixed_category_samples", items: samples }, null, 2))

    const preserved = await loadPreservedCategoryCount(pool)
    console.log(JSON.stringify({ phase: "preserved_existing_categories", count: preserved }, null, 2))

    if (dryRun) {
      console.log("Dry run complete — no rows written.")
      return
    }

    const result = await pool.query(UPDATE_SQL)
    const rowsUpdated = result.rowCount ?? 0
    console.log(JSON.stringify({ phase: "apply", rowsUpdated }, null, 2))

    const postDistribution = await loadPostBackfillDistribution(pool)
    console.log(JSON.stringify({ phase: "post_backfill_category_distribution", items: postDistribution }, null, 2))

    const homepageSections = await loadHomepageSectionCounts(pool)
    console.log(JSON.stringify({ phase: "post_backfill_homepage_sections", items: homepageSections }, null, 2))

    const preservedAfter = await loadPreservedCategoryCount(pool)
    console.log(JSON.stringify({ phase: "preserved_existing_categories_after", count: preservedAfter }, null, 2))

    console.log(`OK backfilled ${rowsUpdated} photo_events rows.`)
  } finally {
    await pool.end()
  }
}

async function loadDryRunSummary(pool: pg.Pool) {
  const result = await pool.query<{
    total_photo_events: string
    events_category_null: string
    events_eligible_for_backfill: string
    events_would_update: string
    events_multiple_candidate_categories: string
  }>(`
    ${RANKED_CTE},
    winners AS (
      SELECT event_id, category_id, asset_count
      FROM ranked
      WHERE rn = 1
    ),
    candidate_counts AS (
      SELECT event_id, COUNT(*)::int AS category_candidates
      FROM ranked
      GROUP BY event_id
    )
    SELECT
      (SELECT COUNT(*)::int FROM photo_events) AS total_photo_events,
      (SELECT COUNT(*)::int FROM photo_events WHERE category_id IS NULL) AS events_category_null,
      (SELECT COUNT(*)::int FROM winners) AS events_eligible_for_backfill,
      (SELECT COUNT(*)::int FROM photo_events pe JOIN winners w ON w.event_id = pe.id WHERE pe.category_id IS NULL) AS events_would_update,
      (SELECT COUNT(*)::int FROM candidate_counts WHERE category_candidates > 1) AS events_multiple_candidate_categories
  `)

  return result.rows[0]
}

async function loadProposedDistribution(pool: pg.Pool) {
  const result = await pool.query<{
    name: string
    legacy_category_code: number | null
    event_count: string
  }>(`
    ${RANKED_CTE},
    winners AS (
      SELECT event_id, category_id
      FROM ranked
      WHERE rn = 1
    )
    SELECT
      ac.name,
      ac.legacy_category_code,
      COUNT(*)::int AS event_count
    FROM photo_events pe
    JOIN winners w ON w.event_id = pe.id
    JOIN asset_categories ac ON ac.id = w.category_id
    WHERE pe.category_id IS NULL
    GROUP BY ac.name, ac.legacy_category_code
    ORDER BY event_count DESC, ac.name ASC
  `)

  return result.rows
}

async function loadMixedCategorySummary(pool: pg.Pool) {
  const result = await pool.query<{ mixed_event_count: string }>(`
    SELECT COUNT(*)::int AS mixed_event_count
    FROM (
      SELECT ia.event_id
      FROM image_assets ia
      WHERE ${ELIGIBLE_ASSETS_PREDICATE}
      GROUP BY ia.event_id
      HAVING COUNT(DISTINCT ia.category_id) > 1
    ) mixed
  `)

  return result.rows[0]
}

async function loadMixedCategorySamples(pool: pg.Pool, limit: number) {
  const result = await pool.query<{
    event_id: string
    event_name: string
    categories: unknown
  }>(`
    WITH mixed_events AS (
      SELECT ia.event_id
      FROM image_assets ia
      WHERE ${ELIGIBLE_ASSETS_PREDICATE}
      GROUP BY ia.event_id
      HAVING COUNT(DISTINCT ia.category_id) > 1
      ORDER BY ia.event_id
      LIMIT $1
    ),
    category_counts AS (
      SELECT
        ia.event_id,
        ac.name AS category_name,
        ac.legacy_category_code,
        COUNT(*)::int AS asset_count
      FROM image_assets ia
      JOIN mixed_events me ON me.event_id = ia.event_id
      JOIN asset_categories ac ON ac.id = ia.category_id
      WHERE ${ELIGIBLE_ASSETS_PREDICATE}
      GROUP BY ia.event_id, ac.name, ac.legacy_category_code
    ),
    ranked AS (
      SELECT
        cc.*,
        ROW_NUMBER() OVER (
          PARTITION BY cc.event_id
          ORDER BY cc.asset_count DESC, cc.legacy_category_code ASC NULLS LAST
        ) AS rn
      FROM category_counts cc
    )
    SELECT
      pe.id AS event_id,
      pe.name AS event_name,
      json_agg(
        json_build_object(
          'categoryName', r.category_name,
          'legacyCategoryCode', r.legacy_category_code,
          'assetCount', r.asset_count,
          'selected', r.rn = 1
        )
        ORDER BY r.asset_count DESC, r.legacy_category_code ASC NULLS LAST
      ) AS categories
    FROM mixed_events me
    JOIN photo_events pe ON pe.id = me.event_id
    JOIN ranked r ON r.event_id = me.event_id
    GROUP BY pe.id, pe.name
    ORDER BY pe.name
  `, [limit])

  return result.rows
}

async function loadPreservedCategoryCount(pool: pg.Pool) {
  const result = await pool.query<{ count: string }>(`
    SELECT COUNT(*)::int AS count
    FROM photo_events
    WHERE category_id IS NOT NULL
  `)
  return Number(result.rows[0]?.count ?? 0)
}

async function loadPostBackfillDistribution(pool: pg.Pool) {
  const result = await pool.query<{
    name: string
    legacy_category_code: number | null
    event_count: string
  }>(`
    SELECT
      c.name,
      c.legacy_category_code,
      COUNT(*)::int AS event_count
    FROM photo_events e
    JOIN asset_categories c ON c.id = e.category_id
    GROUP BY c.name, c.legacy_category_code
    ORDER BY event_count DESC, c.name ASC
  `)

  return result.rows
}

async function loadHomepageSectionCounts(pool: pg.Pool) {
  const result = await pool.query<{
    section: string
    event_count: string
  }>(`
    SELECT
      lower(c.name) AS section,
      COUNT(*)::int AS event_count
    FROM photo_events e
    JOIN asset_categories c ON c.id = e.category_id
    WHERE lower(c.name) IN ('news', 'sports', 'entertainment', 'retro')
    GROUP BY lower(c.name)
    ORDER BY section
  `)

  return result.rows
}

main().catch((error) => {
  console.error("FAIL", error)
  process.exit(1)
})
