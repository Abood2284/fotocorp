#!/usr/bin/env node
import { createHash, createHmac } from "node:crypto"
import dns from "node:dns"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import pg from "pg"
import type { Pool as PgPool } from "pg"
import sharp from "sharp"
import type {
  DownloadQualityCeiling,
  MetadataScanStatus,
  SourceQualityBucket,
} from "../../src/db/schema/image-assets-metadata.js"

interface CliOptions {
  dryRun: boolean
  limit?: number
  batchSize: number
  offset: number
  onlyMissing: boolean
  assetId?: string
  r2RetryAttempts: number
  r2RetryBaseMs: number
  r2TimeoutMs: number
}

interface R2Config {
  accountId: string
  originalsBucket: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  region: string
}

interface CandidateRow {
  id: string
  fotokey: string | null
  original_storage_key: string | null
  metadata_id: string | null
}

interface ComputedMetadataRow {
  imageAssetId: string
  originalWidth: number | null
  originalHeight: number | null
  displayWidth: number | null
  displayHeight: number | null
  originalLongEdge: number | null
  originalShortEdge: number | null
  originalMegapixels: string | null
  originalDpi: number | null
  originalResolutionUnit: string | null
  originalFormat: string | null
  originalSizeBytes: number | null
  originalColorSpace: string | null
  originalChannels: number | null
  originalBitDepth: number | null
  originalHasAlpha: boolean
  originalOrientation: number | null
  originalHasProfile: boolean
  originalHasExif: boolean
  originalHasIptc: boolean
  originalHasXmp: boolean
  sourceQualityBucket: SourceQualityBucket
  downloadQualityCeiling: DownloadQualityCeiling
  canGenerateMedium: boolean
  canGenerateLow: boolean
  technicalMetadataScannedAt: string
  metadataScanStatus: MetadataScanStatus
  metadataScanError: string | null
}

interface DistributionCounts {
  sourceQualityBucket: Record<SourceQualityBucket, number>
  downloadQualityCeiling: Record<DownloadQualityCeiling, number>
  canGenerateMedium: { true: number; false: number }
  canGenerateLow: { true: number; false: number }
  missingDpi: number
  missingResolutionUnit: number
  missingExif: number
}

interface FailedAssetSample {
  imageAssetId: string
  fotokey: string | null
  reason: string
  error?: string
}

interface Summary {
  assetsConsidered: number
  assetsScannedSuccessfully: number
  assetsSkipped: number
  missingOriginalStorageKey: number
  r2ObjectMissing: number
  sharpMetadataFailures: number
  dbRowsWouldInsert: number
  dbRowsWouldUpdate: number
  dbWritesPerformed: number
  distributions: DistributionCounts
  failedAssetSamples: FailedAssetSample[]
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
const ORIENTATION_SWAP_VALUES = new Set([5, 6, 7, 8])
const FAILED_ASSET_SAMPLE_LIMIT = 25

function createEmptyDistributionCounts(): DistributionCounts {
  return {
    sourceQualityBucket: {
      LOW_SOURCE: 0,
      STANDARD_SOURCE: 0,
      HIGH_SOURCE: 0,
      VERY_HIGH_SOURCE: 0,
      UNKNOWN: 0,
    },
    downloadQualityCeiling: {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      UNKNOWN: 0,
    },
    canGenerateMedium: { true: 0, false: 0 },
    canGenerateLow: { true: 0, false: 0 },
    missingDpi: 0,
    missingResolutionUnit: 0,
    missingExif: 0,
  }
}

loadLocalEnv()

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!options.dryRun) {
    throw new Error("This script currently supports --dry-run only. Database writes are not implemented yet.")
  }

  const databaseUrl = requiredEnv("DATABASE_URL")
  const r2Config = getR2Config()
  const pool = createScriptPool(databaseUrl)
  const summary: Summary = {
    assetsConsidered: 0,
    assetsScannedSuccessfully: 0,
    assetsSkipped: 0,
    missingOriginalStorageKey: 0,
    r2ObjectMissing: 0,
    sharpMetadataFailures: 0,
    dbRowsWouldInsert: 0,
    dbRowsWouldUpdate: 0,
    dbWritesPerformed: 0,
    distributions: createEmptyDistributionCounts(),
    failedAssetSamples: [],
  }

  const startedAt = Date.now()

  try {
    const candidates = await selectCandidates(pool, options)
    summary.assetsConsidered = candidates.length
    printStartup(options, candidates.length)

    const batches = chunk(candidates, options.batchSize)
    for (const [batchIndex, batch] of batches.entries()) {
      for (const row of batch) {
        await processCandidate(row, r2Config, options, summary)
      }

      console.log(
        `Progress batch=${batchIndex + 1}/${batches.length} scanned=${summary.assetsScannedSuccessfully} skipped=${summary.assetsSkipped} failures=${summary.sharpMetadataFailures + summary.r2ObjectMissing}`,
      )
    }
  } finally {
    await pool.end()
    const durationMs = Date.now() - startedAt
    console.log(
      JSON.stringify(
        {
          event: "scan-original-image-metadata.summary",
          dryRun: options.dryRun,
          durationMs,
          summary,
        },
        null,
        2,
      ),
    )
  }
}

