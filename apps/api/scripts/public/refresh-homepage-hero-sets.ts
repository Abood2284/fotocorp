#!/usr/bin/env node
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import pg from "pg"
import {
  parsePublicPreviewCdnConfig,
  resolvePublicStablePreviewUrl,
} from "../../src/lib/media/public-preview-cdn-url"
import { CARD_LIGHT_PREVIEW_PROFILE } from "../../src/lib/media/watermark"

const { Pool } = pg
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const apiRoot = resolve(__dirname, "../..")
const repoRoot = resolve(apiRoot, "../..")

const DEFAULT_CANDIDATE_POOL_SIZE = 500
const DEFAULT_SET_SIZE = 9
const DEFAULT_INTERVAL_MINUTES = 15
interface CliOptions {
  day: string
  dryRun: boolean
}

interface CandidateRow {
  id: string
  fotokey: string | null
  headline: string | null
  caption: string | null
  event_id: string | null
  event_name: string | null
  card_storage_key: string
}

interface HeroSetConfig {
  candidatePoolSize: number
  setSize: number
  intervalMinutes: number
}

loadLocalEnv()

async function main() {
  const startedAt = Date.now()
  const options = parseArgs(process.argv.slice(2))
  const config = readHeroSetConfig()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("Missing DATABASE_URL")

  const dayStart = parseUtcDayStart(options.day)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const setCount = (24 * 60) / config.intervalMinutes
  const cdn = parsePublicPreviewCdnConfig({
    PUBLIC_PREVIEW_CDN_BASE_URL: process.env.PUBLIC_PREVIEW_CDN_BASE_URL,
    PUBLIC_PREVIEW_CDN_VERSION: process.env.PUBLIC_PREVIEW_CDN_VERSION,
  })

  const pool = new Pool({ connectionString: databaseUrl })
  try {
    const candidates = await selectCandidates(pool, config.candidatePoolSize, cdn)
    const preparedCandidates = candidates.filter((row) => row.previewUrl)

    console.log(
      `[homepage-hero-sets] day=${options.day} pool=${config.candidatePoolSize} sets=${setCount} itemsPerSet=${config.setSize} candidates=${preparedCandidates.length} dryRun=${options.dryRun}`,
    )

    if (options.dryRun) {
      console.table(preparedCandidates.slice(0, 10).map((row, index) => ({
        rank: index + 1,
        assetId: row.id,
        eventName: row.eventName ?? "-",
        fotokey: row.fotokey ?? "-",
        previewUrl: row.previewUrl.slice(0, 80),
      })))
      console.info(JSON.stringify({
        event: "homepage_hero_sets_refresh",
        status: "dry_run",
        candidateCount: preparedCandidates.length,
        setCount,
        itemsPerSet: config.setSize,
        activeFrom: dayStart.toISOString(),
        activeUntil: dayEnd.toISOString(),
        durationMs: Date.now() - startedAt,
      }))
      return
    }

    await refreshDay(pool, {
      dayStart,
      dayEnd,
      config,
      candidates: preparedCandidates,
      generationRunId: randomUUID(),
      generatedAt: new Date(),
    })

    console.info(JSON.stringify({
      event: "homepage_hero_sets_refresh",
      status: "ok",
      candidateCount: preparedCandidates.length,
      setCount,
      itemsPerSet: config.setSize,
      activeFrom: dayStart.toISOString(),
      activeUntil: dayEnd.toISOString(),
      durationMs: Date.now() - startedAt,
    }))
  } finally {
    await pool.end()
  }
}

interface PreparedCandidate extends CandidateRow {
  previewUrl: string
  title: string
}

async function selectCandidates(
  pool: pg.Pool,
  poolSize: number,
  cdn: ReturnType<typeof parsePublicPreviewCdnConfig>,
): Promise<PreparedCandidate[]> {
  const result = await pool.query<CandidateRow>(
    `
      select
        a.id,
        a.fotokey,
        a.headline,
        a.caption,
        a.event_id,
        e.name as event_name,
        card.storage_key as card_storage_key
      from image_assets a
      join image_derivatives card
        on card.image_asset_id = a.id
       and card.variant = 'CARD'
       and card.generation_status = 'READY'
       and card.is_watermarked = true
       and card.watermark_profile = $1
      left join photo_events e on e.id = a.event_id
      where a.status = 'ACTIVE'
        and a.visibility = 'PUBLIC'
        and a.media_type = 'IMAGE'
        and a.original_exists_in_storage = true
        and nullif(btrim(card.storage_key), '') is not null
      order by
        case when a.event_id is not null then 0 else 1 end,
        a.image_date desc nulls last,
        a.created_at desc,
        a.id asc
      limit $2
    `,
    [CARD_LIGHT_PREVIEW_PROFILE, poolSize],
  )

  return result.rows.map((row) => mapPreparedCandidate(row, cdn))
}

