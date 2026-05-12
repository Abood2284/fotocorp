#!/usr/bin/env node
import { createWriteStream, mkdirSync } from "node:fs"
import { finished } from "node:stream/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import pg from "pg"
import {
  generatePhotographerPortalTemporaryPassword,
  hashPhotographerPortalPassword,
} from "../lib/contributor-password-hash"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

type Mode = "current-imported" | "all-active" | "all"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const apiRoot = resolve(__dirname, "../..")

interface PhotographerRow {
  id: string
  legacy_photographer_id: string | null
  display_name: string
  email: string | null
  status: string
}

interface CliOptions {
  mode: Mode
  includeDeleted: boolean
  resetPasswords: boolean
  dryRun: boolean
  outputPath?: string
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  let mode: Mode | undefined
  let includeDeleted = false
  let resetPasswords = false
  let dryRun = false
  let outputPath: string | undefined

  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i]!
    if (raw === "--help" || raw === "-h") {
      console.log(`
Usage:
  pnpm --dir apps/api contributors:generate-accounts -- --mode=current-imported
  pnpm --dir apps/api contributors:generate-accounts -- --mode=all-active
  pnpm --dir apps/api contributors:generate-accounts -- --mode=all

Options:
  --mode=current-imported|all-active|all   (required)
  --include-deleted                        Include contributors with status DELETED
  --reset-passwords                        Regenerate password for existing accounts
  --dry-run                                Plan only; no DB or CSV with secrets
  --output <path>                          Custom CSV path
`)
      process.exit(0)
    }
    if (raw.startsWith("--mode=")) {
      mode = parseMode(raw.slice("--mode=".length))
      continue
    }
    if (raw === "--mode") {
      mode = parseMode(requireValue(args[++i], "--mode"))
      continue
    }
    if (raw === "--include-deleted") {
      includeDeleted = true
      continue
    }
    if (raw === "--reset-passwords") {
      resetPasswords = true
      continue
    }
    if (raw === "--dry-run") {
      dryRun = true
      continue
    }
    if (raw === "--output") {
      outputPath = requireValue(args[++i], "--output")
      continue
    }
    throw new Error(`Unknown argument: ${raw}`)
  }

  if (!mode) throw new Error("--mode is required (current-imported | all-active | all).")

  return { mode, includeDeleted, resetPasswords, dryRun, outputPath }
}

function parseMode(value: string): Mode {
  if (value === "current-imported" || value === "all-active" || value === "all") return value
  throw new Error(`Invalid --mode: ${value}`)
}

function requireValue(value: string | undefined, flag: string) {
  if (!value) throw new Error(`${flag} requires a value.`)
  return value
}

function buildUsername(legacyPhotographerId: number): string {
  return `ph_${String(legacyPhotographerId).padStart(6, "0")}`
}

function csvEscape(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function defaultCsvPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const dir = join(apiRoot, "exports", "photographer-accounts")
  mkdirSync(dir, { recursive: true })
  return join(dir, `photographer-credentials-${stamp}.csv`)
}

