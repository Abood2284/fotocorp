#!/usr/bin/env node
/**
 * Idempotent sync: legacy tables → clean schema (contributors, photo_events, image_assets, image_derivatives).
 * Run after legacy import so runtime (which reads clean tables) sees new rows.
 */
import dotenv from "dotenv"
import pg from "pg"
import { pathToFileURL } from "node:url"
import {
  CARD_CLEAN_PROFILE,
  DETAIL_WATERMARKED_PROFILE,
  THUMB_CLEAN_PROFILE,
} from "../../src/lib/media/watermark.js"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

function parseArgs(argv: string[]) {
  let batchId: string | undefined
  const args = argv[0] === "--" ? argv.slice(1) : argv
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === "--batch-id") {
      batchId = args[++i]
      if (!batchId) throw new Error("--batch-id requires a value")
    } else if (a === "--help" || a === "-h") {
      console.log(`
Usage:
  pnpm --dir apps/api legacy:sync-clean-schema
  pnpm --dir apps/api legacy:sync-clean-schema -- --batch-id <uuid>

Note: batch-specific sync is deferred — old tables do not carry enough batch ownership
metadata to restrict sync safely. A batch id is accepted for forward compatibility only.
`)
      process.exit(0)
    }
  }
  return { batchId }
}

const PHOTOGRAPHER_UPSERT = `
WITH normalized_profiles AS (
  SELECT
    pp.id AS profile_id,
    CASE
      WHEN NULLIF(pp.legacy_payload->>'srno', 'NULL') ~ '^[0-9]+$'
      THEN (pp.legacy_payload->>'srno')::bigint
      ELSE NULL
    END AS legacy_photographer_id,
    COALESCE(
      NULLIF(btrim(pp.display_name), ''),
      NULLIF(btrim(concat_ws(' ', pp.legacy_payload->>'pfname', pp.legacy_payload->>'pmname', pp.legacy_payload->>'plname')), ''),
      'Legacy photographer'
    ) AS display_name,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pfname'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pfname')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pfname') END AS first_name,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pmname'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pmname')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pmname') END AS middle_name,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'plname'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'plname')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'plname') END AS last_name,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pemail'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pemail')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pemail') END AS email,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pmobile'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pmobile')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pmobile') END AS mobile_phone,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'ptel'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'ptel')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'ptel') END AS landline_phone,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'paddress'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'paddress')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'paddress') END AS address,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pcity'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pcity')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pcity') END AS city,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pstate'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pstate')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pstate') END AS state_region,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pcountry'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pcountry')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pcountry') END AS country,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pzip'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pzip')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pzip') END AS postal_code,
    CASE
      WHEN lower(btrim(coalesce(pp.legacy_payload->>'pstatus', ''))) = 'yes' OR btrim(coalesce(pp.legacy_payload->>'pstatus', '')) = '1' THEN 'ACTIVE'
      WHEN lower(btrim(coalesce(pp.legacy_payload->>'pstatus', ''))) = 'no' THEN 'INACTIVE'
      WHEN btrim(coalesce(pp.legacy_payload->>'pstatus', '')) = 'Deleted' THEN 'DELETED'
      ELSE 'UNKNOWN'
    END AS status,
    CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pstatus'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pstatus')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pstatus') END AS legacy_status,
    pp.legacy_payload,
    pp.created_at,
    pp.id::text AS profile_id_text,
    CASE WHEN coalesce(NULLIF(btrim(pp.legacy_payload->>'pemail'), ''), NULLIF(btrim(pp.email), '')) ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$' THEN 1 ELSE 0 END AS has_valid_email,
    CASE WHEN lower(btrim(coalesce(pp.legacy_payload->>'pstatus', ''))) = 'yes' OR btrim(coalesce(pp.legacy_payload->>'pstatus', '')) = '1' THEN 1 ELSE 0 END AS has_active_status,
    (
      CASE WHEN NULLIF(btrim(pp.display_name), '') IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pfname'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pfname')) <> 'NULL' THEN 1 ELSE 0 END +
      CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pmname'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pmname')) <> 'NULL' THEN 1 ELSE 0 END +
      CASE WHEN NULLIF(btrim(pp.legacy_payload->>'plname'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'plname')) <> 'NULL' THEN 1 ELSE 0 END +
      CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pemail'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pemail')) <> 'NULL' THEN 1 ELSE 0 END +
      CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pmobile'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pmobile')) <> 'NULL' THEN 1 ELSE 0 END +
      CASE WHEN NULLIF(btrim(pp.legacy_payload->>'ptel'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'ptel')) <> 'NULL' THEN 1 ELSE 0 END +
      CASE WHEN NULLIF(btrim(pp.legacy_payload->>'paddress'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'paddress')) <> 'NULL' THEN 1 ELSE 0 END +
      CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pcity'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pcity')) <> 'NULL' THEN 1 ELSE 0 END +
      CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pstate'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pstate')) <> 'NULL' THEN 1 ELSE 0 END +
      CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pcountry'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pcountry')) <> 'NULL' THEN 1 ELSE 0 END +
      CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pzip'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pzip')) <> 'NULL' THEN 1 ELSE 0 END
    ) AS richness_score
  FROM photographer_profiles pp
),
canonical_photographer_profiles AS (
  SELECT *
  FROM (
    SELECT
      normalized_profiles.*,
      row_number() OVER (
        PARTITION BY legacy_photographer_id
        ORDER BY has_valid_email DESC, has_active_status DESC, richness_score DESC, created_at ASC NULLS LAST, profile_id_text ASC
      ) AS canonical_rank
    FROM normalized_profiles
    WHERE legacy_photographer_id IS NOT NULL
  ) ranked
  WHERE canonical_rank = 1
)
INSERT INTO contributors (
  legacy_photographer_id,
  display_name,
  first_name,
  middle_name,
  last_name,
  email,
  mobile_phone,
  landline_phone,
  address,
  city,
  state_region,
  country,
  postal_code,
  status,
  legacy_status,
  source,
  legacy_payload,
  updated_at
)
SELECT
  legacy_photographer_id,
  display_name,
  first_name,
  middle_name,
  last_name,
  email,
  mobile_phone,
  landline_phone,
  address,
  city,
  state_region,
  country,
  postal_code,
  status,
  legacy_status,
  'LEGACY_IMPORT',
  legacy_payload,
  now()
FROM canonical_photographer_profiles
ON CONFLICT (legacy_photographer_id) DO UPDATE SET
  display_name = excluded.display_name,
  first_name = excluded.first_name,
  middle_name = excluded.middle_name,
  last_name = excluded.last_name,
  email = excluded.email,
  mobile_phone = excluded.mobile_phone,
  landline_phone = excluded.landline_phone,
  address = excluded.address,
  city = excluded.city,
  state_region = excluded.state_region,
  country = excluded.country,
  postal_code = excluded.postal_code,
  status = excluded.status,
  legacy_status = excluded.legacy_status,
  source = excluded.source,
  legacy_payload = excluded.legacy_payload,
  updated_at = now();
`