function mapPreparedCandidate(
  row: CandidateRow,
  cdn: ReturnType<typeof parsePublicPreviewCdnConfig>,
): PreparedCandidate {
  const previewUrl = resolvePublicStablePreviewUrl(cdn, {
    storageKey: row.card_storage_key,
    assetId: row.id,
    variant: "CARD",
  })
  const title = row.event_name?.trim()
    || row.headline?.trim()
    || row.caption?.trim()
    || row.fotokey?.trim()
    || "Fotocorp image"

  return {
    ...row,
    previewUrl,
    title,
  }
}

async function refreshDay(
  pool: pg.Pool,
  params: {
    dayStart: Date
    dayEnd: Date
    config: HeroSetConfig
    candidates: PreparedCandidate[]
    generationRunId: string
    generatedAt: Date
  },
) {
  const { dayStart, dayEnd, config, candidates, generationRunId, generatedAt } = params
  const setCount = (24 * 60) / config.intervalMinutes
  const intervalMs = config.intervalMinutes * 60 * 1000
  const client = await pool.connect()

  try {
    await client.query("begin")
    await client.query(
      `
        delete from public_homepage_hero_sets
        where active_from >= $1::timestamptz
          and active_from < $2::timestamptz
      `,
      [dayStart.toISOString(), dayEnd.toISOString()],
    )

    for (let index = 0; index < setCount; index += 1) {
      const activeFrom = new Date(dayStart.getTime() + index * intervalMs)
      const activeUntil = new Date(activeFrom.getTime() + intervalMs)
      const setKey = buildSetKey(activeFrom, index)
      const selected = pickSetCandidates(candidates, config.setSize)

      const setResult = await client.query<{ id: string }>(
        `
          insert into public_homepage_hero_sets (
            set_key,
            active_from,
            active_until,
            generated_at,
            generation_run_id
          )
          values ($1, $2, $3, $4, $5)
          returning id
        `,
        [setKey, activeFrom.toISOString(), activeUntil.toISOString(), generatedAt.toISOString(), generationRunId],
      )

      const setId = setResult.rows[0]?.id
      if (!setId || selected.length === 0) continue

      for (let slot = 0; slot < selected.length; slot += 1) {
        const candidate = selected[slot]!
        await client.query(
          `
            insert into public_homepage_hero_set_items (
              set_id,
              slot,
              asset_id,
              preview_url,
              title,
              event_id,
              event_name,
              fotokey
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            setId,
            slot + 1,
            candidate.id,
            candidate.previewUrl,
            candidate.title,
            candidate.event_id,
            candidate.event_name,
            candidate.fotokey,
          ],
        )
      }
    }

    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

function pickSetCandidates(candidates: PreparedCandidate[], setSize: number) {
  if (candidates.length === 0) return []
  return shuffleArray(candidates).slice(0, Math.min(setSize, candidates.length))
}

function buildSetKey(activeFrom: Date, index: number) {
  const iso = activeFrom.toISOString().replace(/\.\d{3}Z$/, "Z")
  return `hero_${iso}_${String(index).padStart(4, "0")}`
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function readHeroSetConfig(): HeroSetConfig {
  return {
    candidatePoolSize: parsePositiveInt(process.env.HOMEPAGE_HERO_CANDIDATE_POOL_SIZE, DEFAULT_CANDIDATE_POOL_SIZE, 1, 2000),
    setSize: parsePositiveInt(process.env.HOMEPAGE_HERO_SET_SIZE, DEFAULT_SET_SIZE, 1, 20),
    intervalMinutes: parsePositiveInt(process.env.HOMEPAGE_HERO_SET_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES, 5, 60),
  }
}

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback
  return parsed
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    day: defaultDayKey(),
    dryRun: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--") continue
    if (arg === "--day") {
      options.day = requireValue(args, index, "--day")
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.day)) {
    throw new Error("--day must use YYYY-MM-DD format")
  }

  return options
}

function defaultDayKey(date = new Date()) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1))
  return next.toISOString().slice(0, 10)
}

function parseUtcDayStart(day: string) {
  const parsed = new Date(`${day}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid day: ${day}`)
  return parsed
}

function requireValue(args: string[], index: number, flag: string) {
  const value = args[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`)
  return value
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
  console.log(`Refresh precomputed homepage hero backdrop sets.

Usage:
  pnpm --dir apps/api homepage:refresh-hero-sets
  pnpm --dir apps/api homepage:refresh-hero-sets -- --day 2026-05-31 --dry-run

Options:
  --day YYYY-MM-DD  UTC day to generate [00:00, +24h). Defaults to next UTC calendar day.
  --dry-run         Print candidate sample without writing rows.

Env:
  HOMEPAGE_HERO_CANDIDATE_POOL_SIZE (default 500)
  HOMEPAGE_HERO_SET_SIZE (default 9)
  HOMEPAGE_HERO_SET_INTERVAL_MINUTES (default 15)
`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
