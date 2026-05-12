#!/usr/bin/env node
import { createHmac, createHash } from "node:crypto"
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs"
import { dirname, extname, join, resolve } from "node:path"
import { createInterface } from "node:readline"
import { fileURLToPath } from "node:url"
import pg from "pg"

type LegacyRow = Record<string, string>
type ImportKind = "categories" | "events" | "contributors" | "assets" | "all"
type BatchStatus = "RUNNING" | "COMPLETED" | "FAILED"
type AssetStatus = "DRAFT" | "REVIEW" | "APPROVED" | "ARCHIVED" | "REJECTED"
type AssetVisibility = "PRIVATE" | "PUBLIC"
type IssueType =
  | "MISSING_R2_OBJECT"
  | "DUPLICATE_IMAGECODE"
  | "MISSING_EVENT"
  | "MISSING_CATEGORY"
  | "MISSING_PHOTOGRAPHER"
  | "INVALID_DATE"
  | "UNKNOWN_STATUS"
  | "IMPORT_ERROR"

const { Pool } = pg
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const apiRoot = resolve(__dirname, "../..")
const repoRoot = resolve(apiRoot, "../..")

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG", ".WEBP"]
const LEGACY_IMAGE_SOURCE = "fotocorp_images"
const EXPECTED_EXPORT_FILES = [
  "CategoryMaster.csv",
  "eventtb.csv",
  "PhotographerMaster.csv",
  "fotocorp_images.csv",
]

interface CliOptions {
  limit?: number
  offset: number
  batchSize: number
  dryRun: boolean
  skipR2Check: boolean
  only: ImportKind
  r2Prefix: string
  defaultExt: string
  dataDir: string
}

interface Counters {
  totalRows: number
  insertedRows: number
  updatedRows: number
  r2MatchedRows: number
  r2MissingRows: number
  duplicateImagecodeRows: number
  failedRows: number
}

interface SourceFile {
  path: string
  format: "jsonl" | "csv"
}

interface R2Config {
  accountId: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  region: string
}

interface R2Match {
  exists: boolean
  key: string | null
  filename: string | null
  ext: string | null
  checkedAt: Date | null
}

interface RelationIds {
  categoryId: string | null
  eventId: string | null
  photographerProfileId: string | null
}

interface ImportIssue {
  batchId: string | null
  legacySource: string | null
  legacySrno: number | null
  legacyImagecode: string | null
  issueType: IssueType
  severity: "WARNING" | "ERROR"
  message: string
  rawPayload: LegacyRow
}

loadLocalEnv()

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const shouldCheckR2 = !options.skipR2Check && (options.only === "all" || options.only === "assets")
  const r2Config = shouldCheckR2 ? getR2Config({ required: !options.dryRun }) : null
  const counters = emptyCounters()
  let pool: import("pg").Pool | null = null
  let batchId: string | null = null
  let status: BatchStatus = "COMPLETED"

  try {
    printStartupDiagnostics(options)
    validateDataDir(options)

    pool = options.dryRun ? null : new Pool({ connectionString: requiredEnv("DATABASE_URL") })
    if (pool) batchId = await createBatch(pool, options)

    if (options.only === "all" || options.only === "categories") {
      await importCategories(pool, options, counters)
    }
    if (options.only === "all" || options.only === "events") {
      await importEvents(pool, options, counters)
    }
    if (options.only === "all" || options.only === "contributors") {
      await importPhotographers(pool, options, counters)
    }
    if (options.only === "all" || options.only === "assets") {
      await importAssets(pool, options, counters, batchId, r2Config)
    }
  } catch (error) {
    status = "FAILED"
    counters.failedRows += 1
    console.error(error)
  } finally {
    if (pool && batchId) await finishBatch(pool, batchId, counters, status)
    await pool?.end()
    printReport(counters, batchId, options, status)
  }

  if (status === "FAILED") process.exitCode = 1
}

