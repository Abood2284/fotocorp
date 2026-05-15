#!/usr/bin/env node
import dotenv from "dotenv"
import pg from "pg"
import {
  CARD_CLEAN_PROFILE,
  THUMB_CLEAN_PROFILE,
} from "../../src/lib/media/watermark.js"
import { IMAGE_DERIVATIVES_UPSERT } from "../legacy/sync-clean-schema-after-import.js"

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

    const assetId = "33333333-3333-4333-8333-333333333333"
    const modernThumbId = "44444444-4444-4444-8444-444444444444"
    const modernCardId = "55555555-5555-4555-8555-555555555555"
    const legacyThumbId = "66666666-6666-4666-8666-666666666666"
    const legacyCardId = "77777777-7777-4777-8777-777777777777"

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
        values (
          $1::uuid,
          'SMOKE_DERIVATIVE_PRESERVE',
          1,
          'SMOKE_DERIVATIVE',
          'SMOKE_DERIVATIVE.jpg',
          'SMOKE_DERIVATIVE.jpg',
          'jpg',
          true,
          now(),
          'APPROVED',
          'PUBLIC',
          'IMAGE',
          'LEGACY_IMPORT',
          '{}'::jsonb
        )
      `,
      [assetId],
    )

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
        values (
          $1::uuid,
          'SMOKE_DERIVATIVE_PRESERVE',
          1,
          'SMOKE_DERIVATIVE',
          'SMOKE_DERIVATIVE.jpg',
          'SMOKE_DERIVATIVE.jpg',
          'jpg',
          true,
          now(),
          'ACTIVE',
          'PUBLIC',
          'IMAGE',
          'LEGACY_IMPORT'
        )
      `,
      [assetId],
    )

    await client.query(
      `
        insert into image_derivatives (
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
        values
          ($1::uuid, $3::uuid, 'THUMB', 'modern/thumb.webp', 'image/webp', 220, 140, 1000, 'modern-thumb', false, $4, 'READY', now(), 'GENERATED', now(), now()),
          ($2::uuid, $3::uuid, 'CARD', 'modern/card.webp', 'image/webp', 300, 190, 2000, 'modern-card', false, $5, 'READY', now(), 'GENERATED', now(), now())
      `,
      [modernThumbId, modernCardId, assetId, THUMB_CLEAN_PROFILE, CARD_CLEAN_PROFILE],
    )

    await client.query(
      `
        insert into asset_media_derivatives (
          id,
          asset_id,
          variant,
          r2_key,
          mime_type,
          width,
          height,
          byte_size,
          checksum,
          is_watermarked,
          watermark_profile,
          generation_status,
          generated_at,
          created_at,
          updated_at
        )
        values
          ($1::uuid, $3::uuid, 'thumb', 'legacy/thumb.webp', 'image/webp', 220, 140, 1111, 'legacy-thumb', true, 'legacy-watermarked-profile', 'READY', now(), now(), now()),
          ($2::uuid, $3::uuid, 'card', 'legacy/card.webp', 'image/webp', 300, 190, 2222, 'legacy-card', true, 'legacy-watermarked-profile', 'READY', now(), now(), now())
      `,
      [legacyThumbId, legacyCardId, assetId],
    )

    await client.query(IMAGE_DERIVATIVES_UPSERT)

    const result = await client.query<{
      variant: string
      storage_key: string
      is_watermarked: boolean
      watermark_profile: string | null
      generation_status: string
      source: string
    }>(
      `
        select
          variant,
          storage_key,
          is_watermarked,
          watermark_profile,
          generation_status,
          source
        from image_derivatives
        where image_asset_id = $1::uuid
        order by variant
      `,
      [assetId],
    )

    const thumb = result.rows.find((row) => row.variant === "THUMB")
    const card = result.rows.find((row) => row.variant === "CARD")
    const failures: string[] = []

    if (!thumb || thumb.generation_status !== "READY" || thumb.is_watermarked !== false || thumb.watermark_profile !== THUMB_CLEAN_PROFILE) {
      failures.push("THUMB clean READY profile was overwritten by legacy sync")
    }
    if (thumb?.storage_key !== "modern/thumb.webp" || thumb?.source !== "GENERATED") {
      failures.push("THUMB modern storage/source metadata was overwritten by legacy sync")
    }
    if (!card || card.generation_status !== "READY" || card.is_watermarked !== false || card.watermark_profile !== CARD_CLEAN_PROFILE) {
      failures.push("CARD clean READY profile was overwritten by legacy sync")
    }
    if (card?.storage_key !== "modern/card.webp" || card?.source !== "GENERATED") {
      failures.push("CARD modern storage/source metadata was overwritten by legacy sync")
    }

    await client.query("ROLLBACK")

    if (failures.length > 0) {
      console.error("FAIL legacy derivative preserve regression:")
      for (const failure of failures) console.error(`  - ${failure}`)
      process.exitCode = 1
      return
    }

    console.log("PASS legacy derivative preserve regression")
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
