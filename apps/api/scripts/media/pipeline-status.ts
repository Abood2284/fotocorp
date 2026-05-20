#!/usr/bin/env node
import { existsSync } from "node:fs"
import { dirname } from "node:path"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import { createDbFromUrl } from "../../src/db"
import { getMediaPipelineStatus } from "../../src/lib/media/pipeline-status"
import {
  CARD_LIGHT_PREVIEW_PROFILE,
  DETAIL_PREVIEW_PROFILE,
  THUMB_LIGHT_PREVIEW_PROFILE,
} from "../../src/lib/media/watermark"

interface CliOptions {
  detailWatermarkProfile: string
  recentLimit: number
  showFailed: boolean
  failedLimit: number
}

const VARIANT_ORDER = ["thumb", "card", "detail"] as const

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const apiRoot = resolve(__dirname, "../..")
const repoRoot = resolve(apiRoot, "../..")

loadLocalEnv()

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("Missing DATABASE_URL")

  const { db, close } = createDbFromUrl(databaseUrl)
  try {
    const policy = {
      thumbProfile: THUMB_LIGHT_PREVIEW_PROFILE,
      cardProfile: CARD_LIGHT_PREVIEW_PROFILE,
      detailProfile: options.detailWatermarkProfile,
    }
    const status = await getMediaPipelineStatus(db, policy, {
      failedSampleLimit: options.showFailed ? options.failedLimit : 0,
      recentActivityLimit: options.recentLimit,
    })

    console.log("Media pipeline status")
    console.log(
      `Profiles: thumb=${status.derivativeProfiles.thumbProfile} | card=${status.derivativeProfiles.cardProfile} | detail=${status.derivativeProfiles.detailProfile}`,
    )
    console.log(`Generated at: ${status.generatedAt}`)
    console.log(formatMigrationBar(status.migrationPercentComplete))

    console.log("\nInventory")
    console.table({
      totalImageAssets: status.totalImageAssets,
      assetsWithOriginalStorageKey: status.assetsWithOriginalStorageKey,
      assetsWithR2ExistsTrue: status.assetsWithR2ExistsTrue,
      assetsWithR2ExistsFalse: status.assetsWithR2ExistsFalse,
      assetsWithR2ExistsNull: status.assetsWithR2ExistsNull,
      assetsMissingOriginalOrR2Mapping: status.assetsMissingOriginalOrR2Mapping,
    })

    console.log("\nProtected-preview migration (verified originals in R2)")
    console.table({
      verifiedAssetsWithOriginal: status.verifiedAssetsWithOriginal,
      assetsWithAllCurrentProfilesReady: status.assetsWithAllCurrentProfilesReady,
      verifiedAssetsRemainingMigration: status.verifiedAssetsRemainingMigration,
      migrationPercentComplete: `${status.migrationPercentComplete}%`,
      assetsReadyForPublicListing: status.assetsReadyForPublicListing,
      assetsCurrentlyVisibleInPublicApi: status.assetsCurrentlyVisibleInPublicApi,
    })

    console.log("\nDerivative readiness (current policy)")
    console.table(
      VARIANT_ORDER.map((variant) => ({
        variant,
        ready: status.derivativeByVariant[variant]?.ready ?? 0,
        failed: status.derivativeByVariant[variant]?.failed ?? 0,
        missing: status.derivativeByVariant[variant]?.missing ?? 0,
      })),
    )

    console.log("\nMigration breakdown by variant")
    console.table(
      status.migrationByVariant.map((row) => ({
        variant: row.variant,
        readyCurrentProfile: row.readyCurrentProfile,
        readyStaleProfile: row.readyStaleProfile,
        failed: row.failed,
        missingOrNotReady: row.missingOrNotReady,
      })),
    )

    const recentPolicyOk = status.recentDerivativeUpdates.filter((row) => row.profileMatchesPolicy).length
    const recentPolicyMismatch = status.recentDerivativeUpdates.length - recentPolicyOk
    console.log(
      `\nLatest derivative updates (last ${status.recentDerivativeUpdates.length} by updated_at; policyOk=${recentPolicyOk}, mismatch=${recentPolicyMismatch})`,
    )
    if (status.recentDerivativeUpdates.length > 0) {
      console.table(
        status.recentDerivativeUpdates.map((row) => ({
          asset: row.fotokey ?? row.legacyImageCode ?? row.assetId.slice(0, 8),
          variant: row.variant,
          status: row.generationStatus,
          profile: row.watermarkProfile ?? "-",
          policyOk: row.profileMatchesPolicy ? "yes" : "no",
          watermarked: row.isWatermarked ? "yes" : "no",
          sizeKb: row.sizeBytes ? Math.round(row.sizeBytes / 1024) : "-",
          dimensions: row.width && row.height ? `${row.width}x${row.height}` : "-",
          updatedAt: formatTimestamp(row.updatedAt),
          generatedAt: formatTimestamp(row.generatedAt),
        })),
      )
    } else {
      console.log("No recent derivative updates found.")
    }

    if (options.showFailed && status.latestFailedDerivatives.length > 0) {
      console.log(`\nLatest failed derivative rows (sample ${status.latestFailedDerivatives.length})`)
      console.table(
        status.latestFailedDerivatives.map((row) => ({
          asset: row.legacyImageCode ?? row.assetId.slice(0, 8),
          variant: row.variant,
          status: row.generationStatus,
          profile: row.watermarkProfile ?? "-",
          updatedAt: formatTimestamp(row.updatedAt),
          storageKeyMasked: row.storageKeyMasked,
        })),
      )
    }

    console.log("\nSuggested next commands")
    console.log("- pnpm --dir apps/api media:pipeline-status -- --recent-limit 40")
    console.log("- pnpm --dir apps/api media:generate-derivatives -- --scope all-verified --variants thumb,card,detail --dry-run --limit 200")
    console.log("- pnpm --dir apps/api run typesense:index-public-assets  # after backfill completes")
  } finally {
    await close()
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    detailWatermarkProfile: DETAIL_PREVIEW_PROFILE,
    recentLimit: 25,
    showFailed: false,
    failedLimit: 20,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = () => {
      const value = args[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`)
      index += 1
      return value
    }

    if (arg === "--watermark-profile" || arg === "--detail-watermark-profile")
      options.detailWatermarkProfile = next().trim()
    else if (arg === "--recent-limit") options.recentLimit = parsePositiveInteger(next(), "recent-limit")
    else if (arg === "--show-failed") options.showFailed = true
    else if (arg === "--failed-limit") options.failedLimit = parsePositiveInteger(next(), "failed-limit")
    else if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!options.detailWatermarkProfile) throw new Error("--detail-watermark-profile / --watermark-profile cannot be empty")
  return options
}

function printHelp() {
  console.log(`
Usage:
  pnpm --dir apps/api media:pipeline-status
  pnpm --dir apps/api media:pipeline-status -- --recent-limit 40
  pnpm --dir apps/api media:pipeline-status -- --show-failed --failed-limit 30

Options:
  --recent-limit <n>     Recent derivative updates (default 25)
  --show-failed          Include latest failed derivative sample table
  --failed-limit <n>     Failed sample size when --show-failed (default 20)
  --detail-watermark-profile <profile>  Override detail profile for counts

Protected profiles: ${THUMB_LIGHT_PREVIEW_PROFILE}, ${CARD_LIGHT_PREVIEW_PROFILE}, ${DETAIL_PREVIEW_PROFILE}
`)
}

function parsePositiveInteger(value: string, name: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer.`)
  return parsed
}

function formatTimestamp(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().replace("T", " ").slice(0, 19)
}

function formatMigrationBar(percent: number) {
  const width = 30
  const clamped = Math.max(0, Math.min(100, percent))
  const filled = Math.round((clamped / 100) * width)
  const bar = `${"█".repeat(filled)}${"░".repeat(width - filled)}`
  return `Migration [${bar}] ${clamped.toFixed(2)}%`
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

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