async function importCategories(pool: import("pg").Pool | null, options: CliOptions, counters: Counters) {
  const source = resolveSourceFile(options.dataDir, "CategoryMaster")
  if (!source) {
    console.warn("CategoryMaster export not found; skipping categories.")
    return
  }

  const startedAt = Date.now()
  for await (const rows of readRowBatches(source, options)) {
    counters.totalRows += rows.length
    if (options.dryRun || !pool) {
      logProgress("categories", counters, startedAt)
      continue
    }

    try {
      const records = rows.map((row) => [
        toInteger(pick(row, ["categorycode", "catcode", "catid", "imagecatid", "id"])),
        pick(row, ["categoryname", "name", "catname", "title"]) || "Legacy category unknown",
        null,
        toInteger(pick(row, ["parentcategory", "parentcategorycode", "parentid", "parentcatid"])),
        nullable(pick(row, ["categoryincludefile", "includefile", "include"])),
        row,
      ])
      const result = await pool.query<{ inserted: boolean }>(
        `
          insert into asset_categories (
            legacy_category_code,
            name,
            slug,
            parent_legacy_category_code,
            include_file,
            legacy_payload
          )
          values ${valuePlaceholders(records, 6)}
          on conflict (legacy_category_code) do update
          set
            name = excluded.name,
            slug = excluded.slug,
            parent_legacy_category_code = excluded.parent_legacy_category_code,
            include_file = excluded.include_file,
            legacy_payload = excluded.legacy_payload,
            updated_at = now()
          returning (xmax = 0) as inserted
        `,
        records.flat(),
      )
      countBulkUpsert(counters, result.rows)
    } catch (error) {
      counters.failedRows += rows.length
      await logIssues(pool, rows.map((row) => buildIssue(null, "CategoryMaster", "IMPORT_ERROR", "ERROR", errorMessage(error), row)))
    }
    logProgress("categories", counters, startedAt)
  }
}

async function importEvents(pool: import("pg").Pool | null, options: CliOptions, counters: Counters) {
  const source = resolveSourceFile(options.dataDir, "eventtb")
  if (!source) {
    console.warn("eventtb export not found; skipping events.")
    return
  }

  const startedAt = Date.now()
  for await (const rows of readRowBatches(source, options)) {
    counters.totalRows += rows.length
    if (options.dryRun || !pool) {
      logProgress("events", counters, startedAt)
      continue
    }

    try {
      const records = rows.map((row) => [
        toBigInt(pick(row, ["eventid", "id"])),
        nullable(pick(row, ["eventname", "name", "eventhead", "title"])),
        toDate(pick(row, ["eventdate", "date", "edate"])),
        nullable(pick(row, ["eventcountry", "country"])),
        nullable(pick(row, ["eventstate", "state"])),
        nullable(pick(row, ["eventcity", "city"])),
        nullable(pick(row, ["eventloc", "location", "venue", "place"])),
        nullable(pick(row, ["eventkeyword", "keywords", "ekeyword", "eventkeywords"])),
        toBigInt(pick(row, ["photocount", "totalphotos"])),
        toBigInt(pick(row, ["photocountunpub", "photocountunpublished", "unpublishedphotos"])),
        nullable(pick(row, ["smallimage1"])),
        nullable(pick(row, ["smallimage2"])),
        row,
      ])
      const result = await pool.query<{ inserted: boolean }>(
        `
          insert into asset_events (
            legacy_event_id,
            name,
            event_date,
            country,
            state,
            city,
            location,
            keywords,
            photo_count,
            photo_count_unpublished,
            small_image_1,
            small_image_2,
            legacy_payload
          )
          values ${valuePlaceholders(records, 13)}
          on conflict (legacy_event_id) do update
          set
            name = excluded.name,
            event_date = excluded.event_date,
            country = excluded.country,
            state = excluded.state,
            city = excluded.city,
            location = excluded.location,
            keywords = excluded.keywords,
            photo_count = excluded.photo_count,
            photo_count_unpublished = excluded.photo_count_unpublished,
            small_image_1 = excluded.small_image_1,
            small_image_2 = excluded.small_image_2,
            legacy_payload = excluded.legacy_payload,
            updated_at = now()
          returning (xmax = 0) as inserted
        `,
        records.flat(),
      )
      countBulkUpsert(counters, result.rows)
    } catch (error) {
      counters.failedRows += rows.length
      await logIssues(pool, rows.map((row) => buildIssue(null, "eventtb", "IMPORT_ERROR", "ERROR", errorMessage(error), row)))
    }
    logProgress("events", counters, startedAt)
  }
}

