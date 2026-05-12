#!/usr/bin/env node
import dotenv from "dotenv"
import pg from "pg"
import type { Env } from "../../src/appTypes"
import { honoApp } from "../../src/honoApp"
import { CONTRIBUTOR_SESSION_COOKIE } from "../../src/routes/contributor/auth/service"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg
const databaseUrl = process.env.DATABASE_URL

async function main() {
  if (databaseUrl) await runDbChecks(databaseUrl)
  else console.log("DB smoke skipped: DATABASE_URL is missing.")

  const username = process.env.PHOTOGRAPHER_SMOKE_USERNAME
  const password = process.env.PHOTOGRAPHER_SMOKE_PASSWORD
  if (!username || !password) {
    console.log("HTTP photographer analytics smoke skipped: PHOTOGRAPHER_SMOKE_USERNAME and PHOTOGRAPHER_SMOKE_PASSWORD are not set.")
    return
  }
  if (!databaseUrl) {
    console.log("HTTP photographer analytics smoke skipped: DATABASE_URL is missing.")
    return
  }

  const env = { DATABASE_URL: databaseUrl } as Env

  const login = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
    env,
  )
  assertStatus(login, 200, "login")
  const setCookieValues = readSetCookieValues(login.headers)
  if (setCookieValues.length === 0) throw new Error("login did not return set-cookie")
  const sessionCookie =
    setCookieValues.find((value) => value.trimStart().startsWith(`${CONTRIBUTOR_SESSION_COOKIE}=`)) ?? setCookieValues[0]
  const cookieHeader = sessionCookie.split(";")[0]!.trim()

  const analytics = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/analytics/summary", {
      headers: { cookie: cookieHeader },
    }),
    env,
  )
  assertStatus(analytics, 200, "analytics/summary")
  const body = await analytics.json() as {
    ok?: boolean
    summary?: Record<string, unknown>
    topDownloadedImages?: unknown[]
    recentUploads?: unknown[]
  }
  if (body.ok !== true) throw new Error("analytics response missing ok: true")
  const summary = body.summary
  if (!summary) throw new Error("analytics response missing summary")

  for (const key of [
    "totalUploads",
    "uploadsThisWeek",
    "uploadsThisMonth",
    "submissionsThisWeek",
    "submissionsThisMonth",
    "submittedImages",
    "approvedImages",
    "downloadsToday",
    "downloadsThisMonth",
    "downloadsAllTime",
  ] as const) {
    if (typeof summary[key] !== "number") throw new Error(`summary.${key} must be a number`)
  }

  if (!Array.isArray(body.topDownloadedImages)) throw new Error("topDownloadedImages must be an array")
  if (!Array.isArray(body.recentUploads)) throw new Error("recentUploads must be an array")

  const logout = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/auth/logout", {
      method: "POST",
      headers: { cookie: cookieHeader },
    }),
    env,
  )
  assertStatus(logout, 200, "logout")

  console.log("PASS photographer analytics HTTP smoke.")
}

async function runDbChecks(url: string) {
  const pool = new Pool({ connectionString: url })
  try {
    const result = await pool.query<{
      completed_download_logs: string
      failed_download_logs: string
      started_download_logs: string
    }>(`
      select
        count(*) filter (where download_status = 'COMPLETED')::text as completed_download_logs,
        count(*) filter (where download_status = 'FAILED')::text as failed_download_logs,
        count(*) filter (where download_status = 'STARTED')::text as started_download_logs
      from image_download_logs
    `)
    console.log("DB smoke (image_download_logs by status):", result.rows[0])
  } finally {
    await pool.end()
  }
}

function assertStatus(response: Response, expected: number, label: string) {
  if (response.status !== expected) throw new Error(`${label} expected ${expected}, got ${response.status}`)
}

function readSetCookieValues(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof withGetSetCookie.getSetCookie === "function") return withGetSetCookie.getSetCookie()
  const single = headers.get("set-cookie")
  return single ? [single] : []
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