async function processCandidate(
  row: CandidateRow,
  r2Config: R2Config,
  options: CliOptions,
  summary: Summary,
) {
  const storageKey = row.original_storage_key?.trim() ?? ""
  if (!storageKey) {
    summary.assetsSkipped += 1
    summary.missingOriginalStorageKey += 1
    recordFailedAssetSample(summary, {
      imageAssetId: row.id,
      fotokey: row.fotokey,
      reason: "missing_original_storage_key",
    })
    printAssetResult({
      imageAssetId: row.id,
      fotokey: row.fotokey,
      originalStorageKey: null,
      status: "SKIPPED",
      error: "missing_original_storage_key",
    })
    return
  }

  let buffer: Buffer
  try {
    buffer = await r2GetObject(r2Config, r2Config.originalsBucket, storageKey, options)
  } catch (error) {
    if (isR2NotFoundError(error)) {
      summary.assetsSkipped += 1
      summary.r2ObjectMissing += 1
      recordFailedAssetSample(summary, {
        imageAssetId: row.id,
        fotokey: row.fotokey,
        reason: "r2_object_missing",
      })
      printAssetResult({
        imageAssetId: row.id,
        fotokey: row.fotokey,
        originalStorageKey: storageKey,
        status: "SKIPPED",
        error: "r2_object_missing",
      })
      return
    }

    summary.assetsSkipped += 1
    summary.sharpMetadataFailures += 1
    recordFailedAssetSample(summary, {
      imageAssetId: row.id,
      fotokey: row.fotokey,
      reason: "r2_read_failed",
      error: conciseError(error),
    })
    printAssetResult({
      imageAssetId: row.id,
      fotokey: row.fotokey,
      originalStorageKey: storageKey,
      status: "FAILED",
      error: conciseError(error),
    })
    return
  }

  let computed: ComputedMetadataRow
  try {
    computed = await computeMetadataFromBuffer(row.id, buffer)
  } catch (error) {
    summary.assetsSkipped += 1
    summary.sharpMetadataFailures += 1
    recordFailedAssetSample(summary, {
      imageAssetId: row.id,
      fotokey: row.fotokey,
      reason: "sharp_metadata_failed",
      error: conciseError(error),
    })
    printAssetResult({
      imageAssetId: row.id,
      fotokey: row.fotokey,
      originalStorageKey: storageKey,
      status: "FAILED",
      error: conciseError(error),
    })
    return
  }

  summary.assetsScannedSuccessfully += 1
  recordDistributionCounts(summary.distributions, computed)
  if (row.metadata_id) summary.dbRowsWouldUpdate += 1
  else summary.dbRowsWouldInsert += 1

  printAssetResult({
    imageAssetId: row.id,
    fotokey: row.fotokey,
    originalStorageKey: storageKey,
    status: computed.metadataScanStatus,
    computed,
    writeAction: row.metadata_id ? "would-update" : "would-insert",
  })

  if (!options.dryRun) {
    throw new Error("Database writes are not implemented.")
  }
}

