#!/usr/bin/env node
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import pg from "pg"
import {
  buildPublicPreviewCdnUrl,
  type PublicPreviewCdnConfig,
} from "../../src/lib/media/public-preview-cdn-url"
import { buildPublicStablePreviewPath } from "../../src/lib/media/stable-preview-path"
import {
  CARD_LIGHT_PREVIEW_PROFILE,
  DETAIL_PREVIEW_PROFILE,
  THUMB_LIGHT_PREVIEW_PROFILE,
} from "../../src/lib/media/watermark"

const { Pool } = pg
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const apiRoot = resolve(__dirname, "../..")
const repoRoot = resolve(apiRoot, "../..")

interface CliOptions {
  batchSize: number
  limit?: number
  dryRun: boolean
  resumeAfterId?: string
  collection?: string
}

interface EnvConfig {
  databaseUrl: string
  typesenseHost: string
  typesenseApiKey: string
  collection: string
  cdn: PublicPreviewCdnConfig
}

interface TypesenseCollectionField {
  name: string
  type: string
  facet?: boolean
  optional?: boolean
  sort?: boolean
}

interface TypesenseCollectionSchema {
  name: string
  fields: TypesenseCollectionField[]
  default_sorting_field?: string
}

interface AssetRow {
  id: string
  fotokey: string | null
  who_is_in_picture: string | null
  headline: string | null
  caption: string | null
  description: string | null
  search_text: string | null
  keywords: unknown
  event_keywords: unknown
  image_date: Date | string | null
  created_at: Date | string | null
  updated_at: Date | string | null
  status: string
  visibility: string
  source: string
  media_type: string
  event_id: string | null
  event_title: string | null
  event_date: Date | string | null
  event_location: string | null
  category_id: string | null
  category_name: string | null
  contributor_id: string | null
  contributor_display_name: string | null
  thumb_storage_key: string | null
  thumb_width: number | null
  thumb_height: number | null
  card_storage_key: string | null
  card_width: number | null
  card_height: number | null
  detail_storage_key: string | null
  detail_width: number | null
  detail_height: number | null
}

type TypesenseDocument = Record<string, string | number | string[] | null>

loadLocalEnv()

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const env = loadEnv(options)
  const pool = new Pool({ connectionString: env.databaseUrl })

  let indexed = 0
  let batchNumber = 0
  let lastAssetId = options.resumeAfterId ?? null

  try {
    console.log(
      `[typesense-index] collection=${env.collection} dryRun=${options.dryRun} batchSize=${options.batchSize}` +
        (options.limit ? ` limit=${options.limit}` : "") +
        (lastAssetId ? ` resumeAfterId=${lastAssetId}` : ""),
    )

    if (!options.dryRun && options.collection) {
      await ensureCollection(env)
    }

    if (options.dryRun) {
      const candidateCount = await getCandidateCount(pool).catch((error: unknown) => {
        console.warn(`[typesense-index] candidate count skipped: ${errorMessage(error)}`)
        return null
      })
      if (candidateCount !== null) {
        console.log(`[typesense-index] total candidates=${candidateCount}`)
      }
    }

    while (options.limit === undefined || indexed < options.limit) {
      const remaining = options.limit === undefined
        ? options.batchSize
        : Math.min(options.batchSize, options.limit - indexed)
      if (remaining <= 0) break

      const rows = await selectBatch(pool, lastAssetId, remaining)
      if (rows.length === 0) break

      batchNumber += 1
      const documents = rows.map((row) => toTypesenseDocument(row, env.cdn))
      lastAssetId = rows[rows.length - 1]?.id ?? lastAssetId

      if (options.dryRun) {
        if (batchNumber === 1) {
          console.log("[typesense-index] first 3 generated documents")
          for (const document of documents.slice(0, 3)) {
            console.log(JSON.stringify(document, null, 2))
          }
        }
      } else {
        await importBatch(env, documents)
      }

      indexed += documents.length
      console.log(
        `[typesense-index] batch=${batchNumber} indexed=${documents.length} lastAssetId=${lastAssetId} failures=0`,
      )
    }

    console.log(`[typesense-index] done indexed=${indexed} lastAssetId=${lastAssetId ?? "none"}`)
  } finally {
    await pool.end()
  }
}

