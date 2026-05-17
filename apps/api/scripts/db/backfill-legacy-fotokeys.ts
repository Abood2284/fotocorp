#!/usr/bin/env node
/**
 * ONE-TIME — delete after use. See scripts/db/ONE_TIME_SCRIPTS.md
 *
 * Backfill image_assets.fotokey (+ fotokey_date, fotokey_sequence, fotokey_assigned_at)
 * from legacy_image_code for legacy-import FC codes.
 *
 *   pnpm --dir apps/api db:backfill:legacy-fotokeys -- --dry-run
 *   pnpm --dir apps/api db:backfill:legacy-fotokeys
 *   pnpm --dir apps/api db:validate:fotokey-publish
 */
import dotenv from "dotenv"
import pg from "pg"
import {
  isLegacyImportFotokeyShape,
  parseLegacyFotokeyCode,
} from "../../src/lib/fotokey/parse-legacy-fotokey-code"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

interface CandidateRow {
  id: string
  legacy_image_code: string
  status: string
  visibility: string
  uploaded_at: Date | string | null
  image_date: Date | string | null
  created_at: Date | string
}

const BATCH_SIZE = 500
const dryRun = process.argv.includes("--dry-run")

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("FAIL DATABASE_URL is required.")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const candidates = await loadCandidates(pool)
    console.log(`candidates_with_null_fotokey: ${candidates.length}`)

    const winners = pickWinnersByCode(candidates)
    console.log(`unique_legacy_codes_to_backfill: ${winners.size}`)

    const existingFotokeys = await loadExistingFotokeys(pool)
    const updates: Array<{
      id: string
      fotokey: string
      fotokeyDate: string
      fotokeySequence: number
      fotokeyAssignedAt: Date
    }> = []

    let skippedParse = 0
    let skippedShape = 0
    let skippedConflict = 0
    const skippedDuplicateLosers = candidates.length - winners.size

    for (const row of winners.values()) {
      const code = row.legacy_image_code.trim()
      if (!isLegacyImportFotokeyShape(code)) {
        skippedShape += 1
        continue
      }

      const parsed = parseLegacyFotokeyCode(code)
      if (!parsed) {
        skippedParse += 1
        continue
      }

      if (existingFotokeys.has(parsed.fotokey)) {
        skippedConflict += 1
        continue
      }

      const fotokeyAssignedAt = coerceDate(row.uploaded_at) ?? coerceDate(row.image_date) ?? coerceDate(row.created_at)
      if (!fotokeyAssignedAt) continue

      updates.push({
        id: row.id,
        fotokey: parsed.fotokey,
        fotokeyDate: parsed.fotokeyDate,
        fotokeySequence: parsed.fotokeySequence,
        fotokeyAssignedAt,
      })
      existingFotokeys.add(parsed.fotokey)
    }

    console.log({
      dryRun,
      updatesReady: updates.length,
      skippedDuplicateLosers,
      skippedShape,
      skippedParse,
      skippedConflict,
    })

    if (dryRun) {
      console.log("Dry run complete — no rows written.")
      return
    }

    let applied = 0
    for (let offset = 0; offset < updates.length; offset += BATCH_SIZE) {
      const batch = updates.slice(offset, offset + BATCH_SIZE)
      await applyBatch(pool, batch)
      applied += batch.length
      console.log(`applied ${applied}/${updates.length}`)
    }

    await syncDailyCounters(pool)
    console.log("Synced fotokey_daily_counters from backfilled rows.")
    console.log(`OK backfilled ${applied} image_assets rows.`)
  } finally {
    await pool.end()
  }
}

async function loadCandidates(pool: pg.Pool) {
  const result = await pool.query<CandidateRow>(`
    select
      id,
      legacy_image_code,
      status,
      visibility,
      uploaded_at,
      image_date,
      created_at
    from image_assets
    where fotokey is null
      and legacy_image_code is not null
      and trim(legacy_image_code) <> ''
    order by legacy_image_code asc, created_at asc, id asc
  `)
  return result.rows
}

async function loadExistingFotokeys(pool: pg.Pool) {
  const result = await pool.query<{ fotokey: string }>(`
    select fotokey from image_assets where fotokey is not null
  `)
  return new Set(result.rows.map((row) => row.fotokey))
}

function pickWinnersByCode(rows: CandidateRow[]) {
  const winners = new Map<string, CandidateRow>()
  for (const row of rows) {
    const code = row.legacy_image_code.trim().toUpperCase()
    const current = winners.get(code)
    if (!current || compareWinnerPriority(row, current) < 0) {
      winners.set(code, row)
    }
  }
  return winners
}

function compareWinnerPriority(a: CandidateRow, b: CandidateRow) {
  const aPublic = a.status === "ACTIVE" && a.visibility === "PUBLIC" ? 0 : 1
  const bPublic = b.status === "ACTIVE" && b.visibility === "PUBLIC" ? 0 : 1
  if (aPublic !== bPublic) return aPublic - bPublic

  const aCreated = coerceDate(a.created_at)?.getTime() ?? Number.MAX_SAFE_INTEGER
  const bCreated = coerceDate(b.created_at)?.getTime() ?? Number.MAX_SAFE_INTEGER
  if (aCreated !== bCreated) return aCreated - bCreated

  return a.id.localeCompare(b.id)
}

async function applyBatch(
  pool: pg.Pool,
  batch: Array<{
    id: string
    fotokey: string
    fotokeyDate: string
    fotokeySequence: number
    fotokeyAssignedAt: Date
  }>,
) {
  const client = await pool.connect()
  try {
    await client.query("begin")
    for (const row of batch) {
      await client.query(
        `
          update image_assets
          set
            fotokey = $2,
            fotokey_date = $3::date,
            fotokey_sequence = $4,
            fotokey_assigned_at = $5::timestamptz,
            updated_at = now()
          where id = $1::uuid
            and fotokey is null
        `,
        [row.id, row.fotokey, row.fotokeyDate, row.fotokeySequence, row.fotokeyAssignedAt.toISOString()],
      )
    }
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

async function syncDailyCounters(pool: pg.Pool) {
  await pool.query(`
    insert into fotokey_daily_counters (code_date, last_sequence, updated_at)
    select fotokey_date, max(fotokey_sequence)::bigint, now()
    from image_assets
    where fotokey is not null
      and fotokey_date is not null
      and fotokey_sequence is not null
    group by fotokey_date
    on conflict (code_date) do update
    set last_sequence = greatest(fotokey_daily_counters.last_sequence, excluded.last_sequence),
        updated_at = now()
  `)
}

function coerceDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

main().catch((error) => {
  console.error("FAIL", error)
  process.exit(1)
})
