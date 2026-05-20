#!/usr/bin/env node
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import {
  buildTypesensePublicAssetSearchUrl,
  buildTypesenseRequestHeaders,
  parseTypesensePublicAssetSearchQuery,
  parseTypesensePublicSearchConfig,
} from "../../src/lib/search/typesense-public-assets"
import type { Env } from "../../src/appTypes"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const apiRoot = resolve(__dirname, "../..")
const repoRoot = resolve(apiRoot, "../..")

loadLocalEnv()

async function main() {
  const env = process.env as Env
  const config = parseTypesensePublicSearchConfig(env)
  const query = parseTypesensePublicAssetSearchQuery(new URLSearchParams({ q: "*", limit: "10", page: "1" }))
  const url = buildTypesensePublicAssetSearchUrl(config, query)

  const startedAt = Date.now()
  const response = await fetch(url, {
    method: "GET",
    headers: buildTypesenseRequestHeaders(config),
  })
  const durationMs = Date.now() - startedAt
  const contentType = response.headers.get("content-type") ?? ""
  const body = await response.text()

  if (!response.ok) {
    throw new Error(`Typesense smoke failed with HTTP ${response.status}: ${body.slice(0, 300)}`)
  }
  if (!contentType.includes("application/json")) {
    throw new Error(`Typesense smoke expected JSON but received '${contentType || "unknown"}'`)
  }

  const payload = parseJsonObject(body)
  const found = Number(payload.found)
  const hits = Array.isArray(payload.hits) ? payload.hits : []

  if (!Number.isFinite(found)) {
    throw new Error("Typesense smoke response did not include numeric 'found'.")
  }
  if (hits.length < 1) {
    throw new Error("Typesense smoke expected at least one hit. Verify the public asset index has data.")
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        host: redactHost(config.host),
        collection: config.collection,
        found,
        hits: hits.length,
        durationMs,
        cloudflareAccessHeaders: config.cloudflareAccess ? "present" : "not_configured",
      },
      null,
      2,
    ),
  )
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Typesense smoke response was not a JSON object.")
  }
  return parsed as Record<string, unknown>
}

function redactHost(value: string): string {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}`
  } catch {
    return "configured"
  }
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

main().catch((error: unknown) => {
  console.error(`[typesense-smoke] failed: ${errorMessage(error)}`)
  process.exitCode = 1
})