async function importPhotographers(pool: import("pg").Pool | null, options: CliOptions, counters: Counters) {
  const source = resolveSourceFile(options.dataDir, "PhotographerMaster")
  if (!source) {
    console.warn("PhotographerMaster export not found; skipping contributors.")
    return
  }

  const startedAt = Date.now()
  for await (const rows of readRowBatches(source, options)) {
    counters.totalRows += rows.length
    if (options.dryRun || !pool) {
      logProgress("contributors", counters, startedAt)
      continue
    }

    try {
      const records = rows.map((row) => {
        const legacyId = toBigInt(pick(row, ["photographerid", "photographid", "id"]))
        return [
          null,
          legacyId,
          pick(row, ["photographer", "displayname", "photographername", "name"]) || `Legacy photographer ${legacyId ?? "unknown"}`,
          nullable(pick(row, ["email", "emailid"])),
          nullable(pick(row, ["mobileno", "mobile", "phone", "telephone", "contact"])),
          nullable(pick(row, ["city"])),
          nullable(pick(row, ["state"])),
          nullable(pick(row, ["country"])),
          "LEGACY_IMPORT",
          "LEGACY_ONLY",
          row,
        ]
      })
      const result = await pool.query<{ inserted: boolean }>(
        `
          insert into photographer_profiles (
            user_id,
            legacy_photographer_id,
            display_name,
            email,
            phone,
            city,
            state,
            country,
            profile_source,
            status,
            legacy_payload
          )
          values ${valuePlaceholders(records, 11)}
          on conflict (legacy_photographer_id) do update
          set
            display_name = excluded.display_name,
            email = excluded.email,
            phone = excluded.phone,
            city = excluded.city,
            state = excluded.state,
            country = excluded.country,
            profile_source = excluded.profile_source,
            status = excluded.status,
            legacy_payload = excluded.legacy_payload,
            updated_at = now()
          returning (xmax = 0) as inserted
        `,
        records.flat(),
      )
      countBulkUpsert(counters, result.rows)
    } catch (error) {
      counters.failedRows += rows.length
      await logIssues(pool, rows.map((row) => buildIssue(null, "PhotographerMaster", "IMPORT_ERROR", "ERROR", errorMessage(error), row)))
    }
    logProgress("contributors", counters, startedAt)
  }
}

