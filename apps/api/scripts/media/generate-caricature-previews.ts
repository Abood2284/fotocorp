#!/usr/bin/env node
/**
 * Generate blurred caricature preview derivatives (BLURRED_CARD + BLURRED_DETAIL).
 *
 *   pnpm --dir apps/api media:generate-caricature-previews
 *   pnpm --dir apps/api media:generate-caricature-previews -- --asset-id=<uuid>
 *   pnpm --dir apps/api media:generate-caricature-previews -- --limit=25
 */
import dotenv from "dotenv"
import pg from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

import type { Env } from "../../src/appTypes.js"
import {
  listQueuedCaricaturePreviewAssetIds,
} from "../../src/lib/caricatures/caricature-preview-generation.js"
import { processCaricaturePreviewGeneration } from "../../src/lib/caricatures/caricature-preview-processor.js"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

interface CliOptions {
  assetId?: string
  limit: number
}

async function main() {
  const options = parseCli(process.argv.slice(2))
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("FAIL DATABASE_URL is required.")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const db = drizzle(pool)
  const env = process.env as Env

  try {
    const assetIds = options.assetId
      ? [options.assetId]
      : await listQueuedCaricaturePreviewAssetIds(db, options.limit)

    if (!assetIds.length) {
      console.log(JSON.stringify({ phase: "noop", message: "No queued caricature previews." }, null, 2))
      return
    }

    const results: Array<{ assetId: string; ok: boolean; error?: string; readyTypes?: string[] }> = []

    for (const assetId of assetIds) {
      try {
        const result = await processCaricaturePreviewGeneration(db, env, assetId)
        results.push({ assetId, ok: true, readyTypes: result.readyTypes })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Preview generation failed."
        results.push({ assetId, ok: false, error: message })
      }
    }

    console.log(
      JSON.stringify(
        {
          phase: "complete",
          total: results.length,
          succeeded: results.filter((row) => row.ok).length,
          failed: results.filter((row) => !row.ok).length,
          results,
        },
        null,
        2,
      ),
    )

    if (results.some((row) => !row.ok)) {
      process.exit(1)
    }
  } finally {
    await pool.end()
  }
}

function parseCli(args: string[]): CliOptions {
  let assetId: string | undefined
  let limit = 25

  for (const arg of args) {
    if (arg.startsWith("--asset-id=")) assetId = arg.slice("--asset-id=".length).trim()
    if (arg.startsWith("--limit=")) limit = Number.parseInt(arg.slice("--limit=".length), 10)
  }

  if (!Number.isFinite(limit) || limit <= 0) limit = 25
  return { assetId, limit }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