function eligibilitySql(mode: Mode, includeDeleted: boolean): string {
  const deletedFilter = includeDeleted ? "" : "and p.status <> 'DELETED'"
  if (mode === "current-imported") {
    return `
      select p.id, p.legacy_photographer_id::text, p.display_name, p.email, p.status
      from contributors p
      inner join (
        select contributor_id
        from image_assets
        where contributor_id is not null
        group by contributor_id
      ) ia on ia.contributor_id = p.id
      where 1 = 1
      ${deletedFilter}
      order by p.legacy_photographer_id nulls last, p.id
    `
  }
  if (mode === "all-active") {
    return `
      select p.id, p.legacy_photographer_id::text, p.display_name, p.email, p.status
      from contributors p
      where p.status = 'ACTIVE'
      order by p.legacy_photographer_id nulls last, p.id
    `
  }
  return `
    select p.id, p.legacy_photographer_id::text, p.display_name, p.email, p.status
    from contributors p
    where 1 = 1
    ${deletedFilter}
    order by p.legacy_photographer_id nulls last, p.id
  `
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("DATABASE_URL is required (.dev.vars or env).")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  try {
    const assetCounts = new Map<string, number>()
    const countRes = await pool.query<{ contributor_id: string; c: string }>(`
      select contributor_id::text, count(*)::text as c
      from image_assets
      where contributor_id is not null
      group by contributor_id
    `)
    for (const row of countRes.rows) assetCounts.set(row.contributor_id, Number(row.c))

    const eligSql = eligibilitySql(opts.mode, opts.includeDeleted)
    const { rows: eligible } = await pool.query<PhotographerRow>(eligSql)

    const existingRes = await pool.query<{ contributor_id: string; id: string }>(`
      select id, contributor_id::text as contributor_id from contributor_accounts
    `)
    const existingByPhotographer = new Map<string, string>()
    for (const row of existingRes.rows) existingByPhotographer.set(row.contributor_id, row.id)

    let createdAccounts = 0
    let resetAccounts = 0
    let skippedExistingAccounts = 0
    let skippedMissingLegacyId = 0
    const csvPath = opts.dryRun ? null : opts.outputPath ?? defaultCsvPath()
    let stream: ReturnType<typeof createWriteStream> | null = null
    if (csvPath && !opts.dryRun) {
      mkdirSync(dirname(csvPath), { recursive: true })
      stream = createWriteStream(csvPath, { encoding: "utf8" })
      stream.write(
        [
          "legacy_photographer_id",
          "contributor_id",
          "display_name",
          "email",
          "status",
          "imported_asset_count",
          "username",
          "temporary_password",
          "must_change_password",
          "login_scope",
        ].join(",") + "\n",
      )
    }

    const LOGIN_SCOPE = "PHOTOGRAPHER_PORTAL_ONLY"

    for (const p of eligible) {
      const legacyRaw = p.legacy_photographer_id
      if (legacyRaw === null || legacyRaw === undefined || String(legacyRaw).trim() === "") {
        skippedMissingLegacyId += 1
        continue
      }
      const legacyNum = Number(legacyRaw)
      if (!Number.isFinite(legacyNum)) {
        skippedMissingLegacyId += 1
        continue
      }

      const username = buildUsername(legacyNum)
      const importedAssetCount = assetCounts.get(p.id) ?? 0
      const hasAccount = existingByPhotographer.has(p.id)

      if (hasAccount && !opts.resetPasswords) {
        skippedExistingAccounts += 1
        continue
      }

      const plain = opts.dryRun ? "" : generatePhotographerPortalTemporaryPassword()
      const hash = opts.dryRun ? "" : await hashPhotographerPortalPassword(plain)

      if (!opts.dryRun) {
        if (!hasAccount) {
          await pool.query(
            `
            insert into contributor_accounts (
              contributor_id, username, password_hash, status, must_change_password, updated_at
            ) values ($1::uuid, $2, $3, 'ACTIVE', true, now())
            `,
            [p.id, username, hash],
          )
          createdAccounts += 1
        } else {
          await pool.query(
            `
            update contributor_accounts
            set password_hash = $2, must_change_password = true, updated_at = now()
            where contributor_id = $1::uuid
            `,
            [p.id, hash],
          )
          resetAccounts += 1
        }
      } else {
        if (!hasAccount) createdAccounts += 1
        else resetAccounts += 1
      }

      if (stream && !opts.dryRun) {
        const line =
          [
            csvEscape(legacyNum),
            csvEscape(p.id),
            csvEscape(p.display_name),
            csvEscape(p.email),
            csvEscape(p.status),
            csvEscape(importedAssetCount),
            csvEscape(username),
            csvEscape(plain),
            csvEscape(true),
            csvEscape(LOGIN_SCOPE),
          ].join(",") + "\n"
        stream.write(line)
      }
    }

    if (stream) {
      stream.end()
      await finished(stream)
    }

    const summary = {
      mode: opts.mode,
      eligible_contributors: eligible.length,
      created_accounts: createdAccounts,
      reset_accounts: resetAccounts,
      skipped_existing_accounts: skippedExistingAccounts,
      skipped_missing_legacy_id: skippedMissingLegacyId,
      csv_path: csvPath,
      csv_rows: opts.dryRun ? 0 : createdAccounts + resetAccounts,
      dry_run: opts.dryRun,
    }
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exitCode = 1
})