async function importAssets(
  pool: import("pg").Pool | null,
  options: CliOptions,
  counters: Counters,
  batchId: string | null,
  r2Config: R2Config | null,
) {
  const source = resolveSourceFile(options.dataDir, "fotocorp_images")
  if (!source) {
    console.warn("fotocorp_images export not found; skipping assets.")
    return
  }

  const duplicateImagecodes = await collectDuplicateImagecodes(source, options)
  const relationCache = createRelationCache()
  const startedAt = Date.now()

  for await (const rows of readRowBatches(source, options)) {
    counters.totalRows += rows.length
    const records: unknown[][] = []
    const issues: ImportIssue[] = []

    for (const row of rows) {
      try {
        const legacySrno = toBigInt(pick(row, ["srno", "legacysrno"]))
        const legacyImagecode = pick(row, ["imagecode"])
        if (!legacySrno) throw new Error("Missing required legacy srno.")
        if (!legacyImagecode) throw new Error("Missing required legacy imagecode.")

        const r2 = options.skipR2Check
          ? inferR2Match(legacyImagecode, options.r2Prefix, options.defaultExt)
          : await findR2Object(r2Config, legacyImagecode, options.r2Prefix)
        if (r2.checkedAt) {
          if (r2.exists) counters.r2MatchedRows += 1
          else counters.r2MissingRows += 1
        }

        const duplicateImagecode = duplicateImagecodes.has(legacyImagecode.toLowerCase())
        if (duplicateImagecode) counters.duplicateImagecodeRows += 1

        const relationIds = pool
          ? await resolveRelations(pool, row, relationCache)
          : { categoryId: null, eventId: null, photographerProfileId: null }

        const legacyStatus = toInteger(pick(row, ["status", "imagestatus", "legacy_status"]))
        const mappedState = mapLegacyStatus(legacyStatus)

        records.push([
          LEGACY_IMAGE_SOURCE,
          legacySrno,
          toBigInt(pick(row, ["eventid", "event_id"])),
          legacyImagecode,
          r2.key,
          r2.filename,
          r2.ext,
          r2.exists,
          r2.checkedAt,
          nullable(pick(row, ["title"])),
          nullable(pick(row, ["caption"])),
          nullable(pick(row, ["eventhead", "headline"])),
          nullable(pick(row, ["imgkeyword", "keyword", "keywords"])),
          nullable(pick(row, ["ekeyword", "eventkeyword"])),
          nullable(pick(row, ["imagelocation", "eloc", "location"])),
          buildSearchText(row, legacyImagecode),
          toDate(pick(row, ["imagedate"])),
          toDate(pick(row, ["imageuploaddate", "uploadedat", "uploaddate", "createddate"])),
          legacyStatus,
          mappedState.status,
          mappedState.visibility,
          "IMAGE",
          "LEGACY_IMPORT",
          relationIds.categoryId,
          relationIds.photographerProfileId,
          relationIds.eventId,
          row,
        ])

        if (!r2.exists && !options.skipR2Check) {
          issues.push(buildIssue(batchId, LEGACY_IMAGE_SOURCE, "MISSING_R2_OBJECT", "WARNING", "R2 object was not found for legacy imagecode.", row))
        }
        if (duplicateImagecode) {
          issues.push(buildIssue(batchId, LEGACY_IMAGE_SOURCE, "DUPLICATE_IMAGECODE", "WARNING", "Legacy imagecode appears more than once in the processed export scope.", row))
        }
        if (!relationIds.categoryId && hasValue(pick(row, ["imagecatid", "categoryid", "category_id"]))) {
          issues.push(buildIssue(batchId, LEGACY_IMAGE_SOURCE, "MISSING_CATEGORY", "WARNING", "Referenced legacy category was not found.", row))
        }
        if (!relationIds.eventId && hasValue(pick(row, ["eventid", "event_id"]))) {
          issues.push(buildIssue(batchId, LEGACY_IMAGE_SOURCE, "MISSING_EVENT", "WARNING", "Referenced legacy event was not found.", row))
        }
        if (!relationIds.photographerProfileId && hasValue(pick(row, ["photographid", "photographerid"]))) {
          issues.push(buildIssue(batchId, LEGACY_IMAGE_SOURCE, "MISSING_PHOTOGRAPHER", "WARNING", "Referenced legacy photographer was not found.", row))
        }
        if (legacyStatus !== null && mappedState.unknown) {
          issues.push(buildIssue(batchId, LEGACY_IMAGE_SOURCE, "UNKNOWN_STATUS", "WARNING", "Legacy status does not have a confirmed mapping.", row))
        }
        if (isInvalidDateValue(row, ["imagedate", "imageuploaddate", "uploadedat", "uploaddate", "createddate"])) {
          issues.push(buildIssue(batchId, LEGACY_IMAGE_SOURCE, "INVALID_DATE", "WARNING", "At least one legacy date value could not be parsed.", row))
        }
      } catch (error) {
        counters.failedRows += 1
        issues.push(buildIssue(batchId, LEGACY_IMAGE_SOURCE, "IMPORT_ERROR", "ERROR", errorMessage(error), row))
      }
    }

    if (options.dryRun || !pool) {
      logProgress("assets", counters, startedAt)
      continue
    }

    try {
      if (records.length > 0) {
        const result = await pool.query<{ inserted: boolean }>(
          `
            insert into assets (
              legacy_source,
              legacy_srno,
              legacy_event_id,
              legacy_imagecode,
              r2_original_key,
              original_filename,
              original_ext,
              r2_exists,
              r2_checked_at,
              title,
              caption,
              headline,
              keywords,
              event_keywords,
              image_location,
              search_text,
              image_date,
              uploaded_at,
              legacy_status,
              status,
              visibility,
              media_type,
              source,
              category_id,
              photographer_profile_id,
              event_id,
              legacy_payload
            )
            values ${valuePlaceholders(records, 27)}
            on conflict (legacy_source, legacy_srno) do update
            set
              legacy_event_id = excluded.legacy_event_id,
              legacy_imagecode = excluded.legacy_imagecode,
              r2_original_key = excluded.r2_original_key,
              original_filename = excluded.original_filename,
              original_ext = excluded.original_ext,
              r2_exists = excluded.r2_exists,
              r2_checked_at = excluded.r2_checked_at,
              title = excluded.title,
              caption = excluded.caption,
              headline = excluded.headline,
              keywords = excluded.keywords,
              event_keywords = excluded.event_keywords,
              image_location = excluded.image_location,
              search_text = excluded.search_text,
              image_date = excluded.image_date,
              uploaded_at = excluded.uploaded_at,
              legacy_status = excluded.legacy_status,
              status = excluded.status,
              visibility = excluded.visibility,
              media_type = excluded.media_type,
              source = excluded.source,
              category_id = excluded.category_id,
              photographer_profile_id = excluded.photographer_profile_id,
              event_id = excluded.event_id,
              legacy_payload = excluded.legacy_payload,
              updated_at = now()
            returning (xmax = 0) as inserted
          `,
          records.flat(),
        )
        countBulkUpsert(counters, result.rows)
      }
      await logIssues(pool, issues)
    } catch (error) {
      counters.failedRows += rows.length
      await logIssues(pool, rows.map((row) => buildIssue(batchId, LEGACY_IMAGE_SOURCE, "IMPORT_ERROR", "ERROR", errorMessage(error), row)))
    }
    logProgress("assets", counters, startedAt)
  }
}

