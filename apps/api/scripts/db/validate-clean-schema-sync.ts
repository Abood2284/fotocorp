#!/usr/bin/env node
import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("FAIL DATABASE_URL is required.")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })
const failures: string[] = []

function toNumber(value: string | undefined) {
  return value === undefined ? NaN : Number(value)
}

async function query<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  const result = await pool.query<T>(sql)
  return result.rows
}

async function queryOne<T extends Record<string, unknown>>(sql: string): Promise<T | undefined> {
  const rows = await query<T>(sql)
  return rows[0]
}

try {
  console.log("--- Photographer profile vs clean contributors ---")
  const photoProfileRow = await queryOne<{
    old_photographer_profiles: string
    clean_contributors: string
    distinct_old_legacy_srnos: string
  }>(`
    select
      (select count(*)::text from photographer_profiles) as old_photographer_profiles,
      (select count(*)::text from contributors) as clean_contributors,
      (
        select count(*)::text from (
          select 1
          from photographer_profiles pp
          where nullif(pp.legacy_payload->>'srno', 'NULL') ~ '^[0-9]+$'
          group by (nullif(pp.legacy_payload->>'srno', 'NULL'))::bigint
        ) d
      ) as distinct_old_legacy_srnos
  `)
  console.log(photoProfileRow)

  const cleanWithLegacy = await queryOne<{ c: string }>(`
    select count(*)::text as c from contributors where legacy_photographer_id is not null
  `)
  const distinctSrno = toNumber(photoProfileRow?.distinct_old_legacy_srnos)
  const cleanLegacyCount = toNumber(cleanWithLegacy?.c)
  if (distinctSrno !== cleanLegacyCount) {
    failures.push(
      `clean contributors with legacy_photographer_id (${cleanLegacyCount}) must equal distinct numeric srno groups (${distinctSrno})`,
    )
  }

  console.log("\n--- Event / asset / derivative counts ---")
  const eventRow = await queryOne<{ old_events: string; clean_events: string }>(`
    select
      (select count(*)::text from asset_events) as old_events,
      (select count(*)::text from photo_events) as clean_events
  `)
  const assetRow = await queryOne<{ old_assets: string; clean_assets: string }>(`
    select
      (select count(*)::text from assets) as old_assets,
      (select count(*)::text from image_assets) as clean_assets
  `)
  const derivRow = await queryOne<{ old_derivatives: string; clean_derivatives: string }>(`
    select
      (select count(*)::text from asset_media_derivatives) as old_derivatives,
      (select count(*)::text from image_derivatives) as clean_derivatives
  `)
  console.log({ ...eventRow, ...assetRow, ...derivRow })

  if (toNumber(eventRow?.old_events) !== toNumber(eventRow?.clean_events)) {
    failures.push(
      `asset_events (${eventRow?.old_events}) must match photo_events (${eventRow?.clean_events})`,
    )
  }
  if (toNumber(assetRow?.old_assets) !== toNumber(assetRow?.clean_assets)) {
    failures.push(`assets (${assetRow?.old_assets}) must match image_assets (${assetRow?.clean_assets})`)
  }
  if (toNumber(derivRow?.old_derivatives) !== toNumber(derivRow?.clean_derivatives)) {
    failures.push(
      `asset_media_derivatives (${derivRow?.old_derivatives}) must match image_derivatives (${derivRow?.clean_derivatives})`,
    )
  }

  console.log("\n--- Row coverage ---")
  const missingAssets = await queryOne<{ missing_clean_assets: string }>(`
    select count(*)::text as missing_clean_assets
    from assets a
    left join image_assets ia on ia.id = a.id
    where ia.id is null
  `)
  const missingEvents = await queryOne<{ missing_clean_events: string }>(`
    select count(*)::text as missing_clean_events
    from asset_events ae
    left join photo_events pe on pe.id = ae.id
    where pe.id is null
  `)
  const missingDerivatives = await queryOne<{ missing_clean_derivatives: string }>(`
    select count(*)::text as missing_clean_derivatives
    from asset_media_derivatives old
    left join image_derivatives clean on clean.id = old.id
    where clean.id is null
  `)
  console.log({ ...missingAssets, ...missingEvents, ...missingDerivatives })

  if (toNumber(missingAssets?.missing_clean_assets) !== 0) {
    failures.push(`missing_clean_assets must be 0, got ${missingAssets?.missing_clean_assets}`)
  }
  if (toNumber(missingEvents?.missing_clean_events) !== 0) {
    failures.push(`missing_clean_events must be 0, got ${missingEvents?.missing_clean_events}`)
  }
  if (toNumber(missingDerivatives?.missing_clean_derivatives) !== 0) {
    failures.push(
      `missing_clean_derivatives must be 0, got ${missingDerivatives?.missing_clean_derivatives}`,
    )
  }

  console.log("\n--- Legacy image_assets integrity ---")
  const missPh = await queryOne<{ image_assets_missing_photographer: string }>(`
    select count(*)::text as image_assets_missing_photographer
    from image_assets
    where source = 'LEGACY_IMPORT'
      and legacy_photographer_id is not null
      and contributor_id is null
  `)
  const missEv = await queryOne<{ image_assets_missing_event: string }>(`
    select count(*)::text as image_assets_missing_event
    from image_assets
    where source = 'LEGACY_IMPORT'
      and event_id is null
  `)
  console.log({ ...missPh, ...missEv })

  if (toNumber(missPh?.image_assets_missing_photographer) !== 0) {
    failures.push(
      `image_assets_missing_photographer must be 0, got ${missPh?.image_assets_missing_photographer}`,
    )
  }
  if (toNumber(missEv?.image_assets_missing_event) !== 0) {
    failures.push(`image_assets_missing_event must be 0, got ${missEv?.image_assets_missing_event}`)
  }

  console.log("\n--- Derivative integrity ---")
  const derivOrphans = await queryOne<{ derivative_orphans: string }>(`
    select count(*)::text as derivative_orphans
    from image_derivatives d
    left join image_assets ia on ia.id = d.image_asset_id
    where ia.id is null
  `)
  const badVariants = await query<{ variant: string; count: string }>(`
    select variant, count(*)::text as count
    from image_derivatives
    where variant not in ('THUMB', 'CARD', 'DETAIL')
    group by variant
  `)
  console.log({ derivative_orphans: derivOrphans?.derivative_orphans, badVariants })

  if (toNumber(derivOrphans?.derivative_orphans) !== 0) {
    failures.push(`derivative_orphans must be 0, got ${derivOrphans?.derivative_orphans}`)
  }
  if (badVariants.length > 0) {
    failures.push(`image_derivatives has non-canonical variants: ${JSON.stringify(badVariants)}`)
  }

  if (failures.length > 0) {
    console.error("\nFAIL:")
    for (const f of failures) console.error(`  - ${f}`)
    process.exitCode = 1
  } else {
    console.log("\nPASS clean-schema sync validation.")
  }
} finally {
  await pool.end()
}