async function computeMetadataFromBuffer(imageAssetId: string, buffer: Buffer): Promise<ComputedMetadataRow> {
  const metadata = await sharp(buffer, { failOn: "none" }).metadata()
  const originalWidth = toPositiveInt(metadata.width)
  const originalHeight = toPositiveInt(metadata.height)
  const orientation = toPositiveInt(metadata.orientation)
  const { displayWidth, displayHeight } = resolveDisplayDimensions(originalWidth, originalHeight, orientation)
  const { longEdge, shortEdge } = resolveEdges(displayWidth, displayHeight)
  const sourceQualityBucket = computeSourceQualityBucket(longEdge)
  const downloadQualityCeiling = computeDownloadQualityCeiling(longEdge)

  return {
    imageAssetId,
    originalWidth,
    originalHeight,
    displayWidth,
    displayHeight,
    originalLongEdge: longEdge,
    originalShortEdge: shortEdge,
    originalMegapixels: computeMegapixels(displayWidth, displayHeight),
    originalDpi: toPositiveInt(metadata.density),
    originalResolutionUnit: mapResolutionUnit(metadata.resolutionUnit),
    originalFormat: metadata.format ?? null,
    originalSizeBytes: metadata.size ?? buffer.byteLength,
    originalColorSpace: metadata.space ?? null,
    originalChannels: toPositiveInt(metadata.channels),
    originalBitDepth: mapBitDepth(metadata.depth),
    originalHasAlpha: metadata.hasAlpha === true,
    originalOrientation: orientation,
    originalHasProfile: Boolean(metadata.icc) || metadata.hasProfile === true,
    originalHasExif: Boolean(metadata.exif),
    originalHasIptc: Boolean(metadata.iptc),
    originalHasXmp: Boolean(metadata.xmp),
    sourceQualityBucket,
    downloadQualityCeiling,
    canGenerateMedium: longEdge !== null && longEdge >= 1600,
    canGenerateLow: longEdge !== null && longEdge >= 900,
    technicalMetadataScannedAt: new Date().toISOString(),
    metadataScanStatus: "SUCCESS",
    metadataScanError: null,
  }
}

function resolveDisplayDimensions(
  width: number | null,
  height: number | null,
  orientation: number | null,
): { displayWidth: number | null; displayHeight: number | null } {
  if (width === null || height === null) {
    return { displayWidth: null, displayHeight: null }
  }

  if (orientation !== null && ORIENTATION_SWAP_VALUES.has(orientation)) {
    return { displayWidth: height, displayHeight: width }
  }

  return { displayWidth: width, displayHeight: height }
}

function resolveEdges(
  width: number | null,
  height: number | null,
): { longEdge: number | null; shortEdge: number | null } {
  if (width === null || height === null) return { longEdge: null, shortEdge: null }
  return {
    longEdge: Math.max(width, height),
    shortEdge: Math.min(width, height),
  }
}

function computeMegapixels(width: number | null, height: number | null): string | null {
  if (width === null || height === null) return null
  return (Math.round(((width * height) / 1_000_000) * 10_000) / 10_000).toFixed(4)
}

function computeSourceQualityBucket(longEdge: number | null): SourceQualityBucket {
  if (longEdge === null) return "UNKNOWN"
  if (longEdge < 1200) return "LOW_SOURCE"
  if (longEdge < 2500) return "STANDARD_SOURCE"
  if (longEdge < 4000) return "HIGH_SOURCE"
  return "VERY_HIGH_SOURCE"
}

function computeDownloadQualityCeiling(longEdge: number | null): DownloadQualityCeiling {
  if (longEdge === null) return "UNKNOWN"
  if (longEdge < 1600) return "LOW"
  if (longEdge < 2500) return "MEDIUM"
  return "HIGH"
}

