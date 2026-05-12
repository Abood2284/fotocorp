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
    console.log("HTTP photographer events smoke skipped: PHOTOGRAPHER_SMOKE_USERNAME and PHOTOGRAPHER_SMOKE_PASSWORD are not set.")
    return
  }
  if (!databaseUrl) {
    console.log("HTTP photographer events smoke skipped: DATABASE_URL is missing.")
    return
  }

  const env = { DATABASE_URL: databaseUrl } as Env
  const cookieHeader = await loginAndCookie(env, username, password)

  const smokeName = `Smoke Test Event ${new Date().toISOString()}`
  const createRes = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/events", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ name: smokeName, location: "Smoke QA" }),
    }),
    env,
  )
  assertStatus(createRes, 201, "create event")
  const created = await createRes.json() as { event?: { id?: string; name?: string } }
  const eventId = created.event?.id
  if (!eventId) throw new Error("create did not return event.id")

  const mineList = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/events?scope=mine&limit=50", {
      headers: { cookie: cookieHeader },
    }),
    env,
  )
  assertStatus(mineList, 200, "list mine")
  const mineBody = await mineList.json() as { events?: Array<{ id: string }> }
  if (!mineBody.events?.some((e) => e.id === eventId)) throw new Error("new event not in mine list")

  const getBefore = await honoApp.fetch(
    new Request(`https://fotocorp.local/api/v1/contributor/events/${eventId}`, { headers: { cookie: cookieHeader } }),
    env,
  )
  assertStatus(getBefore, 200, "get event")
  const getBody = await getBefore.json() as { event?: { location?: string | null } }
  if (getBody.event?.location !== "Smoke QA") throw new Error("detail location mismatch")

  const patchRes = await honoApp.fetch(
    new Request(`https://fotocorp.local/api/v1/contributor/events/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ name: `${smokeName} (patched)`, location: "Smoke QA Patched" }),
    }),
    env,
  )
  assertStatus(patchRes, 200, "patch event")
  const patched = await patchRes.json() as { event?: { name?: string; location?: string | null } }
  if (!patched.event?.name?.includes("(patched)")) throw new Error("patch did not update name")
  if (patched.event?.location !== "Smoke QA Patched") throw new Error("patch did not update location")

  const availList = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/events?scope=available&limit=200", {
      headers: { cookie: cookieHeader },
    }),
    env,
  )
  assertStatus(availList, 200, "list available")
  const availBody = await availList.json() as { events?: Array<{ id: string }> }
  if (!availBody.events?.some((e) => e.id === eventId)) throw new Error("patched event not in available list")

  await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/auth/logout", {
      method: "POST",
      headers: { cookie: cookieHeader },
    }),
    env,
  )

  console.log("PASS photographer events HTTP smoke.")
}

async function loginAndCookie(env: Env, username: string, password: string) {
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
  const sessionCookie =
    setCookieValues.find((value) => value.trimStart().startsWith(`${CONTRIBUTOR_SESSION_COOKIE}=`)) ?? setCookieValues[0]
  return sessionCookie.split(";")[0]!.trim()
}

async function runDbChecks(url: string) {
  const pool = new Pool({ connectionString: url })
  try {
    const result = await pool.query<{
      total_events: string
      photographer_created: string
      legacy_import_rows: string
    }>(`
      select
        count(*)::text as total_events,
        count(*) filter (where created_by_source = 'PHOTOGRAPHER')::text as photographer_created,
        count(*) filter (where created_by_source = 'LEGACY_IMPORT')::text as legacy_import_rows
      from photo_events
    `)
    console.log("DB smoke (photo_events):", result.rows[0])
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
