#!/usr/bin/env node
import { createHash, createHmac } from "node:crypto"
import dns from "node:dns"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import pg from "pg"
import type { Pool as PgPool } from "pg"

type AssetRow = {
  id: string
  original_storage_key: string
  original_exists_in_storage: boolean
  original_storage_checked_at: string | null
}

interface CliOptions {
  limit?: number
  batchSize: number
  concurrency: number
  force: boolean
  dryRun: boolean
  staleHours: number
  r2RetryAttempts: number
  r2RetryBaseMs: number
  r2TimeoutMs: number
}

interface R2Config {
  accountId: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  region: string
}

interface Summary {
  selected: number
  checked: number
  exists: number
  missing: number
  failed: number
}

const { Pool } = pg
try {
  dns.setDefaultResultOrder?.("ipv4first")
} catch {
  // Older Node versions may not support this. Safe to ignore.
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const apiRoot = resolve(__dirname, "../..")
const repoRoot = resolve(apiRoot, "../..")
const DB_BACKOFF_BASE_MS = 500
const DB_BACKOFF_MAX_MS = 15_000
const TRANSIENT_DB_ERROR_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "08000",
  "08001",
  "08003",
  "08006",
  "57P01",
  "57P02",
  "57P03",
  "53300",
])
const RETRYABLE_R2_STATUSES = new Set([408, 429, 500, 502, 503, 504])

loadLocalEnv()

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const databaseUrl = requiredEnv("DATABASE_URL")
  const r2Config = getR2Config()
  const pool = createScriptPool(databaseUrl)
  const startedAt = Date.now()

  const summary: Summary = {
    selected: 0,
    checked: 0,
    exists: 0,
    missing: 0,
    failed: 0,
  }

  try {
    const staleBefore = new Date(Date.now() - options.staleHours * 60 * 60 * 1000)
    const rows = await selectCandidates(pool, options, staleBefore)
    summary.selected = rows.length

    printStartup(options, rows.length)

    const chunks = chunk(rows, options.batchSize)
    for (const [chunkIndex, batch] of chunks.entries()) {
      const updates: Array<{ id: string; exists: boolean; checkedAt: Date }> = []

      await runWithConcurrency(batch, options.concurrency, async (row) => {
        try {
          const exists = await r2HeadObject(r2Config, row.original_storage_key, options)
          const checkedAt = new Date()
          updates.push({ id: row.id, exists, checkedAt })
          summary.checked += 1
          if (exists) summary.exists += 1
          else summary.missing += 1
        } catch (error) {
          summary.failed += 1
          console.error("[verify-r2-originals.head_failed]", {
            assetId: row.id,
            key: maskStorageKey(row.original_storage_key),
            ...r2ErrorInfo(error),
          })
        }
      })

      if (!options.dryRun && updates.length > 0) {
        await applyUpdates(pool, updates)
      }

      console.log(
        `Progress batch=${chunkIndex + 1}/${chunks.length} checked=${summary.checked} exists=${summary.exists} missing=${summary.missing} failed=${summary.failed}`,
      )
    }
  } finally {
    await pool.end()
    const durationMs = Date.now() - startedAt
    const checksPerMinute = durationMs > 0 ? Number(((summary.checked * 60000) / durationMs).toFixed(2)) : 0
    console.log(
      JSON.stringify(
        {
          summary: {
            ...summary,
            durationMs,
            checksPerMinute,
          },
        },
        null,
        2,
      ),
    )
  }
}

async function selectCandidates(pool: PgPool, options: CliOptions, staleBefore: Date): Promise<AssetRow[]> {
  const params: unknown[] = [options.force, staleBefore]
  let limitClause = ""

  if (options.limit !== undefined) {
    params.push(options.limit)
    limitClause = `limit $${params.length}`
  }

  const result = await withDbRetry("selectCandidates", () =>
    pool.query<AssetRow>(
      `
        select
          id,
          original_storage_key,
          original_exists_in_storage,
          original_storage_checked_at
        from image_assets
        where media_type = 'IMAGE'
          and original_storage_key is not null
          and btrim(original_storage_key) <> ''
          and (
            $1::boolean = true
            or original_storage_checked_at is null
            or original_storage_checked_at < $2::timestamptz
          )
        order by original_storage_checked_at asc nulls first, id asc
        ${limitClause}
      `,
      params,
    ),
  )

  return result.rows
}

