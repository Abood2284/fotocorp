#!/usr/bin/env node
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, appendFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

type ImportKind = "assets" | "categories" | "events" | "contributors"
type RunStatus = "RUNNING" | "COMPLETED" | "FAILED" | "STOPPED"

interface CliOptions {
  runName: string
  resume: boolean
  only: ImportKind
  start: number
  end: number
  chunkSize: number
  batchSize: number
  defaultExt: string
  r2Prefix: string
  dataDir?: string
  skipR2Check: boolean
  maxChunks?: number
  sleepMs: number
  force: boolean
  dryRun: boolean
  noSyncCleanSchema: boolean
  syncEvenIfIssues: boolean
}

interface RunState {
  runName: string
  only: ImportKind
  start: number
  end: number
  chunkSize: number
  batchSize: number
  defaultExt: string
  r2Prefix: string
  dataDir?: string
  skipR2Check: boolean
  dryRun: boolean
  lastCompletedOffset: number | null
  nextOffset: number
  status: RunStatus
  startedAt: string
  updatedAt: string
  finishedAt: string | null
}

interface ChunkReport {
  offset: number
  limit: number
  status: RunStatus
  startedAt: string
  finishedAt: string
  durationMs: number
  exitCode: number | null
  batchId: string | null
  counters: Record<string, unknown> | null
  error: string | null
}

interface IssueReportRow {
  batch_id: string
  chunk_offset: number
  chunk_limit: number
  legacy_source: string | null
  legacy_srno: number | null
  legacy_imagecode: string | null
  issue_type: string
  severity: string
  message: string
  raw_payload: unknown
  created_at: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const apiRoot = resolve(__dirname, "../..")
const repoRoot = resolve(apiRoot, "../..")
const runsRoot = join(repoRoot, "data/legacy/import-runs")

let currentChild: ChildProcessWithoutNullStreams | null = null
let interrupted = false

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const runDir = join(runsRoot, options.runName)
  const statePath = join(runDir, "state.json")
  const chunksPath = join(runDir, "chunks.jsonl")
  const summaryPath = join(runDir, "summary.md")
  const lockPath = join(runDir, "run.lock")
  const issuesDir = join(runDir, "issues")

  mkdirSync(runDir, { recursive: true })
  mkdirSync(issuesDir, { recursive: true })
  assertLock(lockPath, options.force)
  writeLock(lockPath)

  if (!options.resume) {
    rmSync(chunksPath, { force: true })
    rmSync(summaryPath, { force: true })
    rmSync(issuesDir, { force: true, recursive: true })
    mkdirSync(issuesDir, { recursive: true })
  }
  rebuildAllIssues(issuesDir)

  let state = options.resume && existsSync(statePath)
    ? readState(statePath)
    : createState(options)

  if (options.resume && state.status === "COMPLETED") {
    console.log(`Run '${state.runName}' is already completed.`)
    removeLock(lockPath)
    return
  }

  state = { ...state, status: "RUNNING", updatedAt: now(), finishedAt: null }
  writeState(statePath, state)
  writeSummary(summaryPath, state, chunksPath, issuesDir)

  process.once("SIGINT", () => {
    interrupted = true
    currentChild?.kill("SIGINT")
  })