function parseArgs(args: string[]): CliOptions {
  if (args[0] === "--") args = args.slice(1)

  const options: CliOptions = {
    offset: 0,
    batchSize: 1000,
    dryRun: false,
    skipR2Check: false,
    only: "all",
    r2Prefix: "",
    defaultExt: "jpg",
    dataDir: join(repoRoot, "data/legacy"),
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--") continue
    if (arg === "--dry-run") options.dryRun = true
    else if (arg === "--skip-r2-check") options.skipR2Check = true
    else if (arg === "--limit") options.limit = parsePositiveInteger(args[++index], "--limit")
    else if (arg === "--offset") options.offset = parseNonNegativeInteger(args[++index], "--offset")
    else if (arg === "--batch-size") options.batchSize = parsePositiveInteger(args[++index], "--batch-size")
    else if (arg === "--only") options.only = parseOnly(args[++index])
    else if (arg === "--r2-prefix") options.r2Prefix = normalizePrefix(args[++index] ?? "")
    else if (arg === "--default-ext") options.defaultExt = parseDefaultExt(args[++index])
    else if (arg === "--data-dir") options.dataDir = resolveDataDir(args[++index])
    else if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

function resolveDataDir(value: string | undefined) {
  if (!value) throw new Error("--data-dir requires a path.")
  return resolve(repoRoot, value)
}

function resolveSourceFile(dataDir: string, baseName: string): SourceFile | null {
  const candidates = new Set([
    `${baseName}.jsonl`,
    `${baseName}.csv`,
    `${baseName.toLowerCase()}.jsonl`,
    `${baseName.toLowerCase()}.csv`,
  ])

  for (const fileName of candidates) {
    const path = join(dataDir, fileName)
    if (!existsSync(path)) continue
    return { path, format: fileName.toLowerCase().endsWith(".jsonl") ? "jsonl" : "csv" }
  }

  return null
}

async function* readRowBatches(source: SourceFile, options: CliOptions): AsyncGenerator<LegacyRow[]> {
  let batch: LegacyRow[] = []
  for await (const row of readRows(source, options)) {
    batch.push(row)
    if (batch.length >= options.batchSize) {
      yield batch
      batch = []
    }
  }
  if (batch.length > 0) yield batch
}

async function* readRows(source: SourceFile, options: Pick<CliOptions, "limit" | "offset">): AsyncGenerator<LegacyRow> {
  if (source.format === "jsonl") {
    yield* readJsonlRows(source.path, options)
    return
  }
  yield* readCsvRows(source.path, options)
}

async function* readJsonlRows(path: string, options: Pick<CliOptions, "limit" | "offset">): AsyncGenerator<LegacyRow> {
  let seen = 0
  let yielded = 0
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  for await (const line of lines) {
    if (!line.trim()) continue
    if (seen++ < options.offset) continue
    yield normalizeRow(JSON.parse(line) as Record<string, unknown>)
    yielded += 1
    if (options.limit && yielded >= options.limit) break
  }
}

async function* readCsvRows(path: string, options: Pick<CliOptions, "limit" | "offset">): AsyncGenerator<LegacyRow> {
  let seen = 0
  let yielded = 0
  let headers: string[] | null = null
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  for await (const line of lines) {
    const values = parseCsvLine(line)
    if (!headers) {
      headers = values.map(normalizeKey)
      continue
    }
    if (seen++ < options.offset) continue
    const row: LegacyRow = {}
    headers.forEach((header, index) => {
      row[header] = values[index] ?? ""
    })
    yield row
    yielded += 1
    if (options.limit && yielded >= options.limit) break
  }
}

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ""
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === "\"" && quoted && next === "\"") {
      current += "\""
      index += 1
    } else if (char === "\"") {
      quoted = !quoted
    } else if (char === "," && !quoted) {
      values.push(current)
      current = ""
    } else {
      current += char
    }
  }

  values.push(current)
  return values
}