const ASSETS_LEGACY_PHOTO_BACKFILL = `
UPDATE assets
SET legacy_photographer_id = (legacy_payload->>'photographid')::bigint
WHERE legacy_photographer_id IS NULL
  AND legacy_payload->>'photographid' ~ '^[0-9]+$';
`

const PHOTO_EVENTS_UPSERT = `
INSERT INTO photo_events (
  id,
  legacy_event_id,
  name,
  description,
  event_date,
  event_time,
  country,
  state_region,
  city,
  location,
  keywords,
  photo_count,
  unpublished_photo_count,
  default_main_image_code,
  default_unpublished_main_image_code,
  small_image_code_1,
  small_image_code_2,
  status,
  source,
  legacy_payload,
  created_at,
  updated_at
)
SELECT
  ae.id,
  ae.legacy_event_id,
  COALESCE(NULLIF(btrim(ae.name), ''), NULLIF(btrim(ae.legacy_payload->>'eventname'), ''), 'Untitled event') AS name,
  NULL::text AS description,
  ae.event_date,
  NULLIF(btrim(ae.legacy_payload->>'eventtime'), '') AS event_time,
  ae.country,
  ae.state AS state_region,
  ae.city,
  ae.location,
  ae.keywords,
  ae.photo_count,
  ae.photo_count_unpublished AS unpublished_photo_count,
  NULLIF(btrim(ae.legacy_payload->>'defaultmain'), '') AS default_main_image_code,
  NULLIF(btrim(ae.legacy_payload->>'defaultmainunpub'), '') AS default_unpublished_main_image_code,
  ae.small_image_1 AS small_image_code_1,
  ae.small_image_2 AS small_image_code_2,
  CASE
    WHEN btrim(coalesce(ae.legacy_payload->>'status', '')) = '1' OR lower(btrim(coalesce(ae.legacy_payload->>'status', ''))) IN ('yes', 'active') THEN 'ACTIVE'
    WHEN btrim(coalesce(ae.legacy_payload->>'status', '')) = '0' OR lower(btrim(coalesce(ae.legacy_payload->>'status', ''))) IN ('no', 'inactive') THEN 'INACTIVE'
    WHEN lower(btrim(coalesce(ae.legacy_payload->>'status', ''))) = 'deleted' THEN 'DELETED'
    ELSE 'UNKNOWN'
  END AS status,
  'LEGACY_IMPORT' AS source,
  ae.legacy_payload,
  ae.created_at,
  ae.updated_at
FROM asset_events ae
ON CONFLICT (id) DO UPDATE SET
  legacy_event_id = excluded.legacy_event_id,
  name = excluded.name,
  description = excluded.description,
  event_date = excluded.event_date,
  event_time = excluded.event_time,
  country = excluded.country,
  state_region = excluded.state_region,
  city = excluded.city,
  location = excluded.location,
  keywords = excluded.keywords,
  photo_count = excluded.photo_count,
  unpublished_photo_count = excluded.unpublished_photo_count,
  default_main_image_code = excluded.default_main_image_code,
  default_unpublished_main_image_code = excluded.default_unpublished_main_image_code,
  small_image_code_1 = excluded.small_image_code_1,
  small_image_code_2 = excluded.small_image_code_2,
  status = excluded.status,
  source = excluded.source,
  legacy_payload = excluded.legacy_payload,
  updated_at = excluded.updated_at;
`