async function getCandidateCount(pool: pg.Pool): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      select count(*)::text as count
      from image_assets a
      join image_derivatives card
        on card.image_asset_id = a.id
       and card.variant = 'CARD'
       and card.generation_status = 'READY'
       and card.is_watermarked = true
       and card.watermark_profile = $1
      where a.status = 'ACTIVE'
        and a.visibility = 'PUBLIC'
        and a.media_type = 'IMAGE'
        and a.original_exists_in_storage = true
    `,
    [CARD_LIGHT_PREVIEW_PROFILE],
  )
  return Number.parseInt(result.rows[0]?.count ?? "0", 10)
}

async function selectBatch(pool: pg.Pool, resumeAfterId: string | null, limit: number): Promise<AssetRow[]> {
  const result = await pool.query<AssetRow>(
    `
      select
        a.id::text,
        a.fotokey,
        a.who_is_in_picture,
        a.headline,
        a.caption,
        a.description,
        a.search_text,
        a.keywords,
        a.event_keywords,
        a.image_date,
        a.created_at,
        a.updated_at,
        a.status,
        a.visibility,
        a.source,
        a.media_type,
        e.id::text as event_id,
        e.name as event_title,
        e.event_date,
        e.location as event_location,
        coalesce(ac.id, ec.id)::text as category_id,
        coalesce(ac.name, ec.name) as category_name,
        c.id::text as contributor_id,
        c.display_name as contributor_display_name,
        thumb.storage_key as thumb_storage_key,
        thumb.width as thumb_width,
        thumb.height as thumb_height,
        card.storage_key as card_storage_key,
        card.width as card_width,
        card.height as card_height,
        detail.storage_key as detail_storage_key,
        detail.width as detail_width,
        detail.height as detail_height
      from image_assets a
      join image_derivatives card
        on card.image_asset_id = a.id
       and card.variant = 'CARD'
       and card.generation_status = 'READY'
       and card.is_watermarked = true
       and card.watermark_profile = $1
      left join image_derivatives thumb
        on thumb.image_asset_id = a.id
       and thumb.variant = 'THUMB'
       and thumb.generation_status = 'READY'
       and thumb.is_watermarked = true
       and thumb.watermark_profile = $2
      left join image_derivatives detail
        on detail.image_asset_id = a.id
       and detail.variant = 'DETAIL'
       and detail.generation_status = 'READY'
       and detail.is_watermarked = true
       and detail.watermark_profile = $3
      left join photo_events e on e.id = a.event_id
      left join asset_categories ac on ac.id = a.category_id
      left join asset_categories ec on ec.id = e.category_id
      left join contributors c on c.id = a.contributor_id
      where a.status = 'ACTIVE'
        and a.visibility = 'PUBLIC'
        and a.media_type = 'IMAGE'
        and a.original_exists_in_storage = true
        and ($4::uuid is null or a.id > $4::uuid)
      order by a.id asc
      limit $5
    `,
    [CARD_LIGHT_PREVIEW_PROFILE, THUMB_LIGHT_PREVIEW_PROFILE, DETAIL_PREVIEW_PROFILE, resumeAfterId, limit],
  )
  return result.rows
}

function toTypesenseDocument(row: AssetRow, cdn: PublicPreviewCdnConfig): TypesenseDocument {
  const keywords = normalizeStringList(row.keywords)
  const eventKeywords = normalizeStringList(row.event_keywords)
  const people = parsePeople(row.who_is_in_picture)

  return dropUndefined({
    id: row.id,
    asset_id: row.id,

    fotokey: row.fotokey,

    event_title: row.event_title,
    caption: row.caption,
    description: row.description,
    who_is_in_picture: row.who_is_in_picture,
    search_text: row.search_text,

    keywords,
    event_keywords: eventKeywords,
    people,

    event_id: row.event_id,
    event_date_ts: toUnixSeconds(row.event_date),
    event_location: row.event_location,
    city: row.event_location,

    category_id: row.category_id,
    category_name: row.category_name,

    contributor_id: row.contributor_id,
    contributor_display_name: row.contributor_display_name,

    status: row.status,
    visibility: row.visibility,
    source: row.source,
    media_type: row.media_type,

    image_date_ts: toUnixSeconds(row.image_date),
    created_at_ts: toUnixSeconds(row.created_at),
    updated_at_ts: toUnixSeconds(row.updated_at),

    preview_thumb_url: previewUrl(cdn, row.id, row.thumb_storage_key, "thumb"),
    preview_card_url: previewUrl(cdn, row.id, row.card_storage_key, "card"),
    preview_detail_url: previewUrl(cdn, row.id, row.detail_storage_key, "detail"),

    preview_thumb_storage_key: row.thumb_storage_key,
    preview_card_storage_key: row.card_storage_key,
    preview_detail_storage_key: row.detail_storage_key,

    preview_thumb_width: row.thumb_width,
    preview_thumb_height: row.thumb_height,
    preview_card_width: row.card_width,
    preview_card_height: row.card_height,
    preview_detail_width: row.detail_width,
    preview_detail_height: row.detail_height,

    // Stored/display compatibility only. These fields are intentionally not part of the v2 indexed schema or query_by.
    title: titleFor(row),
    headline: row.headline,
  })
}

async function ensureCollection(env: EnvConfig) {
  const url = new URL(`/collections/${encodeURIComponent(env.collection)}`, normalizeHost(env.typesenseHost))
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-TYPESENSE-API-KEY": env.typesenseApiKey,
    },
  })

  if (response.ok) {
    console.log(`[typesense-index] collection exists: ${env.collection}`)
    return
  }

  if (response.status !== 404) {
    const body = await response.text()
    throw new Error(`Typesense collection lookup failed with HTTP ${response.status}: ${body.slice(0, 500)}`)
  }

  const createUrl = new URL("/collections", normalizeHost(env.typesenseHost))
  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-TYPESENSE-API-KEY": env.typesenseApiKey,
    },
    body: JSON.stringify(buildPublicAssetsCollectionSchema(env.collection)),
  })

  const body = await createResponse.text()
  if (!createResponse.ok) {
    throw new Error(`Typesense collection create failed with HTTP ${createResponse.status}: ${body.slice(0, 500)}`)
  }
  console.log(`[typesense-index] collection created: ${env.collection}`)
}

function buildPublicAssetsCollectionSchema(collectionName: string): TypesenseCollectionSchema {
  return {
    name: collectionName,
    fields: [
      { name: "id", type: "string" },
      { name: "asset_id", type: "string", facet: true },
      { name: "fotokey", type: "string", optional: true },
      { name: "event_title", type: "string", facet: true, optional: true },
      { name: "caption", type: "string", optional: true },
      { name: "who_is_in_picture", type: "string", optional: true },
      { name: "people", type: "string[]", facet: true, optional: true },
      { name: "keywords", type: "string[]", facet: true, optional: true },
      { name: "category_name", type: "string", facet: true, optional: true },
      { name: "event_keywords", type: "string[]", optional: true },
      { name: "event_id", type: "string", facet: true, optional: true },
      { name: "event_date_ts", type: "int64", optional: true, sort: true },
      { name: "event_location", type: "string", optional: true },
      { name: "city", type: "string", facet: true, optional: true },
      { name: "category_id", type: "string", facet: true, optional: true },
      { name: "contributor_id", type: "string", facet: true, optional: true },
      { name: "contributor_display_name", type: "string", optional: true },
      { name: "status", type: "string", facet: true },
      { name: "visibility", type: "string", facet: true },
      { name: "source", type: "string", facet: true },
      { name: "media_type", type: "string", facet: true },
      { name: "image_date_ts", type: "int64", facet: true, optional: true, sort: true },
      { name: "created_at_ts", type: "int64", sort: true },
      { name: "updated_at_ts", type: "int64", optional: true, sort: true },
      { name: "published_at_ts", type: "int64", optional: true, sort: true },
      { name: "rank_score", type: "float", optional: true, sort: true },
    ],
    default_sorting_field: "created_at_ts",
  }
}

async function importBatch(env: EnvConfig, documents: TypesenseDocument[]) {
  const url = new URL(
    `/collections/${encodeURIComponent(env.collection)}/documents/import`,
    normalizeHost(env.typesenseHost),
  )
  url.searchParams.set("action", "upsert")
  url.searchParams.set("dirty_values", "coerce_or_reject")

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "X-TYPESENSE-API-KEY": env.typesenseApiKey,
    },
    body: documents.map((document) => JSON.stringify(document)).join("\n"),
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`Typesense import failed with HTTP ${response.status}: ${body.slice(0, 500)}`)
  }

  const failures = parseImportFailures(body)
  if (failures.length > 0) {
    console.error(`[typesense-index] Typesense returned ${failures.length} row failure(s). First failures:`)
    for (const failure of failures.slice(0, 10)) {
      console.error(`- ${failure}`)
    }
    process.exitCode = 1
    throw new Error("Typesense import returned row failures.")
  }
}

function parseImportFailures(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as { success?: boolean; error?: string; document?: { id?: string } }
        if (parsed.success === false) {
          const id = parsed.document?.id ? `id=${parsed.document.id} ` : ""
          return [`${id}${parsed.error ?? "Unknown Typesense row failure"}`]
        }
      } catch {
        return [`Unparseable Typesense import response line: ${line.slice(0, 300)}`]
      }
      return []
    })
}

function previewUrl(
  cdn: PublicPreviewCdnConfig,
  assetId: string,
  storageKey: string | null,
  variant: "thumb" | "card" | "detail",
): string | null {
  if (!storageKey && variant === "detail") return null
  const cdnUrl = storageKey
    ? buildPublicPreviewCdnUrl({
        baseUrl: cdn.baseUrl ?? "",
        version: cdn.version,
        storageKey,
        variant,
      })
    : null
  return cdnUrl ?? buildPublicStablePreviewPath(assetId, variant)
}

function titleFor(row: AssetRow): string {
  const candidates = [
    row.headline,
    row.who_is_in_picture,
    row.event_title,
    snippet(row.caption, 120),
    row.fotokey,
    row.id,
  ]
  return candidates.find((value) => typeof value === "string" && value.trim().length > 0)!.trim()
}

function parsePeople(value: string | null): string[] {
  const normalized = value?.trim()
  if (!normalized) return []
  const parts = normalized
    .split(/[,;|\n\r]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return [normalized]
  if (parts.join(" ").length < Math.max(1, Math.floor(normalized.length / 2))) return [normalized]
  return unique(parts)
}

function normalizeStringList(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return unique(value.flatMap((item) => normalizeStringList(item)))
  if (typeof value === "object") return normalizeStringList(Object.values(value))

  const raw = String(value).trim()
  if (!raw) return []

  if ((raw.startsWith("[") && raw.endsWith("]")) || (raw.startsWith("{") && raw.endsWith("}"))) {
    try {
      return normalizeStringList(JSON.parse(raw))
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  return unique(
    raw
      .split(/[,;|\n\r]+/g)
      .map((part) => part.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean),
  )
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function toUnixSeconds(value: Date | string | null): number | null {
  if (!value) return null
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.floor(ms / 1000)
}

function snippet(value: string | null, max: number): string | null {
  const normalized = value?.trim()
  if (!normalized) return null
  return normalized.length <= max ? normalized : normalized.slice(0, max).trim()
}

function dropUndefined(input: Record<string, unknown>): TypesenseDocument {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as TypesenseDocument
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const options: CliOptions = { batchSize: 500, dryRun: false }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "--batch-size") {
      options.batchSize = parsePositiveInteger(args[++i], "--batch-size")
    } else if (arg === "--limit") {
      options.limit = parsePositiveInteger(args[++i], "--limit")
    } else if (arg === "--dry-run") {
      options.dryRun = true
    } else if (arg === "--resume-after-id") {
      options.resumeAfterId = parseUuid(args[++i], "--resume-after-id")
    } else if (arg === "--collection") {
      options.collection = parseRequiredValue(args[++i], "--collection")
    } else if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

function loadEnv(options: CliOptions): EnvConfig {
  return {
    databaseUrl: requiredEnv("DATABASE_URL"),
    typesenseHost: requiredEnv("TYPESENSE_HOST"),
    typesenseApiKey: requiredEnv("TYPESENSE_API_KEY"),
    collection: options.collection ?? requiredEnv("TYPESENSE_COLLECTION_ALIAS"),
    cdn: {
      baseUrl: optionalEnv("PUBLIC_PREVIEW_CDN_BASE_URL"),
      version: optionalEnv("PUBLIC_PREVIEW_CDN_VERSION"),
    },
  }
}

function parsePositiveInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} requires a positive integer`)
  return parsed
}