  let chunksRun = 0
  try {
    while (state.nextOffset < state.end) {
      if (options.maxChunks !== undefined && chunksRun >= options.maxChunks) {
        state = stopState(state)
        writeState(statePath, state)
        writeSummary(summaryPath, state, chunksPath, issuesDir)
        console.log(`Stopped after --max-chunks=${options.maxChunks}. Resume with: ${resumeCommand(state.runName)}`)
        break
      }

      const offset = state.nextOffset
      const limit = Math.min(state.chunkSize, state.end - offset)
      const report = await runChunk(state, offset, limit)
      appendFileSync(chunksPath, `${JSON.stringify(report)}\n`)
      if (report.batchId) {
        await writeIssueReports(report, issuesDir)
      }

      if (report.status !== "COMPLETED") {
        state = { ...state, status: report.status, updatedAt: now(), finishedAt: now() }
        writeState(statePath, state)
        writeSummary(summaryPath, state, chunksPath, issuesDir)
        removeLock(lockPath)
        if (options.syncEvenIfIssues && !options.noSyncCleanSchema && !options.dryRun) {
          console.log("Chunk failed; running clean schema sync anyway (--sync-even-if-issues).")
          const syncOut = await spawnCleanSync()
          if (syncOut.exitCode !== 0) console.error("Clean schema sync exited non-zero.")
        }
        console.error(`Chunk failed at offset ${offset}. Resume with: ${resumeCommand(state.runName)}`)
        process.exitCode = 1
        return
      }

      state = {
        ...state,
        lastCompletedOffset: offset,
        nextOffset: offset + limit,
        updatedAt: now(),
      }
      writeState(statePath, state)
      writeSummary(summaryPath, state, chunksPath, issuesDir)
      chunksRun += 1

      if (state.nextOffset < state.end && state.status === "RUNNING" && options.sleepMs > 0) {
        await sleep(options.sleepMs)
      }
    }

    if (state.nextOffset >= state.end && state.status === "RUNNING") {
      state = { ...state, status: "COMPLETED", updatedAt: now(), finishedAt: now() }
      writeState(statePath, state)
      writeSummary(summaryPath, state, chunksPath, issuesDir)
    }
  } finally {
    removeLock(lockPath)
  }

  if (state.status === "COMPLETED" && !options.noSyncCleanSchema && !options.dryRun) {
    console.log("Import run completed; running clean schema sync (pnpm legacy:sync-clean-schema).")
    const syncOut = await spawnCleanSync()
    if (syncOut.exitCode !== 0) {
      console.error("Clean schema sync failed after import; check logs above.")
      process.exitCode = 1
    }
  }

  if (state.status === "STOPPED") {
    console.log(`Run stopped. Resume with: ${resumeCommand(state.runName)}`)
    process.exitCode = 1
  }
}

async function runChunk(state: RunState, offset: number, limit: number): Promise<ChunkReport> {
  const startedAt = now()
  const startedMs = Date.now()
  const args = [
    "legacy:import",
    "--",
    "--only", state.only,
    "--offset", String(offset),
    "--limit", String(limit),
    "--batch-size", String(state.batchSize),
    "--default-ext", state.defaultExt,
  ]

  if (state.r2Prefix) args.push("--r2-prefix", state.r2Prefix)
  if (state.dataDir) args.push("--data-dir", state.dataDir)
  if (state.skipR2Check) args.push("--skip-r2-check")
  if (state.dryRun) args.push("--dry-run")

  const output = await spawnImporter(args)
  const finishedAt = now()
  const parsed = parseLastJsonObject(output.stdout)
  const parsedStatus = typeof parsed?.status === "string" ? parsed.status : null
  const success = output.exitCode === 0 && parsedStatus !== "FAILED" && !interrupted

  return {
    offset,
    limit,
    status: interrupted ? "STOPPED" : success ? "COMPLETED" : "FAILED",
    startedAt,
    finishedAt,
    durationMs: Date.now() - startedMs,
    exitCode: output.exitCode,
    batchId: typeof parsed?.batchId === "string" ? parsed.batchId : null,
    counters: isRecord(parsed?.counters) ? parsed.counters : null,
    error: success ? null : output.stderr.trim() || `Importer exited with code ${output.exitCode}`,
  }
}

function spawnCleanSync() {
  return new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolvePromise) => {
    const child = spawn("pnpm", ["legacy:sync-clean-schema", "--"], { cwd: apiRoot, env: process.env })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(text)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(text)
    })
    child.on("close", (exitCode) => {
      resolvePromise({ exitCode, stdout, stderr })
    })
  })
}

function spawnImporter(args: string[]) {
  return new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolvePromise) => {
    const child = spawn("pnpm", args, { cwd: apiRoot, env: process.env })
    currentChild = child
    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(text)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(text)
    })
    child.on("close", (exitCode) => {
      currentChild = null
      resolvePromise({ exitCode, stdout, stderr })
    })
  })
}