export const IMAGE_ASSETS_UPSERT = `
INSERT INTO image_assets (
  id,
  legacy_source,
  legacy_asset_id,
  legacy_image_code,
  title,
  headline,
  caption,
  description,
  keywords,
  event_keywords,
  search_text,
  image_location,
  contributor_id,
  legacy_photographer_id,
  event_id,
  legacy_event_id,
  category_id,
  legacy_category_id,
  legacy_subcategory_id,
  original_storage_key,
  original_file_name,
  original_file_extension,
  original_exists_in_storage,
  original_storage_checked_at,
  image_date,
  uploaded_at,
  legacy_status,
  status,
  visibility,
  media_type,
  source,
  legacy_payload,
  created_at,
  updated_at
)
SELECT
  a.id,
  a.legacy_source,
  a.legacy_srno AS legacy_asset_id,
  a.legacy_imagecode AS legacy_image_code,
  a.title,
  a.headline,
  a.caption,
  a.description,
  a.keywords,
  a.event_keywords,
  a.search_text,
  a.image_location,
  p.id AS contributor_id,
  a.legacy_photographer_id,
  a.event_id,
  a.legacy_event_id,
  a.category_id,
  CASE WHEN NULLIF(a.legacy_payload->>'catid', 'NULL') ~ '^[0-9]+$' THEN (a.legacy_payload->>'catid')::bigint ELSE NULL END AS legacy_category_id,
  CASE WHEN NULLIF(a.legacy_payload->>'subcatid', 'NULL') ~ '^[0-9]+$' THEN (a.legacy_payload->>'subcatid')::bigint ELSE NULL END AS legacy_subcategory_id,
  a.r2_original_key AS original_storage_key,
  a.original_filename AS original_file_name,
  a.original_ext AS original_file_extension,
  a.r2_exists AS original_exists_in_storage,
  CASE WHEN a.r2_exists = true THEN a.r2_checked_at ELSE NULL END AS original_storage_checked_at,
  a.image_date,
  a.uploaded_at,
  a.legacy_status,
  CASE
    WHEN a.status = 'DELETED' THEN 'DELETED'
    WHEN a.status IN ('REJECTED', 'ARCHIVED') THEN 'ARCHIVED'
    WHEN a.status IN ('REVIEW', 'DRAFT') THEN 'DRAFT'
    WHEN a.status IN ('APPROVED', 'ACTIVE', 'READY', 'PUBLISHED') THEN 'ACTIVE'
    WHEN a.r2_exists = false AND a.r2_checked_at IS NOT NULL THEN 'MISSING_ORIGINAL'
    ELSE 'UNKNOWN'
  END AS status,
  CASE WHEN a.visibility IN ('PUBLIC', 'PRIVATE', 'UNLISTED') THEN a.visibility ELSE 'PRIVATE' END AS visibility,
  'IMAGE' AS media_type,
  CASE WHEN a.source IN ('LEGACY_IMPORT', 'MANUAL') THEN a.source ELSE 'LEGACY_IMPORT' END AS source,
  a.legacy_payload,
  a.created_at,
  a.updated_at
FROM assets a
LEFT JOIN contributors p ON p.legacy_photographer_id = a.legacy_photographer_id
ON CONFLICT (id) DO UPDATE SET
  legacy_source = excluded.legacy_source,
  legacy_asset_id = excluded.legacy_asset_id,
  legacy_image_code = excluded.legacy_image_code,
  title = excluded.title,
  headline = excluded.headline,
  caption = excluded.caption,
  description = excluded.description,
  keywords = excluded.keywords,
  event_keywords = excluded.event_keywords,
  search_text = excluded.search_text,
  image_location = excluded.image_location,
  contributor_id = excluded.contributor_id,
  legacy_photographer_id = excluded.legacy_photographer_id,
  event_id = excluded.event_id,
  legacy_event_id = excluded.legacy_event_id,
  category_id = excluded.category_id,
  legacy_category_id = excluded.legacy_category_id,
  legacy_subcategory_id = excluded.legacy_subcategory_id,
  original_storage_key = excluded.original_storage_key,
  original_file_name = excluded.original_file_name,
  original_file_extension = excluded.original_file_extension,
  original_exists_in_storage = image_assets.original_exists_in_storage OR excluded.original_exists_in_storage,
  original_storage_checked_at = CASE
    WHEN excluded.original_exists_in_storage = true THEN excluded.original_storage_checked_at
    WHEN image_assets.original_exists_in_storage = true THEN image_assets.original_storage_checked_at
    ELSE image_assets.original_storage_checked_at
  END,
  image_date = excluded.image_date,
  uploaded_at = excluded.uploaded_at,
  legacy_status = excluded.legacy_status,
  status = CASE
    WHEN image_assets.original_exists_in_storage = true AND excluded.original_exists_in_storage = false THEN image_assets.status
    ELSE excluded.status
  END,
  visibility = excluded.visibility,
  media_type = excluded.media_type,
  source = excluded.source,
  legacy_payload = excluded.legacy_payload,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;
`