function mapResolutionUnit(value: string | undefined): string | null {
  if (!value) return null
  if (value === "inch" || value === "cm") return value
  return null
}

function recordDistributionCounts(distributions: DistributionCounts, computed: ComputedMetadataRow) {
  distributions.sourceQualityBucket[computed.sourceQualityBucket] += 1
  distributions.downloadQualityCeiling[computed.downloadQualityCeiling] += 1
  distributions.canGenerateMedium[computed.canGenerateMedium ? "true" : "false"] += 1
  distributions.canGenerateLow[computed.canGenerateLow ? "true" : "false"] += 1
  if (computed.originalDpi === null) distributions.missingDpi += 1
  if (computed.originalResolutionUnit === null) distributions.missingResolutionUnit += 1
  if (!computed.originalHasExif) distributions.missingExif += 1
}

function recordFailedAssetSample(summary: Summary, sample: FailedAssetSample) {
  if (summary.failedAssetSamples.length >= FAILED_ASSET_SAMPLE_LIMIT) return
  summary.failedAssetSamples.push(sample)
}

function mapBitDepth(depth: string | undefined): number | null {
  if (!depth) return null
  const normalized = depth.toLowerCase()
  if (normalized.includes("uchar") || normalized === "char") return 8
  if (normalized.includes("ushort")) return 16
  if (normalized.includes("uint")) return 32
  if (normalized.includes("float")) return 32
  if (normalized.includes("double")) return 64
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function toPositiveInt(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : null
}

async function selectCandidates(pool: PgPool, options: CliOptions): Promise<CandidateRow[]> {
  const params: unknown[] = [options.onlyMissing]
  const filters = [
    "ia.media_type = 'IMAGE'",
    "($1::boolean = false or iam.id is null)",
  ]

  if (options.assetId) {
    params.push(options.assetId)
    filters.push(`ia.id = $${params.length}::uuid`)
  }

  let limitClause = ""
  if (options.limit !== undefined) {
    params.push(options.limit)
    limitClause = `limit $${params.length}`
  }

  params.push(options.offset)
  const offsetParam = `$${params.length}`

  const result = await withDbRetry("selectCandidates", () =>
    pool.query<CandidateRow>(
      `
        select
          ia.id,
          ia.fotokey,
          ia.original_storage_key,
          iam.id as metadata_id
        from image_assets ia
        left join image_assets_metadata iam on iam.image_asset_id = ia.id
        where ${filters.join("\n          and ")}
        order by ia.id asc
        offset ${offsetParam}
        ${limitClause}
      `,
      params,
    ),
  )

  return result.rows
}

function printStartup(options: CliOptions, selected: number) {
  console.log(
    JSON.stringify(
      {
        event: "scan-original-image-metadata.start",
        dryRun: options.dryRun,
        selected,
        limit: options.limit ?? "all",
        offset: options.offset,
        batchSize: options.batchSize,
        onlyMissing: options.onlyMissing,
        assetId: options.assetId ?? null,
        originalsBucket: maskBucketName(getR2Config().originalsBucket),
      },
      null,
      2,
    ),
  )
}

function printAssetResult(input: {
  imageAssetId: string
  fotokey: string | null
  originalStorageKey: string | null
  status: MetadataScanStatus | "SKIPPED"
  error?: string
  computed?: ComputedMetadataRow
  writeAction?: "would-insert" | "would-update"
}) {
  const payload: Record<string, unknown> = {
    event: "scan-original-image-metadata.asset",
    imageAssetId: input.imageAssetId,
    fotokey: input.fotokey,
    originalStorageKey: input.originalStorageKey ? maskStorageKey(input.originalStorageKey) : null,
    metadataScanStatus: input.status,
  }

  if (input.error) payload.metadataScanError = input.error
  if (input.writeAction) payload.writeAction = input.writeAction

  if (input.computed) {
    payload.originalWidth = input.computed.originalWidth
    payload.originalHeight = input.computed.originalHeight
    payload.displayWidth = input.computed.displayWidth
    payload.displayHeight = input.computed.displayHeight
    payload.originalDpi = input.computed.originalDpi
    payload.originalFormat = input.computed.originalFormat
    payload.originalSizeBytes = input.computed.originalSizeBytes
    payload.sourceQualityBucket = input.computed.sourceQualityBucket
    payload.downloadQualityCeiling = input.computed.downloadQualityCeiling
    payload.canGenerateMedium = input.computed.canGenerateMedium
    payload.canGenerateLow = input.computed.canGenerateLow
  }

  console.log(JSON.stringify(payload))
}

function parseArgs(args: string[]): CliOptions {
  if (args[0] === "--") args = args.slice(1)

  const options: CliOptions = {
    dryRun: false,
    batchSize: 25,
    offset: 0,
    onlyMissing: true,
    r2RetryAttempts: 3,
    r2RetryBaseMs: 250,
    r2TimeoutMs: 60_000,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = () => {
      const value = args[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`)
      index += 1
      return value
    }

    if (arg === "--dry-run") options.dryRun = true
    else if (arg === "--limit") options.limit = parsePositiveInteger(next(), "limit")
    else if (arg === "--batch-size") options.batchSize = parsePositiveInteger(next(), "batch-size")
    else if (arg === "--offset") options.offset = parseNonNegativeInteger(next(), "offset")
    else if (arg === "--only-missing") options.onlyMissing = true
    else if (arg === "--include-existing") options.onlyMissing = false
    else if (arg === "--asset-id") options.assetId = parseUuid(next(), "asset-id")
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

  if (!options.dryRun) {
    throw new Error("--dry-run is required for now.")
  }
  if (options.batchSize > 500) throw new Error("--batch-size must be 500 or lower.")
  if (options.r2RetryAttempts > 20) throw new Error("--r2-retry-attempts must be 20 or lower.")
  if (options.r2TimeoutMs > 300_000) throw new Error("--r2-timeout-ms must be 300000 or lower.")

  return options
}

function printHelp() {
  console.log(`
Scan original image technical metadata with Sharp (dry-run only; no DB writes).

Usage:
  pnpm --dir apps/api run media:scan-original-metadata -- --dry-run --limit 10

Options:
  --dry-run                 Required for now
  --limit <n>
  --batch-size <n>          Default: 25
  --offset <n>              Default: 0
  --only-missing            Default behavior: only assets without image_assets_metadata
  --include-existing        Scan assets even when metadata row exists
  --asset-id <uuid>
  --r2-retry-attempts <n>   Default: 3
  --r2-retry-base-ms <n>    Default: 250
  --r2-timeout-ms <n>       Default: 60000
`)
}

function getR2Config(): R2Config {
  const accountId = optionalEnv(["CLOUDFLARE_R2_ACCOUNT_ID", "R2_ACCOUNT_ID"])
  const originalsBucket = optionalEnv(["CLOUDFLARE_R2_ORIGINALS_BUCKET", "R2_ORIGINALS_BUCKET", "CLOUDFLARE_R2_BUCKET", "R2_BUCKET_NAME"])
  const accessKeyId = optionalEnv(["CLOUDFLARE_R2_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID"])
  const secretAccessKey = optionalEnv(["CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY"])
  const missing = [
    ["CLOUDFLARE_R2_ACCOUNT_ID or R2_ACCOUNT_ID", accountId],
    ["CLOUDFLARE_R2_ORIGINALS_BUCKET or R2_ORIGINALS_BUCKET", originalsBucket],
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
    originalsBucket,
    accessKeyId,
    secretAccessKey,
    endpoint: optionalEnv(["CLOUDFLARE_R2_ENDPOINT", "R2_ENDPOINT"]) || `https://${accountId}.r2.cloudflarestorage.com`,
    region: optionalEnv(["CLOUDFLARE_R2_REGION", "R2_REGION"]) || "auto",
  }
}

async function r2GetObject(config: R2Config, bucket: string, key: string, options: CliOptions): Promise<Buffer> {
  const response = await withR2Retry(
    "r2GetObject",
    { attempts: options.r2RetryAttempts, baseMs: options.r2RetryBaseMs },
    async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), options.r2TimeoutMs)
      try {
        const getResponse = await signedR2Request(config, bucket, "GET", key, undefined, controller.signal)
        if (getResponse.status === 404) {
          throw new R2NotFoundError(key)
        }
        if (RETRYABLE_R2_STATUSES.has(getResponse.status)) {
          throw new R2StatusError(getResponse.status)
        }
        if (!getResponse.ok) {
          throw new Error(`R2 GET failed with status ${getResponse.status}`)
        }
        return getResponse
      } finally {
        clearTimeout(timeout)
      }
    },
  )

  return Buffer.from(await response.arrayBuffer())
}