function parseArgs(args: string[]): CliOptions {
  if (args[0] === "--") args = args.slice(1)
  const options: Partial<CliOptions> = {
    resume: false,
    only: "assets",
    start: 0,
    chunkSize: 1000,
    batchSize: 100,
    defaultExt: "jpg",
    r2Prefix: "",
    skipR2Check: false,
    sleepMs: 0,
    force: false,
    dryRun: false,
    noSyncCleanSchema: false,
    syncEvenIfIssues: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--") continue
    if (arg === "--run-name") options.runName = requireValue(args[++index], arg)
    else if (arg === "--resume") options.resume = true
    else if (arg === "--only") options.only = parseOnly(requireValue(args[++index], arg))
    else if (arg === "--start") options.start = parseNonNegativeInteger(requireValue(args[++index], arg), arg)
    else if (arg === "--end") options.end = parsePositiveInteger(requireValue(args[++index], arg), arg)
    else if (arg === "--chunk-size") options.chunkSize = parsePositiveInteger(requireValue(args[++index], arg), arg)
    else if (arg === "--batch-size") options.batchSize = parsePositiveInteger(requireValue(args[++index], arg), arg)
    else if (arg === "--default-ext") options.defaultExt = parseDefaultExt(requireValue(args[++index], arg))
    else if (arg === "--r2-prefix") options.r2Prefix = requireValue(args[++index], arg)
    else if (arg === "--data-dir") options.dataDir = requireValue(args[++index], arg)
    else if (arg === "--skip-r2-check") options.skipR2Check = true
    else if (arg === "--max-chunks") options.maxChunks = parsePositiveInteger(requireValue(args[++index], arg), arg)
    else if (arg === "--sleep-ms") options.sleepMs = parseNonNegativeInteger(requireValue(args[++index], arg), arg)
    else if (arg === "--force") options.force = true
    else if (arg === "--dry-run") options.dryRun = true
    else if (arg === "--no-sync-clean-schema") options.noSyncCleanSchema = true
    else if (arg === "--sync-even-if-issues") options.syncEvenIfIssues = true
    else if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (!options.runName) {
    throw new Error("--run-name is required.")
  }
  if (!options.resume && options.end === undefined) {
    throw new Error("--end is required for new runs.")
  }

  return options as CliOptions
}

function createState(options: CliOptions): RunState {
  if (options.end <= options.start) throw new Error("--end must be greater than --start.")
  const timestamp = now()
  return {
    runName: options.runName,
    only: options.only,
    start: options.start,
    end: options.end,
    chunkSize: options.chunkSize,
    batchSize: options.batchSize,
    defaultExt: options.defaultExt,
    r2Prefix: options.r2Prefix,
    dataDir: options.dataDir,
    skipR2Check: options.skipR2Check,
    dryRun: options.dryRun,
    lastCompletedOffset: null,
    nextOffset: options.start,
    status: "RUNNING",
    startedAt: timestamp,
    updatedAt: timestamp,
    finishedAt: null,
  }
}

function readState(path: string): RunState {
  return JSON.parse(readFileSync(path, "utf8")) as RunState
}

function writeState(path: string, state: RunState) {
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`)
}

function writeSummary(path: string, state: RunState, chunksPath: string, issuesDir: string) {
  const chunks = readChunks(chunksPath)
  const completed = chunks.filter((chunk) => chunk.status === "COMPLETED")
  const failed = chunks.filter((chunk) => chunk.status === "FAILED")
  const counters = sumCounters(completed)
  const allIssuesPath = join(issuesDir, "all-issues.csv")
  const allIssues = readIssueJsonl(join(issuesDir, "all-issues.jsonl"))
  const lastIssues = allIssues.slice(-10)
  writeFileSync(path, [
    `# Legacy Import Run: ${state.runName}`,
    "",
    `- Status: ${state.status}`,
    `- Range: ${state.start}..${state.end}`,
    `- Next offset: ${state.nextOffset}`,
    `- Total chunks: ${chunks.length}`,
    `- Completed chunks: ${completed.length}`,
    `- Failed chunks: ${failed.length}`,
    `- Total rows: ${counters.totalRows ?? 0}`,
    `- Inserted rows: ${counters.insertedRows ?? 0}`,
    `- Updated rows: ${counters.updatedRows ?? 0}`,
    `- R2 matched rows: ${counters.r2MatchedRows ?? 0}`,
    `- R2 missing rows: ${counters.r2MissingRows ?? 0}`,
    `- Failed rows: ${counters.failedRows ?? 0}`,
    `- All issues CSV: ${allIssuesPath}`,
    `- Resume command: \`${resumeCommand(state.runName)}\``,
    "",
    "## Last 10 Issues",
    "",
    ...formatLastIssues(lastIssues),
    "",
  ].join("\n"))
}