export const IMAGE_DERIVATIVES_UPSERT = `
INSERT INTO image_derivatives (
  id,
  image_asset_id,
  variant,
  storage_key,
  mime_type,
  width,
  height,
  size_bytes,
  checksum,
  is_watermarked,
  watermark_profile,
  generation_status,
  generated_at,
  source,
  created_at,
  updated_at
)
SELECT
  old.id,
  old.asset_id AS image_asset_id,
  CASE lower(old.variant)
    WHEN 'thumb' THEN 'THUMB'
    WHEN 'card' THEN 'CARD'
    WHEN 'detail' THEN 'DETAIL'
  END AS variant,
  old.r2_key AS storage_key,
  old.mime_type,
  old.width,
  old.height,
  old.byte_size AS size_bytes,
  old.checksum,
  old.is_watermarked,
  old.watermark_profile,
  old.generation_status,
  old.generated_at,
  'LEGACY_MIGRATION' AS source,
  old.created_at,
  old.updated_at
FROM asset_media_derivatives old
JOIN image_assets ia ON ia.id = old.asset_id
WHERE lower(old.variant) IN ('thumb', 'card', 'detail')
ON CONFLICT (image_asset_id, variant) DO UPDATE SET
  image_asset_id = excluded.image_asset_id,
  variant = excluded.variant,
  storage_key = excluded.storage_key,
  mime_type = excluded.mime_type,
  width = excluded.width,
  height = excluded.height,
  size_bytes = excluded.size_bytes,
  checksum = excluded.checksum,
  is_watermarked = excluded.is_watermarked,
  watermark_profile = excluded.watermark_profile,
  generation_status = excluded.generation_status,
  generated_at = excluded.generated_at,
  source = excluded.source,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at
WHERE NOT (
  (
    image_derivatives.variant = 'THUMB'
    AND image_derivatives.generation_status = 'READY'
    AND image_derivatives.is_watermarked = false
    AND image_derivatives.watermark_profile = '${THUMB_CLEAN_PROFILE}'
  )
  OR (
    image_derivatives.variant = 'CARD'
    AND image_derivatives.generation_status = 'READY'
    AND image_derivatives.is_watermarked = false
    AND image_derivatives.watermark_profile = '${CARD_CLEAN_PROFILE}'
  )
  OR (
    image_derivatives.variant = 'DETAIL'
    AND image_derivatives.generation_status = 'READY'
    AND image_derivatives.is_watermarked = true
    AND image_derivatives.watermark_profile = '${DETAIL_WATERMARKED_PROFILE}'
  )
);
`