async function collectDuplicateImagecodes(source: SourceFile, options: CliOptions) {
  const counts = new Map<string, number>()
  for await (const row of readRows(source, options)) {
    const imagecode = pick(row, ["imagecode"])
    if (!imagecode) continue
    const key = imagecode.toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([imagecode]) => imagecode))
}

async function findR2Object(config: R2Config | null, imagecode: string, prefix: string): Promise<R2Match> {
  if (!config) return inferR2Match(imagecode, prefix, "jpg")

  // R2 reconciliation is read-only: this importer only checks object existence with HEAD.
  const base = stripKnownExtension(imagecode)
  const checkedAt = new Date()
  for (const extension of IMAGE_EXTENSIONS) {
    const filename = `${base}${extension}`
    const key = prefix ? `${prefix}/${filename}` : filename
    if (await r2HeadObject(config, key)) {
      return { exists: true, key, filename, ext: extension.slice(1), checkedAt }
    }
  }
  return { exists: false, key: null, filename: null, ext: null, checkedAt }
}

async function r2HeadObject(config: R2Config, key: string) {
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

  const response = await fetch(url, {
    method: "HEAD",
    headers: {
      Authorization: authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  })

  if (response.status === 404) return false
  if (response.ok) return true
  throw new Error(`R2 HEAD failed for ${key}: ${response.status} ${response.statusText}`)
}

async function resolveRelations(pool: import("pg").Pool, row: LegacyRow, cache: ReturnType<typeof createRelationCache>): Promise<RelationIds> {
  const categoryCode = toInteger(pick(row, ["imagecatid", "categoryid"]))
  const eventId = toBigInt(pick(row, ["eventid"]))
  const photographerId = toBigInt(pick(row, ["photographid", "photographerid"]))

  return {
    categoryId: categoryCode === null ? null : await cachedLookup(cache.categories, String(categoryCode), () => lookupId(pool, "asset_categories", "legacy_category_code", categoryCode)),
    eventId: eventId === null ? null : await cachedLookup(cache.events, String(eventId), () => lookupId(pool, "asset_events", "legacy_event_id", eventId)),
    photographerProfileId: photographerId === null ? null : await cachedLookup(cache.contributors, String(photographerId), () => lookupId(pool, "photographer_profiles", "legacy_photographer_id", photographerId)),
  }
}

async function lookupId(pool: import("pg").Pool, table: string, column: string, value: number | string) {
  const result = await pool.query<{ id: string }>(`select id from ${table} where ${column} = $1 limit 1`, [value])
  return result.rows[0]?.id ?? null
}

async function cachedLookup(cache: Map<string, string | null>, key: string, lookup: () => Promise<string | null>) {
  if (cache.has(key)) return cache.get(key) ?? null
  const value = await lookup()
  cache.set(key, value)
  return value
}

function createRelationCache() {
  return {
    categories: new Map<string, string | null>(),
    events: new Map<string, string | null>(),
    contributors: new Map<string, string | null>(),
  }
}

async function createBatch(pool: import("pg").Pool, options: CliOptions) {
  const result = await pool.query<{ id: string }>(
    `
      insert into asset_import_batches (source_name, source_table, status, notes)
      values ('legacy_fotocorp', $1, 'RUNNING', $2)
      returning id
    `,
    [options.only === "all" ? "all legacy exports" : options.only, JSON.stringify(options)],
  )
  return result.rows[0].id
}

async function finishBatch(pool: import("pg").Pool, batchId: string, counters: Counters, status: BatchStatus) {
  await pool.query(
    `
      update asset_import_batches
      set
        finished_at = now(),
        total_rows = $2,
        inserted_rows = $3,
        updated_rows = $4,
        r2_matched_rows = $5,
        r2_missing_rows = $6,
        duplicate_imagecode_rows = $7,
        failed_rows = $8,
        status = $9
      where id = $1
    `,
    [
      batchId,
      counters.totalRows,
      counters.insertedRows,
      counters.updatedRows,
      counters.r2MatchedRows,
      counters.r2MissingRows,
      counters.duplicateImagecodeRows,
      counters.failedRows,
      status,
    ],
  )
}

async function logIssues(pool: import("pg").Pool, issues: ImportIssue[]) {
  if (issues.length === 0) return
  const records = issues.map((issue) => [
    issue.batchId,
    issue.legacySource,
    issue.legacySrno,
    issue.legacyImagecode,
    issue.issueType,
    issue.severity,
    issue.message,
    issue.rawPayload,
  ])
  await pool.query(
    `
      insert into asset_import_issues (
        batch_id,
        legacy_source,
        legacy_srno,
        legacy_imagecode,
        issue_type,
        severity,
        message,
        raw_payload
      )
      values ${valuePlaceholders(records, 8)}
    `,
    records.flat(),
  )
}

function buildIssue(
  batchId: string | null,
  legacySource: string | null,
  issueType: IssueType,
  severity: "WARNING" | "ERROR",
  message: string,
  row: LegacyRow,
): ImportIssue {
  return {
    batchId,
    legacySource,
    legacySrno: toBigInt(pick(row, ["srno", "legacysrno"])),
    legacyImagecode: nullable(pick(row, ["imagecode"])),
    issueType,
    severity,
    message,
    rawPayload: row,
  }
}

function valuePlaceholders(rows: unknown[][], width: number) {
  return rows.map((_, rowIndex) => {
    const offset = rowIndex * width
    return `(${Array.from({ length: width }, (_value, colIndex) => `$${offset + colIndex + 1}`).join(", ")})`
  }).join(", ")
}

function countBulkUpsert(counters: Counters, rows: { inserted: boolean }[]) {
  for (const row of rows) countUpsert(counters, row.inserted)
}

function logProgress(kind: ImportKind, counters: Counters, startedAt: number) {
  console.log(JSON.stringify({
    kind,
    processedRows: counters.totalRows,
    insertedRows: counters.insertedRows,
    updatedRows: counters.updatedRows,
    failedRows: counters.failedRows,
    elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
  }))
}

function mapLegacyStatus(value: number | null): { status: AssetStatus; visibility: AssetVisibility; unknown: boolean } {
  // Provisional legacy status mapping. This requires client confirmation before production import.
  switch (value) {
    case 1:
      return { status: "APPROVED", visibility: "PUBLIC", unknown: false }
    case 0:
      return { status: "DRAFT", visibility: "PRIVATE", unknown: false }
    case 2:
      return { status: "REVIEW", visibility: "PRIVATE", unknown: false }
    case 3:
      return { status: "REJECTED", visibility: "PRIVATE", unknown: false }
    case 4:
      return { status: "ARCHIVED", visibility: "PRIVATE", unknown: false }
    default:
      return { status: "DRAFT", visibility: "PRIVATE", unknown: value !== null }
  }
}

function buildSearchText(row: LegacyRow, imagecode: string) {
  return [
    pick(row, ["title"]),
    pick(row, ["caption"]),
    imagecode,
    pick(row, ["imgkeyword"]),
    pick(row, ["eventhead"]),
    pick(row, ["ekeyword"]),
    pick(row, ["tempcategory"]),
    pick(row, ["tempphotographer"]),
    pick(row, ["imagelocation"]),
  ]
    .filter(hasValue)
    .join(" ")
}

function normalizeRow(row: Record<string, unknown>): LegacyRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value == null ? "" : String(value)]),
  )
}