async function applyUpdates(pool: PgPool, updates: Array<{ id: string; exists: boolean; checkedAt: Date }>) {
  const values: unknown[] = []
  const tuples: string[] = []

  for (const update of updates) {
    values.push(update.id, update.exists, update.checkedAt)
    const base = values.length - 3
    tuples.push(`($${base + 1}::uuid, $${base + 2}::boolean, $${base + 3}::timestamptz)`)
  }

  await withDbRetry("applyUpdates", () =>
    pool.query(
      `
        update image_assets a
        set
          original_exists_in_storage = u.exists,
          original_storage_checked_at = u.checked_at,
          updated_at = now()
        from (
          values ${tuples.join(",")}
        ) as u(id, exists, checked_at)
        where a.id = u.id
      `,
      values,
    ),
  )
}

function parseArgs(args: string[]): CliOptions {
  if (args[0] === "--") args = args.slice(1)

  const options: CliOptions = {
    batchSize: 500,
    concurrency: 20,
    force: false,
    dryRun: false,
    staleHours: 24,
    r2RetryAttempts: 3,
    r2RetryBaseMs: 250,
    r2TimeoutMs: 15_000,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = () => {
      const value = args[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`)
      index += 1
      return value
    }

    if (arg === "--limit") options.limit = parsePositiveInteger(next(), "limit")
    else if (arg === "--batch-size") options.batchSize = parsePositiveInteger(next(), "batch-size")
    else if (arg === "--concurrency") options.concurrency = parsePositiveInteger(next(), "concurrency")
    else if (arg === "--force") options.force = true
    else if (arg === "--dry-run") options.dryRun = true
    else if (arg === "--stale-hours") options.staleHours = parsePositiveInteger(next(), "stale-hours")
    else if (arg === "--r2-retry-attempts") options.r2RetryAttempts = parsePositiveInteger(next(), "r2-retry-attempts")
    else if (arg === "--r2-retry-base-ms") options.r2RetryBaseMs = parsePositiveInteger(next(), "r2-retry-base-ms")
    else if (arg === "--r2-timeout-ms") options.r2TimeoutMs = parsePositiveInteger(next(), "r2-timeout-ms")
    else if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (options.batchSize > 5000) throw new Error("--batch-size must be 5000 or lower.")
  if (options.concurrency > 100) throw new Error("--concurrency must be 100 or lower.")
  if (options.r2RetryAttempts > 20) throw new Error("--r2-retry-attempts must be 20 or lower.")
  if (options.r2TimeoutMs > 120_000) throw new Error("--r2-timeout-ms must be 120000 or lower.")

  return options
}

function printHelp() {
  console.log(`
Verify mapped originals against R2 and update image_assets.original_exists_in_storage.

Usage:
  pnpm --dir apps/api exec tsx scripts/media/verify-r2-originals.ts --limit 50000 --batch-size 500 --concurrency 20

Options:
  --limit <n>
  --batch-size <n>
  --concurrency <n>
  --force
  --dry-run
  --stale-hours <n>
  --r2-retry-attempts <n>  Default: 3
  --r2-retry-base-ms <n>   Default: 250
  --r2-timeout-ms <n>      Default: 15000
`)
}

function getR2Config(): R2Config {
  const accountId = optionalEnv(["CLOUDFLARE_R2_ACCOUNT_ID", "R2_ACCOUNT_ID"])
  const bucket = optionalEnv(["CLOUDFLARE_R2_ORIGINALS_BUCKET", "R2_ORIGINALS_BUCKET", "CLOUDFLARE_R2_BUCKET", "R2_BUCKET_NAME"])
  const accessKeyId = optionalEnv(["CLOUDFLARE_R2_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID"])
  const secretAccessKey = optionalEnv(["CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY"])
  const missing = [
    ["CLOUDFLARE_R2_ACCOUNT_ID or R2_ACCOUNT_ID", accountId],
    ["CLOUDFLARE_R2_ORIGINALS_BUCKET or R2_ORIGINALS_BUCKET", bucket],
    ["CLOUDFLARE_R2_ACCESS_KEY_ID or R2_ACCESS_KEY_ID", accessKeyId],
    ["CLOUDFLARE_R2_SECRET_ACCESS_KEY or R2_SECRET_ACCESS_KEY", secretAccessKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(`Missing required R2 environment variables: ${missing.join(", ")}`)
  }

  return {
    accountId,
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: optionalEnv(["CLOUDFLARE_R2_ENDPOINT", "R2_ENDPOINT"]) || `https://${accountId}.r2.cloudflarestorage.com`,
    region: optionalEnv(["CLOUDFLARE_R2_REGION", "R2_REGION"]) || "auto",
  }
}

async function r2HeadObject(config: R2Config, key: string, options: CliOptions) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/")
  const url = new URL(`/${config.bucket}/${encodedKey}`, config.endpoint)
  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = hashHex("")
  const host = url.host
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date"
  const canonicalRequest = ["HEAD", url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n")
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")
  const signingKey = getSignatureKey(config.secretAccessKey, dateStamp, config.region, "s3")
  const signature = hmacHex(signingKey, stringToSign)
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await withR2Retry(
    "r2HeadObject",
    { attempts: options.r2RetryAttempts, baseMs: options.r2RetryBaseMs },
    async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), options.r2TimeoutMs)
      try {
        const headResponse = await fetch(url, {
          method: "HEAD",
          headers: {
            Authorization: authorization,
            "x-amz-content-sha256": payloadHash,
            "x-amz-date": amzDate,
          },
          signal: controller.signal,
        })

        if (RETRYABLE_R2_STATUSES.has(headResponse.status)) {
          throw new R2StatusError(headResponse.status)
        }

        return headResponse
      } finally {
        clearTimeout(timeout)
      }
    },
  )

  if (response.status === 404) return false
  if (response.ok) return true
  throw new Error(`R2 HEAD failed for key with status ${response.status}`)
}

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function optionalEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return value
  }
  return ""
}

