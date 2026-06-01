#!/usr/bin/env node
/**
 * ONE-TIME — delete after use. See scripts/db/ONE_TIME_SCRIPTS.md
 *
 * 1) Copy photo_events.category_id → image_assets.category_id where asset category is null.
 * 2) Assign remaining public ACTIVE assets with no category to the "More" category.
 *
 *   pnpm --dir apps/api db:backfill:image-assets-category-gaps -- --dry-run
 *   pnpm --dir apps/api db:backfill:image-assets-category-gaps
 */
import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

const dryRun = process.argv.includes("--dry-run")

const MORE_LEGACY_CATEGORY_CODE = 33

const BACKFILL_FROM_EVENT_SQL = `
  UPDATE image_assets ia
  SET
    category_id = pe.category_id,
    updated_at = now()
  FROM photo_events pe
  WHERE ia.event_id = pe.id
    AND ia.category_id IS NULL
    AND pe.category_id IS NOT NULL
`

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("FAIL DATABASE_URL is required.")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const moreCategory = await loadMoreCategory(pool)
    if (!moreCategory) {
      console.error(`FAIL asset_categories row not found for legacy code ${MORE_LEGACY_CATEGORY_CODE}.`)
      process.exit(1)
    }

    const preSummary = await loadSummary(pool, moreCategory.id)
    console.log(JSON.stringify({ phase: "pre_backfill_summary", dryRun, moreCategory, ...preSummary }, null, 2))

    const fromEventDistribution = await loadFromEventDistribution(pool)
    console.log(
      JSON.stringify({ phase: "from_event_proposed_distribution", items: fromEventDistribution }, null, 2),
    )

    const moreCandidates = await loadMoreCandidateSample(pool, moreCategory.id, 10)
    console.log(JSON.stringify({ phase: "more_assignment_sample", items: moreCandidates }, null, 2))

    if (dryRun) {
      console.log("Dry run complete — no rows written.")
      return
    }

    const fromEventResult = await pool.query(BACKFILL_FROM_EVENT_SQL)
    const fromEventUpdated = fromEventResult.rowCount ?? 0

    const moreResult = await pool.query(
      `
        UPDATE image_assets ia
        SET
          category_id = $1::uuid,
          updated_at = now()
        FROM photo_events pe
        WHERE ia.event_id = pe.id
          AND ia.category_id IS NULL
          AND ia.status = 'ACTIVE'
          AND ia.visibility = 'PUBLIC'
          AND pe.category_id IS NULL
      `,
      [moreCategory.id],
    )
    const moreFromEventsUpdated = moreResult.rowCount ?? 0

    const moreNoEventResult = await pool.query(
      `
        UPDATE image_assets ia
        SET
          category_id = $1::uuid,
          updated_at = now()
        WHERE ia.category_id IS NULL
          AND ia.status = 'ACTIVE'
          AND ia.visibility = 'PUBLIC'
          AND ia.event_id IS NULL
      `,
      [moreCategory.id],
    )
    const moreNoEventUpdated = moreNoEventResult.rowCount ?? 0

    const postSummary = await loadSummary(pool, moreCategory.id)
    console.log(
      JSON.stringify(
        {
          phase: "apply",
          fromEventUpdated,
          moreFromEventsUpdated,
          moreNoEventUpdated,
          moreTotalUpdated: moreFromEventsUpdated + moreNoEventUpdated,
        },
        null,
        2,
      ),
    )
    console.log(JSON.stringify({ phase: "post_backfill_summary", ...postSummary }, null, 2))

    console.log(
      `OK backfilled ${fromEventUpdated} assets from events; assigned More to ${moreFromEventsUpdated + moreNoEventUpdated} public ACTIVE assets.`,
    )
  } finally {
    await pool.end()
  }
}

async function loadMoreCategory(pool: pg.Pool) {
  const result = await pool.query<{ id: string; name: string; legacy_category_code: number | null }>(`
    select id, name, legacy_category_code
    from asset_categories
    where legacy_category_code = $1
    limit 1
  `, [MORE_LEGACY_CATEGORY_CODE])

  return result.rows[0] ?? null
}

async function loadSummary(pool: pg.Pool, moreCategoryId: string) {
  const result = await pool.query<{
    assets_category_null: string
    assets_from_event_candidates: string
    public_active_uncategorized: string
    public_active_more_candidates: string
    more_category_assets: string
  }>(`
    select
      (select count(*)::int from image_assets where category_id is null) as assets_category_null,
      (
        select count(*)::int
        from image_assets ia
        join photo_events pe on pe.id = ia.event_id
        where ia.category_id is null
          and pe.category_id is not null
      ) as assets_from_event_candidates,
      (
        select count(*)::int
        from image_assets ia
        left join photo_events pe on pe.id = ia.event_id
        where ia.category_id is null
          and ia.status = 'ACTIVE'
          and ia.visibility = 'PUBLIC'
      ) as public_active_uncategorized,
      (
        select count(*)::int
        from image_assets ia
        left join photo_events pe on pe.id = ia.event_id
        where ia.category_id is null
          and ia.status = 'ACTIVE'
          and ia.visibility = 'PUBLIC'
          and (ia.event_id is null or pe.category_id is null)
      ) as public_active_more_candidates,
      (
        select count(*)::int
        from image_assets
        where category_id = $1::uuid
      ) as more_category_assets
  `, [moreCategoryId])

  return result.rows[0]
}

async function loadFromEventDistribution(pool: pg.Pool) {
  const result = await pool.query<{
    name: string
    legacy_category_code: number | null
    asset_count: string
  }>(`
    select
      c.name,
      c.legacy_category_code,
      count(*)::int as asset_count
    from image_assets ia
    join photo_events pe on pe.id = ia.event_id
    join asset_categories c on c.id = pe.category_id
    where ia.category_id is null
    group by c.name, c.legacy_category_code
    order by asset_count desc, c.name asc
  `)

  return result.rows
}

async function loadMoreCandidateSample(pool: pg.Pool, moreCategoryId: string, limit: number) {
  const result = await pool.query<{
    asset_id: string
    event_id: string | null
    event_name: string | null
    headline: string | null
  }>(`
    select
      ia.id as asset_id,
      ia.event_id,
      pe.name as event_name,
      ia.headline
    from image_assets ia
    left join photo_events pe on pe.id = ia.event_id
    where ia.category_id is null
      and ia.status = 'ACTIVE'
      and ia.visibility = 'PUBLIC'
      and (ia.event_id is null or pe.category_id is null)
    order by ia.created_at desc
    limit $1
  `, [limit])

  return result.rows
}

main().catch((error) => {
  console.error("FAIL", error)
  process.exit(1)
})
