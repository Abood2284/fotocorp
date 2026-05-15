#!/usr/bin/env node
import dotenv from "dotenv"
import pg from "pg"
import { IMAGE_ASSETS_UPSERT } from "../legacy/sync-clean-schema-after-import.js"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("FAIL DATABASE_URL is required.")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })

async function main() {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const verifiedId = "11111111-1111-4111-8111-111111111111"
    const promoteId = "22222222-2222-4222-8222-222222222222"
    const verifiedCheckedAt = "2026-01-01T00:00:00.000Z"
    const promotedCheckedAt = "2026-01-02T00:00:00.000Z"

    await client.query(
      `
        insert into image_assets (
          id,
          legacy_source,
          legacy_asset_id,
          legacy_image_code,
          original_storage_key,
          original_file_name,
          original_file_extension,
          original_exists_in_storage,
          original_storage_checked_at,
          status,
          visibility,
          media_type,
          source
        )
        values
          ($1::uuid, 'SMOKE_R2_PRESERVE', 1, 'SMOKE_SKIP', 'SMOKE_SKIP.jpg', 'SMOKE_SKIP.jpg', 'jpg', true, $3::timestamptz, 'ACTIVE', 'PUBLIC', 'IMAGE', 'LEGACY_IMPORT'),
          ($2::uuid, 'SMOKE_R2_PRESERVE', 2, 'SMOKE_PROMOTE', 'SMOKE_PROMOTE.jpg', 'SMOKE_PROMOTE.jpg', 'jpg', false, null, 'UNKNOWN', 'PRIVATE', 'IMAGE', 'LEGACY_IMPORT')
      `,
      [verifiedId, promoteId, verifiedCheckedAt],
    )

    await client.query(
      `
        insert into assets (
          id,
          legacy_source,
          legacy_srno,
          legacy_imagecode,
          r2_original_key,
          original_filename,
          original_ext,
          r2_exists,
          r2_checked_at,
          status,
          visibility,
          media_type,
          source,
          legacy_payload
        )
        values
          ($1::uuid, 'SMOKE_R2_PRESERVE', 1, 'SMOKE_SKIP', 'SMOKE_SKIP.jpg', 'SMOKE_SKIP.jpg', 'jpg', false, null, 'APPROVED', 'PUBLIC', 'IMAGE', 'LEGACY_IMPORT', '{}'::jsonb),
          ($2::uuid, 'SMOKE_R2_PRESERVE', 2, 'SMOKE_PROMOTE', 'SMOKE_PROMOTE.jpg', 'SMOKE_PROMOTE.jpg', 'jpg', true, $3::timestamptz, 'APPROVED', 'PUBLIC', 'IMAGE', 'LEGACY_IMPORT', '{}'::jsonb)
      `,
      [verifiedId, promoteId, promotedCheckedAt],
    )

    await client.query(IMAGE_ASSETS_UPSERT)

    const result = await client.query<{
      legacy_asset_id: string
      original_exists_in_storage: boolean
      original_storage_checked_at: Date | null
      status: string
    }>(
      `
        select
          legacy_asset_id::text,
          original_exists_in_storage,
          original_storage_checked_at,
          status
        from image_assets
        where id in ($1::uuid, $2::uuid)
        order by legacy_asset_id
      `,
      [verifiedId, promoteId],
    )

    const verified = result.rows.find((row) => row.legacy_asset_id === "1")
    const promoted = result.rows.find((row) => row.legacy_asset_id === "2")
    const failures: string[] = []

    if (!verified?.original_exists_in_storage) {
      failures.push("skip-style false/null payload downgraded a previously verified clean image_asset")
    }
    if (verified?.original_storage_checked_at?.toISOString() !== verifiedCheckedAt) {
      failures.push("skip-style false/null payload overwrote original_storage_checked_at")
    }
    if (verified?.status !== "ACTIVE") {
      failures.push(`skip-style false/null payload changed status to ${verified?.status ?? "missing"}`)
    }
    if (!promoted?.original_exists_in_storage) {
      failures.push("verified true legacy payload did not promote a clean false image_asset to true")
    }
    if (promoted?.original_storage_checked_at?.toISOString() !== promotedCheckedAt) {
      failures.push("verified true legacy payload did not copy original_storage_checked_at")
    }

    await client.query("ROLLBACK")

    if (failures.length > 0) {
      console.error("FAIL legacy R2 preserve regression:")
      for (const failure of failures) console.error(`  - ${failure}`)
      process.exitCode = 1
      return
    }

    console.log("PASS legacy R2 preserve regression")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
