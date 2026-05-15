#!/usr/bin/env node
import { existsSync } from "node:fs"
import { dirname } from "node:path"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import { createDbFromUrl } from "../../src/db"
import { getMediaPipelineStatus } from "../../src/lib/media/pipeline-status"
import {
  CARD_CLEAN_PROFILE,
  DETAIL_WATERMARKED_PROFILE,
  THUMB_CLEAN_PROFILE,
} from "../../src/lib/media/watermark"

interface CliOptions {
  detailWatermarkProfile: string
  failedLimit: number
}

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
      thumbProfile: THUMB_CLEAN_PROFILE,
      cardProfile: CARD_CLEAN_PROFILE,
      detailProfile: options.detailWatermarkProfile,
    }
    const status = await getMediaPipelineStatus(db, policy, options.failedLimit)

    console.log("Media pipeline status")
    console.log(
      `Derivative profiles: thumb=${status.derivativeProfiles.thumbProfile}, card=${status.derivativeProfiles.cardProfile}, detail=${status.derivativeProfiles.detailProfile}`,
    )
    console.log(`Detail watermark profile (legacy field): ${status.watermarkProfile}`)
    console.log(`Generated at: ${status.generatedAt}`)
    console.table({
      totalImageAssets: status.totalImageAssets,
      assetsWithOriginalStorageKey: status.assetsWithOriginalStorageKey,
      assetsWithR2ExistsTrue: status.assetsWithR2ExistsTrue,
      assetsWithR2ExistsFalse: status.assetsWithR2ExistsFalse,
      assetsWithR2ExistsNull: status.assetsWithR2ExistsNull,
      assetsMissingOriginalOrR2Mapping: status.assetsMissingOriginalOrR2Mapping,
      assetsReadyForPublicListing: status.assetsReadyForPublicListing,
      assetsCurrentlyVisibleInPublicApi: status.assetsCurrentlyVisibleInPublicApi,
    })

    const variantTable = Object.entries(status.derivativeByVariant).map(([variant, counts]) => ({
      variant,
      ready: counts.ready,
      failed: counts.failed,
      missing: counts.missing,
    }))
    console.table(variantTable)

    if (status.latestFailedDerivatives.length > 0) {
      console.log("Latest failed derivative rows")
      console.table(
        status.latestFailedDerivatives.map((row) => ({
          assetId: row.assetId,
          legacyImageCode: row.legacyImageCode,
          variant: row.variant,
          generationStatus: row.generationStatus,
          watermarkProfile: row.watermarkProfile,
          updatedAt: row.updatedAt,
          storageKeyMasked: row.storageKeyMasked,
          hasErrorData: row.hasErrorData,
        })),
      )
    } else {
      console.log("No failed derivative rows found.")
    }

    console.log("Suggested next commands")
    console.log("- pnpm --dir apps/api legacy:import -- --only assets --skip-r2-check --limit 10000 --batch-size 1000")
    console.log("- pnpm --dir apps/api media:verify-r2-originals -- --limit 10000 --batch-size 500 --concurrency 20")
    console.log("- pnpm --dir apps/api media:generate-derivatives -- --scope all-verified --dry-run --limit 200")
    console.log("- pnpm --dir apps/api media:generate-derivatives -- --scope all-verified --limit 200 --batch-size 50 --concurrency 4")
    console.log("- pnpm --dir apps/api media:pipeline-status")
  } finally {
    await close()
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    detailWatermarkProfile: DETAIL_WATERMARKED_PROFILE,
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
  pnpm --dir apps/api media:pipeline-status -- --detail-watermark-profile fotocorp-preview-v4-dense-dark-lowquality --failed-limit 30

Thumb/card READY counts assume clean profiles (${THUMB_CLEAN_PROFILE}, ${CARD_CLEAN_PROFILE}).
Detail READY counts assume watermarked detail profile (default: ${DETAIL_WATERMARKED_PROFILE}).
`)
}

function parsePositiveInteger(value: string, name: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer.`)
  return parsed
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