function parseUuid(value: string | undefined, flag: string): string {
  const parsed = parseRequiredValue(value, flag)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
    throw new Error(`${flag} requires a UUID`)
  }
  return parsed
}

function parseRequiredValue(value: string | undefined, flag: string): string {
  const normalized = value?.trim()
  if (!normalized) throw new Error(`${flag} requires a value`)
  return normalized
}

function normalizeHost(value: string): string {
  return value.trim().replace(/\/+$/, "")
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function optionalEnv(name: string): string | null {
  return process.env[name]?.trim() || null
}

function loadLocalEnv() {
  for (const file of [
    resolve(apiRoot, ".dev.vars"),
    resolve(apiRoot, ".env.local"),
    resolve(apiRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, ".env"),
  ]) {
    if (existsSync(file)) dotenv.config({ path: file, override: false })
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function printHelp() {
  console.log(`
Usage:
  pnpm --dir apps/api typesense:index-public-assets -- [options]

Options:
  --batch-size <number>       Batch size for DB reads and Typesense imports (default 500)
  --limit <number>            Optional maximum documents to process
  --dry-run                   Print candidate count and first 3 documents without indexing
  --resume-after-id <uuid>    Resume keyset pagination after an image_assets.id
  --collection <name>         Override TYPESENSE_COLLECTION_ALIAS
`)
}

main().catch((error: unknown) => {
  console.error(`[typesense-index] failed: ${errorMessage(error)}`)
  process.exitCode = 1
})