function readChunks(path: string): ChunkReport[] {
  if (!existsSync(path)) return []
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ChunkReport)
}

function sumCounters(chunks: ChunkReport[]) {
  const totals: Record<string, number> = {}
  for (const chunk of chunks) {
    if (!chunk.counters) continue
    for (const [key, value] of Object.entries(chunk.counters)) {
      if (typeof value !== "number") continue
      totals[key] = (totals[key] ?? 0) + value
    }
  }
  return totals
}

async function writeIssueReports(report: ChunkReport, issuesDir: string) {
  if (!report.batchId) return

  const issues = await fetchBatchIssues(report.batchId, report.offset, report.limit)
  const chunkBase = `chunk-${report.offset}-${report.limit}`
  writeIssueJsonl(join(issuesDir, `${chunkBase}.jsonl`), issues)
  writeIssueCsv(join(issuesDir, `${chunkBase}.csv`), issues)
  rebuildAllIssues(issuesDir)
}

async function fetchBatchIssues(batchId: string, chunkOffset: number, chunkLimit: number): Promise<IssueReportRow[]> {
  ensureDatabaseEnv()
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const result = await pool.query<{
      batch_id: string
      legacy_source: string | null
      legacy_srno: number | string | null
      legacy_imagecode: string | null
      issue_type: string
      severity: string
      message: string
      raw_payload: unknown
      created_at: Date | string
    }>(
      `
        select
          batch_id,
          legacy_source,
          legacy_srno,
          legacy_imagecode,
          issue_type,
          severity,
          message,
          raw_payload,
          created_at
        from asset_import_issues
        where batch_id = $1
        order by created_at asc, id asc
      `,
      [batchId],
    )

    return result.rows.map((row) => ({
      batch_id: row.batch_id,
      chunk_offset: chunkOffset,
      chunk_limit: chunkLimit,
      legacy_source: row.legacy_source,
      legacy_srno: row.legacy_srno === null ? null : Number(row.legacy_srno),
      legacy_imagecode: row.legacy_imagecode,
      issue_type: row.issue_type,
      severity: row.severity,
      message: row.message,
      raw_payload: row.raw_payload,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }))
  } finally {
    await pool.end()
  }
}

function rebuildAllIssues(issuesDir: string) {
  const chunkIssues = readAllChunkIssues(issuesDir)
  const deduped = dedupeIssues(chunkIssues)
  writeIssueJsonl(join(issuesDir, "all-issues.jsonl"), deduped)
  writeIssueCsv(join(issuesDir, "all-issues.csv"), deduped)
}

function readAllChunkIssues(issuesDir: string) {
  return readdirSync(issuesDir)
    .filter((fileName) => /^chunk-\d+-\d+\.jsonl$/.test(fileName))
    .flatMap((fileName) => readIssueJsonl(join(issuesDir, fileName)))
}