async function signedR2Request(
  config: R2Config,
  bucket: string,
  method: "GET",
  key: string,
  body?: Buffer,
  signal?: AbortSignal,
) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/")
  const url = new URL(`/${bucket}/${encodedKey}`, config.endpoint)
  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = hashHex(body ?? "")
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }
  const canonicalHeaderNames = Object.keys(headers).sort()
  const canonicalHeaders = canonicalHeaderNames.map((name) => `${name}:${headers[name]}`).join("\n") + "\n"
  const signedHeaders = canonicalHeaderNames.join(";")
  const canonicalRequest = [method, url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n")
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")
  const signingKey = getSignatureKey(config.secretAccessKey, dateStamp, config.region, "s3")
  const signature = hmacHex(signingKey, stringToSign)
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const requestHeaders = new Headers(headers)
  requestHeaders.delete("host")
  requestHeaders.set("Authorization", authorization)

  return fetch(url, {
    method,
    headers: requestHeaders,
    signal,
  })
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

function parseNonNegativeInteger(value: string, name: string) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative number.`)
  return parsed
}

function parseUuid(value: string, name: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`--${name} must be a UUID.`)
  }
  return value
}

function createScriptPool(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: envNumber("MEDIA_SCAN_METADATA_DB_POOL_MAX", 3),
    connectionTimeoutMillis: envNumber("MEDIA_SCAN_METADATA_DB_CONNECTION_TIMEOUT_MS", 15_000),
    idleTimeoutMillis: envNumber("MEDIA_SCAN_METADATA_DB_IDLE_TIMEOUT_MS", 30_000),
    maxLifetimeSeconds: envNumber("MEDIA_SCAN_METADATA_DB_MAX_LIFETIME_SECONDS", 60),
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
  const retries = envNumber("MEDIA_SCAN_METADATA_DB_RETRIES", 6)
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
      if (isR2NotFoundError(error) || !isTransientR2Error(error) || attempt === options.attempts - 1) {
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
    super(`R2 GET retryable status ${status}`)
    this.name = "R2StatusError"
    this.status = status
  }
}

class R2NotFoundError extends Error {
  readonly key: string

  constructor(key: string) {
    super(`R2 object not found for key ${maskStorageKey(key)}`)
    this.name = "R2NotFoundError"
    this.key = key
  }
}

function isR2NotFoundError(error: unknown) {
  return error instanceof R2NotFoundError
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
    message.includes("aborted")
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
    return { status: error.status, code: error.name, error: error.message }
  }
  const info = dbErrorInfo(error)
  return { code: info.code, error: info.message }
}

function conciseError(error: unknown) {
  const message = errorMessage(error)
  return message.length > 240 ? `${message.slice(0, 237)}...` : message
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function loadLocalEnv() {
  for (const envPath of [
    resolve(apiRoot, ".dev.vars"),
    resolve(apiRoot, ".env.local"),
    resolve(apiRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, ".env"),
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

function maskStorageKey(value: string) {
  const parts = value.split("/")
  const leaf = parts.at(-1) ?? ""
  if (!leaf) return "***"
  if (leaf.length <= 8) return `***${leaf}`
  return `***${leaf.slice(-8)}`
}

function maskBucketName(value: string) {
  if (value.length <= 8) return "***"
  return `${value.slice(0, 4)}***${value.slice(-4)}`
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
