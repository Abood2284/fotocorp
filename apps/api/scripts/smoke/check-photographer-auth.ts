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
    console.log("HTTP login smoke skipped: PHOTOGRAPHER_SMOKE_USERNAME and PHOTOGRAPHER_SMOKE_PASSWORD are not set.")
    return
  }
  if (!databaseUrl) {
    console.log("HTTP login smoke skipped: DATABASE_URL is missing.")
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

  const me = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/auth/me", {
      headers: { cookie: cookieHeader },
    }),
    env,
  )
  assertStatus(me, 200, "me")
  const meBody = await me.json() as { photographer?: { id?: string } }
  const photographerId = meBody.photographer?.id
  if (!photographerId) throw new Error("me did not return photographer.id")

  const images = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/images?limit=5", {
      headers: { cookie: cookieHeader },
    }),
    env,
  )
  assertStatus(images, 200, "images")
  const imagesBody = await images.json() as { items?: Array<{ photographerId?: string }> }
  const badImage = imagesBody.items?.find((item) => item.photographerId !== photographerId)
  if (badImage) throw new Error("photographer images route returned an item outside the current photographer scope")

  const logout = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/auth/logout", {
      method: "POST",
      headers: { cookie: cookieHeader },
    }),
    env,
  )
  assertStatus(logout, 200, "logout")

  const meAfterLogout = await honoApp.fetch(
    new Request("https://fotocorp.local/api/v1/contributor/auth/me", {
      headers: { cookie: cookieHeader },
    }),
    env,
  )
  if (meAfterLogout.status === 200) throw new Error("me succeeded after logout")

  console.log("PASS photographer auth HTTP smoke.")
}

async function runDbChecks(url: string) {
  const pool = new Pool({ connectionString: url })
  try {
    const result = await pool.query<{
      accounts: string
      active_accounts: string
      sessions: string
    }>(`
      select
        (select count(*)::text from contributor_accounts) as accounts,
        (select count(*)::text from contributor_accounts where status = 'ACTIVE') as active_accounts,
        (select count(*)::text from contributor_sessions) as sessions
    `)
    console.log("DB smoke:", result.rows[0])
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