function dedupeIssues(issues: IssueReportRow[]) {
  const seen = new Set<string>()
  const deduped: IssueReportRow[] = []
  for (const issue of issues) {
    const key = `${issue.batch_id}|${issue.legacy_srno ?? ""}|${issue.issue_type}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(issue)
  }
  return deduped
}

function writeIssueJsonl(path: string, issues: IssueReportRow[]) {
  writeFileSync(path, issues.map((issue) => JSON.stringify(issue)).join("\n") + (issues.length ? "\n" : ""))
}

function readIssueJsonl(path: string): IssueReportRow[] {
  if (!existsSync(path)) return []
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as IssueReportRow)
}

function writeIssueCsv(path: string, issues: IssueReportRow[]) {
  const columns = [
    "batch_id",
    "chunk_offset",
    "chunk_limit",
    "legacy_source",
    "legacy_srno",
    "legacy_imagecode",
    "issue_type",
    "severity",
    "message",
    "raw_payload",
    "created_at",
  ] as const

  const lines = [
    columns.join(","),
    ...issues.map((issue) => columns.map((column) => csvCell(column === "raw_payload" ? JSON.stringify(issue[column]) : issue[column])).join(",")),
  ]
  writeFileSync(path, `${lines.join("\n")}\n`)
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return ""
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text
}

function formatLastIssues(issues: IssueReportRow[]) {
  if (issues.length === 0) return ["No issues recorded."]
  return [
    "| created_at | issue_type | severity | legacy_srno | legacy_imagecode | message |",
    "| --- | --- | --- | --- | --- | --- |",
    ...issues.map((issue) => `| ${escapeMd(issue.created_at)} | ${escapeMd(issue.issue_type)} | ${escapeMd(issue.severity)} | ${escapeMd(issue.legacy_srno ?? "")} | ${escapeMd(issue.legacy_imagecode ?? "")} | ${escapeMd(issue.message)} |`),
  ]
}

function escapeMd(value: unknown) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ")
}

function ensureDatabaseEnv() {
  if (process.env.DATABASE_URL) return
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
    if (process.env.DATABASE_URL) return
  }
}

function assertLock(lockPath: string, force: boolean) {
  if (!existsSync(lockPath)) return
  if (force) {
    rmSync(lockPath, { force: true })
    return
  }
  throw new Error(`Run lock exists: ${lockPath}. Use --force only if the previous process is gone.`)
}

function writeLock(lockPath: string) {
  writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, startedAt: now() }, null, 2)}\n`)
}

function removeLock(lockPath: string) {
  rmSync(lockPath, { force: true })
}

function stopState(state: RunState): RunState {
  return { ...state, status: "STOPPED", updatedAt: now(), finishedAt: now() }
}

function parseLastJsonObject(stdout: string): Record<string, unknown> | null {
  for (let end = stdout.length - 1; end >= 0; end -= 1) {
    if (stdout[end] !== "}") continue
    for (let start = stdout.lastIndexOf("{", end); start >= 0; start = stdout.lastIndexOf("{", start - 1)) {
      try {
        const parsed = JSON.parse(stdout.slice(start, end + 1))
        if (isRecord(parsed)) return parsed
      } catch {
        continue
      }
    }
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseOnly(value: string): ImportKind {
  if (value === "assets" || value === "categories" || value === "events" || value === "contributors") return value
  throw new Error("--only must be assets, categories, events, or contributors.")
}

function parseDefaultExt(value: string) {
  const normalized = value.replace(/^\./, "").toLowerCase()
  if (normalized === "jpg" || normalized === "jpeg" || normalized === "png" || normalized === "webp") return normalized
  throw new Error("--default-ext must be jpg, jpeg, png, or webp.")
}

function parsePositiveInteger(value: string, optionName: string) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${optionName} must be a positive number.`)
  return parsed
}

function parseNonNegativeInteger(value: string, optionName: string) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${optionName} must be zero or a positive number.`)
  return parsed
}

function requireValue(value: string | undefined, optionName: string) {
  if (!value) throw new Error(`${optionName} requires a value.`)
  return value
}

function resumeCommand(runName: string) {
  return `pnpm legacy:import:chunks -- --resume --run-name ${runName}`
}

function sleep(ms: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

function now() {
  return new Date().toISOString()
}

function printHelp() {
  console.log(`
Usage:
  pnpm legacy:import:chunks -- --run-name name --end 10000 [options]
  pnpm legacy:import:chunks -- --resume --run-name name

Options:
  --run-name string
  --resume
  --only assets|categories|events|contributors
  --start number
  --end number
  --chunk-size number
  --batch-size number
  --default-ext jpg|jpeg|png|webp
  --r2-prefix string
  --data-dir path
  --skip-r2-check
  --max-chunks number
  --sleep-ms number
  --force
  --dry-run
  --no-sync-clean-schema   Skip automatic pnpm legacy:sync-clean-schema after a successful run
  --sync-even-if-issues    If a chunk fails, run clean sync before exiting (partial old data may sync)
`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