async function main() {
  const { batchId } = parseArgs(process.argv.slice(2))
  if (batchId) {
    console.log("batch-specific sync deferred because old tables do not carry enough batch ownership metadata")
    console.log(`(ignored --batch-id ${batchId})`)
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("DATABASE_URL is required (.dev.vars or env).")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  try {
    const unknownVariants = await pool.query<{ variant: string; count: string }>(`
      select variant, count(*)::text as count
      from asset_media_derivatives
      where lower(variant) not in ('thumb', 'card', 'detail')
      group by variant
    `)
    if (unknownVariants.rows.length > 0) {
      console.error("FAIL: unknown asset_media_derivatives.variant values (normalize or fix before sync):")
      for (const row of unknownVariants.rows) console.error(`  variant=${row.variant} count=${row.count}`)
      process.exitCode = 1
      return
    }

    const legacyEventConflicts = await pool.query<{ ae_id: string; pe_id: string; legacy_event_id: string }>(`
      select ae.id::text as ae_id, pe.id::text as pe_id, ae.legacy_event_id::text as legacy_event_id
      from asset_events ae
      join photo_events pe
        on ae.legacy_event_id is not null
        and pe.legacy_event_id = ae.legacy_event_id
        and pe.id <> ae.id
    `)
    if (legacyEventConflicts.rows.length > 0) {
      console.error("FAIL: legacy_event_id maps to mismatched UUIDs between asset_events and photo_events:")
      for (const row of legacyEventConflicts.rows.slice(0, 20)) {
        console.error(`  legacy_event_id=${row.legacy_event_id} asset_events.id=${row.ae_id} photo_events.id=${row.pe_id}`)
      }
      if (legacyEventConflicts.rows.length > 20) console.error(`  ... and ${legacyEventConflicts.rows.length - 20} more`)
      process.exitCode = 1
      return
    }

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const pRes = await client.query(PHOTOGRAPHER_UPSERT)
      const backfillRes = await client.query(ASSETS_LEGACY_PHOTO_BACKFILL)
      const eRes = await client.query(PHOTO_EVENTS_UPSERT)
      const aRes = await client.query(IMAGE_ASSETS_UPSERT)
      const orphanOldDerivatives = await client.query<{ c: string }>(`
        select count(*)::text as c
        from asset_media_derivatives old
        left join image_assets ia on ia.id = old.asset_id
        where ia.id is null
      `)
      const orphanCount = Number(orphanOldDerivatives.rows[0]?.c ?? 0)
      const dRes = await client.query(IMAGE_DERIVATIVES_UPSERT)
      await client.query("COMMIT")

      const contributorsUpserted = pRes.rowCount ?? 0
      const assetsBackfilled = backfillRes.rowCount ?? 0
      const eventsUpserted = eRes.rowCount ?? 0
      const imageAssetsUpserted = aRes.rowCount ?? 0
      const derivativesUpserted = dRes.rowCount ?? 0

      console.log(JSON.stringify({
        ok: true,
        contributorsUpserted,
        assetsLegacyPhotographerBackfillRows: assetsBackfilled,
        photoEventsUpserted: eventsUpserted,
        imageAssetsUpserted,
        imageDerivativesUpserted: derivativesUpserted,
        derivativeRowsSkippedMissingImageAsset: orphanCount,
      }, null, 2))
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {})
      console.error(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
