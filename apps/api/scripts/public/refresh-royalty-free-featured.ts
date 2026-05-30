#!/usr/bin/env node
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import pg from "pg"
import {
  CARD_LIGHT_PREVIEW_PROFILE,
  DETAIL_PREVIEW_PROFILE,
} from "../../src/lib/media/watermark"

const { Pool } = pg
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const apiRoot = resolve(__dirname, "../..")
const repoRoot = resolve(apiRoot, "../..")

interface CliOptions {
  period: string
  limit: number
  dryRun: boolean
}

interface CandidateRow {
  id: string
  category_name: string | null
  created_at: Date | string | null
}

loadLocalEnv()

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("Missing DATABASE_URL")

  const pool = new Pool({ connectionString: databaseUrl })
  try {
    const candidates = await selectCandidates(pool, options.limit)
    console.log(
      `[royalty-free-featured] period=${options.period} limit=${options.limit} selected=${candidates.length} dryRun=${options.dryRun}`,
    )
    console.log(
      "[royalty-free-featured] eligibility=ACTIVE+PUBLIC image assets with ready CARD and DETAIL previews; category name 'creative' is preferred when present, otherwise newest public-ready assets fill the feed.",
    )

    if (options.dryRun) {
      console.table(candidates.slice(0, 10).map((row, index) => ({
        rank: index + 1,
        assetId: row.id,
        category: row.category_name ?? "-",
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : "-",
      })))
      return
    }

    await refreshPeriod(pool, options.period, candidates)
    console.log(`[royalty-free-featured] refreshed period=${options.period} active=${candidates.length}`)
  } finally {
    await pool.end()
  }
}

async function selectCandidates(pool: pg.Pool, limit: number) {
  const result = await pool.query<CandidateRow>(
    `
      select
        a.id,
        coalesce(ac.name, ec.name) as category_name,
        a.created_at
      from image_assets a
      join image_derivatives card
        on card.image_asset_id = a.id
       and card.variant = 'CARD'
       and card.generation_status = 'READY'
       and card.is_watermarked = true
       and card.watermark_profile = $1
      join image_derivatives detail
        on detail.image_asset_id = a.id
       and detail.variant = 'DETAIL'
       and detail.generation_status = 'READY'
       and detail.is_watermarked = true
       and detail.watermark_profile = $2
      left join asset_categories ac on ac.id = a.category_id
      left join photo_events e on e.id = a.event_id
      left join asset_categories ec on ec.id = e.category_id
      where a.status = 'ACTIVE'
        and a.visibility = 'PUBLIC'
        and a.media_type = 'IMAGE'
        and a.original_exists_in_storage = true
      order by
        case
          when lower(coalesce(ac.name, ec.name, '')) = 'creative' then 0
          when lower(coalesce(ac.name, ec.name, '')) like '%creative%' then 1
          else 2
        end,
        a.created_at desc,
        a.id asc
      limit $3
    `,
    [CARD_LIGHT_PREVIEW_PROFILE, DETAIL_PREVIEW_PROFILE, limit],
  )

  return result.rows
}

async function refreshPeriod(pool: pg.Pool, period: string, candidates: CandidateRow[]) {
  const client = await pool.connect()
  try {
    await client.query("begin")
    await client.query(
      `
        delete from public_royalty_free_featured_items
        where period_key = $1
          and status = 'INACTIVE'
      `,
      [period],
    )
    await client.query(
      `
        update public_royalty_free_featured_items
        set status = 'INACTIVE',
            rank = rank + 100000,
            updated_at = now()
        where period_key = $1
      `,
      [period],
    )

    for (let index = 0; index < candidates.length; index += 1) {
      await client.query(
        `
          insert into public_royalty_free_featured_items (asset_id, period_key, rank, status)
          values ($1, $2, $3, 'ACTIVE')
          on conflict (period_key, asset_id)
          do update
          set rank = excluded.rank,
              status = 'ACTIVE',
              updated_at = now()
        `,
        [candidates[index]!.id, period, index + 1],
      )
    }

    await client.query(
      `
        update public_royalty_free_featured_items
        set updated_at = now()
        where period_key = $1
          and status = 'ACTIVE'
      `,
      [period],
    )
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    period: currentPeriodKey(),
    limit: 50,
    dryRun: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--") continue
    if (arg === "--period") {
      options.period = requireValue(args, index, "--period")
      index += 1
      continue
    }
    if (arg === "--limit") {
      options.limit = parseLimit(requireValue(args, index, "--limit"))
      index += 1
      continue
    }
    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }
    if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!/^\d{4}-\d{2}$/.test(options.period)) {
    throw new Error("--period must use YYYY-MM format")
  }

  return options
}

function parseLimit(value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    throw new Error("--limit must be an integer between 1 and 500")
  }
  return parsed
}

function requireValue(args: string[], index: number, flag: string) {
  const value = args[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`)
  return value
}

function currentPeriodKey(date = new Date()) {
  return date.toISOString().slice(0, 7)
}

function loadLocalEnv() {
  for (const path of [
    resolve(apiRoot, ".dev.vars"),
    resolve(apiRoot, ".env.local"),
    resolve(apiRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, ".env"),
  ]) {
    if (existsSync(path)) dotenv.config({ path, override: false })
  }
}

function printHelp() {
  console.log(`Refresh precomputed Royalty-Free featured feed.

Usage:
  pnpm --dir apps/api royalty-free:refresh-featured -- --period 2026-05 --limit 50

Options:
  --period YYYY-MM  Period key to refresh. Defaults to current UTC month.
  --limit N         Number of active rows to prepare. Defaults to 50, max 500.
  --dry-run         Print selected candidates without writing rows.
`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