function envNumber(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parsePositiveInteger(value: string, name: string) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive number.`)
  return parsed
}

function createScriptPool(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: envNumber("MEDIA_VERIFY_R2_DB_POOL_MAX", 5),
    connectionTimeoutMillis: envNumber("MEDIA_VERIFY_R2_DB_CONNECTION_TIMEOUT_MS", 15_000),
    idleTimeoutMillis: envNumber("MEDIA_VERIFY_R2_DB_IDLE_TIMEOUT_MS", 30_000),
    maxLifetimeSeconds: envNumber("MEDIA_VERIFY_R2_DB_MAX_LIFETIME_SECONDS", 60),
    allowExitOnIdle: true,
  })

  pool.on("error", (error) => {
    const info = dbErrorInfo(error)
    console.warn("[db.pool.error]", {
      code: info.code,
      hostname: info.hostname,
      message: errorMessage(error),
    })
  })

  return pool
}

async function withDbRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const retries = envNumber("MEDIA_VERIFY_R2_DB_RETRIES", 6)
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isTransientDbError(error) || attempt === retries) {
        throw error
      }

      const delayMs = retryDelayMs(attempt, DB_BACKOFF_BASE_MS, DB_BACKOFF_MAX_MS)
      const info = dbErrorInfo(error)
      console.warn("[db.retry]", {
        label,
        attempt: attempt + 1,
        retries,
        delayMs,
        code: info.code,
        hostname: info.hostname,
        message: errorMessage(error),
      })
      await sleep(delayMs)
    }
  }

  throw lastError
}

function isTransientDbError(error: unknown) {
  const info = dbErrorInfo(error)
  const message = info.message.toLowerCase()
  return (
    (info.code !== undefined && TRANSIENT_DB_ERROR_CODES.has(info.code)) ||
    message.includes("getaddrinfo") ||
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("connection terminated") ||
    message.includes("timeout") ||
    message.includes("terminating connection") ||
    message.includes("connection reset") ||
    message.includes("ehostunreach") ||
    message.includes("enetunreach")
  )
}

async function withR2Retry<T>(
  label: string,
  options: { attempts: number; baseMs: number },
  fn: () => Promise<T>,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isTransientR2Error(error) || attempt === options.attempts - 1) {
        throw error
      }

      const delayMs = retryDelayMs(attempt, options.baseMs, 10_000)
      console.warn("[r2.retry]", {
        label,
        attempt: attempt + 1,
        attempts: options.attempts,
        delayMs,
        ...r2ErrorInfo(error),
      })
      await sleep(delayMs)
    }
  }

  throw lastError
}

class R2StatusError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`R2 HEAD retryable status ${status}`)
    this.name = "R2StatusError"
    this.status = status
  }
}

function isTransientR2Error(error: unknown) {
  if (error instanceof R2StatusError) return RETRYABLE_R2_STATUSES.has(error.status)
  const info = dbErrorInfo(error)
  const message = info.message.toLowerCase()
  return (
    info.code === "AbortError" ||
    info.code === "ENOTFOUND" ||
    info.code === "EAI_AGAIN" ||
    info.code === "ECONNRESET" ||
    info.code === "ECONNREFUSED" ||
    info.code === "ETIMEDOUT" ||
    info.code === "EPIPE" ||
    info.code === "ENETUNREACH" ||
    info.code === "EHOSTUNREACH" ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("aborted") ||
    message.includes("ehostunreach") ||
    message.includes("enetunreach")
  )
}

function retryDelayMs(attempt: number, baseMs: number, maxMs: number) {
  const exponential = Math.min(maxMs, baseMs * 2 ** attempt)
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exponential * 0.25)))
  return exponential + jitter
}

function dbErrorInfo(error: unknown) {
  const candidate = error as { code?: unknown; hostname?: unknown; message?: unknown; cause?: unknown; name?: unknown }
  const cause = candidate?.cause as { code?: unknown; hostname?: unknown; message?: unknown; name?: unknown } | undefined
  return {
    code:
      typeof candidate?.code === "string"
        ? candidate.code
        : typeof cause?.code === "string"
          ? cause.code
          : typeof candidate?.name === "string"
            ? candidate.name
            : typeof cause?.name === "string"
              ? cause.name
              : undefined,
    hostname:
      typeof candidate?.hostname === "string"
        ? candidate.hostname
        : typeof cause?.hostname === "string"
          ? cause.hostname
          : undefined,
    message: errorMessage(error),
  }
}

function r2ErrorInfo(error: unknown) {
  if (error instanceof R2StatusError) {
    return {
      status: error.status,
      code: error.name,
      error: error.message,
    }
  }
  const info = dbErrorInfo(error)
  return {
    code: info.code,
    error: info.message,
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function printStartup(options: CliOptions, selected: number) {
  console.log(
    JSON.stringify(
      {
        event: "verify-r2-originals.start",
        dryRun: options.dryRun,
        selected,
        limit: options.limit ?? "all",
        batchSize: options.batchSize,
        concurrency: options.concurrency,
        force: options.force,
        staleHours: options.staleHours,
        r2RetryAttempts: options.r2RetryAttempts,
        r2RetryBaseMs: options.r2RetryBaseMs,
        r2TimeoutMs: options.r2TimeoutMs,
      },
      null,
      2,
    ),
  )
}

function loadLocalEnv() {
  for (const envPath of [
    join(apiRoot, ".dev.vars"),
    join(apiRoot, ".env.local"),
    join(apiRoot, ".env"),
    join(repoRoot, ".env.local"),
    join(repoRoot, ".env"),
  ]) {
    if (!existsSync(envPath)) continue
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match) continue
      const [, key, rawValue] = match
      if (process.env[key] !== undefined) continue
      process.env[key] = rawValue.replace(/^["']|["']$/g, "")
    }
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const queue = [...items]
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) return
      await worker(item)
    }
  })
  await Promise.all(runners)
}

function maskStorageKey(value: string) {
  const parts = value.split("/")
  const leaf = parts.at(-1) ?? ""
  if (!leaf) return "***"
  if (leaf.length <= 8) return `***${leaf}`
  return `***${leaf.slice(-8)}`
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

function hashHex(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest()
}

function hmacHex(key: Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest("hex")
}

function getSignatureKey(secretKey: string, dateStamp: string, regionName: string, serviceName: string) {
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp)
  const dateRegionKey = hmac(dateKey, regionName)
  const dateRegionServiceKey = hmac(dateRegionKey, serviceName)
  return hmac(dateRegionServiceKey, "aws4_request")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