function pick(row: LegacyRow, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeKey(key)]
    if (hasValue(value)) return value.trim()
  }
  return ""
}

function normalizeKey(key: string) {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}

function nullable(value: string) {
  return hasValue(value) ? value.trim() : null
}

function toInteger(value: string) {
  if (!hasValue(value)) return null
  const parsed = Number.parseInt(value.trim(), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function toBigInt(value: string) {
  return toInteger(value)
}

function toDate(value: string) {
  if (!hasValue(value)) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isInvalidDateValue(row: LegacyRow, keys: string[]) {
  return keys.some((key) => {
    const value = pick(row, [key])
    return hasValue(value) && toDate(value) === null
  })
}

function hasValue(value: unknown): value is string {
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return trimmed.toLowerCase() !== "null"
}

function countUpsert(counters: Counters, inserted: boolean | undefined) {
  if (inserted) counters.insertedRows += 1
  else counters.updatedRows += 1
}

function inferR2Match(imagecode: string, prefix: string, defaultExt: string): R2Match {
  const extension = extname(imagecode)
  const hasKnownExtension = isKnownImageExtension(extension)
  const ext = hasKnownExtension
    ? extension.slice(1).toLowerCase()
    : defaultExt.replace(/^\./, "").toLowerCase()
  const filename = hasKnownExtension ? imagecode : `${stripKnownExtension(imagecode)}.${ext}`
  const key = prefix ? `${prefix}/${filename}` : filename

  return {
    exists: false,
    key,
    filename,
    ext,
    checkedAt: null,
  }
}

function stripKnownExtension(imagecode: string) {
  const extension = extname(imagecode)
  if (isKnownImageExtension(extension)) return imagecode.slice(0, -extension.length)
  return imagecode
}

function isKnownImageExtension(extension: string) {
  return IMAGE_EXTENSIONS.includes(extension)
}

function normalizePrefix(prefix: string) {
  return prefix.trim().replace(/^\/+|\/+$/g, "")
}

function getR2Config({ required }: { required: boolean }): R2Config | null {
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
    const message = `Missing required R2 environment variables: ${missing.join(", ")}`
    if (required) throw new Error(message)
    console.warn(`${message}. Skipping R2 checks for this dry run.`)
    return null
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

function printStartupDiagnostics(options: CliOptions) {
  console.log(JSON.stringify({
    apiRoot,
    repoRoot,
    dataDir: options.dataDir,
    only: options.only,
    offset: options.offset,
    limit: options.limit ?? null,
    batchSize: options.batchSize,
    defaultExt: options.defaultExt,
    dryRun: options.dryRun,
    skipR2Check: options.skipR2Check,
    databaseUrlPresent: process.env.DATABASE_URL ? "yes" : "no",
    r2ConfigPresent: hasCompleteR2Config() ? "yes" : "no",
  }, null, 2))
}

function validateDataDir(options: CliOptions) {
  const exists = existsSync(options.dataDir) && statSync(options.dataDir).isDirectory()
  if (exists) return

  const message = [
    `Legacy data directory not found: ${options.dataDir}`,
    `Expected files: ${EXPECTED_EXPORT_FILES.join(", ")}`,
  ].join("\n")

  if (options.dryRun) {
    console.warn(message)
    return
  }

  throw new Error(message)
}

function hasCompleteR2Config() {
  return Boolean(
    optionalEnv(["CLOUDFLARE_R2_ACCOUNT_ID", "R2_ACCOUNT_ID"]) &&
    optionalEnv(["CLOUDFLARE_R2_ORIGINALS_BUCKET", "R2_ORIGINALS_BUCKET", "CLOUDFLARE_R2_BUCKET", "R2_BUCKET_NAME"]) &&
    optionalEnv(["CLOUDFLARE_R2_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID"]) &&
    optionalEnv(["CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY"]),
  )
}

function emptyCounters(): Counters {
  return {
    totalRows: 0,
    insertedRows: 0,
    updatedRows: 0,
    r2MatchedRows: 0,
    r2MissingRows: 0,
    duplicateImagecodeRows: 0,
    failedRows: 0,
  }
}

function parsePositiveInteger(value: string | undefined, optionName: string) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${optionName} must be a positive number.`)
  return parsed
}

function parseNonNegativeInteger(value: string | undefined, optionName: string) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${optionName} must be zero or a positive number.`)
  return parsed
}

function parseOnly(value: string | undefined): ImportKind {
  if (value === "categories" || value === "events" || value === "contributors" || value === "assets" || value === "all") {
    return value
  }
  throw new Error("--only must be categories, events, contributors, assets, or all.")
}

function parseDefaultExt(value: string | undefined) {
  const normalized = (value ?? "").replace(/^\./, "").toLowerCase()
  if (normalized === "jpg" || normalized === "jpeg" || normalized === "png" || normalized === "webp") {
    return normalized
  }
  throw new Error("--default-ext must be jpg, jpeg, png, or webp.")
}

function printReport(counters: Counters, batchId: string | null, options: CliOptions, status: BatchStatus) {
  console.log(JSON.stringify({ batchId, status, options, counters }, null, 2))
}

function printHelp() {
  console.log(`
Usage:
  pnpm --dir apps/api legacy:import -- [options]

Options:
  --limit number
  --offset number
  --batch-size number
  --default-ext jpg|jpeg|png|webp
  --dry-run
  --skip-r2-check
  --only categories|events|contributors|assets|all
  --r2-prefix prefix
  --data-dir path
`)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
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
