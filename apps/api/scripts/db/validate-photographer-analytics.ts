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

async function main() {
  try {
    console.log("--- Image assets missing photographer FK ---")
    const missingPhotographer = await pool.query<{ image_assets_missing_photographer: string }>(`
      select count(*)::text as image_assets_missing_photographer
      from image_assets ia
      left join contributors p on p.id = ia.contributor_id
      where ia.contributor_id is not null
        and p.id is null
    `)
    console.log(missingPhotographer.rows[0])
    if (toNumber(missingPhotographer.rows[0]?.image_assets_missing_photographer) !== 0) {
      failures.push("image_assets_missing_photographer must be 0")
    }

    console.log("\n--- Download logs missing image asset FK ---")
    const missingImage = await pool.query<{ download_logs_missing_image: string }>(`
      select count(*)::text as download_logs_missing_image
      from image_download_logs l
      left join image_assets ia on ia.id = l.image_asset_id
      where l.image_asset_id is not null
        and ia.id is null
    `)
    console.log(missingImage.rows[0])
    if (toNumber(missingImage.rows[0]?.download_logs_missing_image) !== 0) {
      failures.push("download_logs_missing_image must be 0")
    }

    console.log("\n--- COMPLETED download logs missing image asset FK ---")
    const completedMissingImage = await pool.query<{ completed_logs_missing_image: string }>(`
      select count(*)::text as completed_logs_missing_image
      from image_download_logs l
      left join image_assets ia on ia.id = l.image_asset_id
      where l.download_status = 'COMPLETED'
        and ia.id is null
    `)
    console.log(completedMissingImage.rows[0])
    if (toNumber(completedMissingImage.rows[0]?.completed_logs_missing_image) !== 0) {
      failures.push("completed_logs_missing_image must be 0")
    }

    console.log("\n--- Photographers with at least one image (informational) ---")
    const withImages = await pool.query<{ contributors_with_images: string }>(`
      select count(distinct contributor_id)::text as contributors_with_images
      from image_assets
      where contributor_id is not null
    `)
    console.log(withImages.rows[0])

    console.log("\n--- Download log status distribution (informational) ---")
    const statuses = await pool.query<{ download_status: string; count: string }>(`
      select download_status, count(*)::text as count
      from image_download_logs
      group by download_status
      order by download_status
    `)
    console.log(statuses.rows)

    console.log("\n--- Sample analytics image breakdown (informational) ---")
    const breakdown = await pool.query<{
      total_images: string
      approved_live_images: string
      submitted_like_images: string
    }>(`
      select
        count(*)::text as total_images,
        count(*) filter (where ia.status = 'ACTIVE' and ia.visibility = 'PUBLIC')::text as approved_live_images,
        count(*) filter (
          where ia.visibility = 'PRIVATE' or ia.status in ('DRAFT', 'UNKNOWN')
        )::text as submitted_like_images
      from image_assets ia
      where ia.contributor_id is not null
    `)
    console.log(breakdown.rows[0])

    if (failures.length > 0) {
      console.error("\nFAIL:")
      for (const failure of failures) console.error(`  - ${failure}`)
      process.exitCode = 1
    } else {
      console.log("\nPASS photographer analytics validation.")
    }
  } finally {
    await pool.end()
  }
}

main()
