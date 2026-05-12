#!/usr/bin/env node
import dotenv from "dotenv"
import pg from "pg"
import { hashStaffPassword, validateStaffPasswordLength } from "../../src/lib/auth/staff-password"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

const ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "CATALOG_MANAGER",
  "REVIEWER",
  "FINANCE",
  "SUPPORT",
] as const

type StaffRole = (typeof ALLOWED_ROLES)[number]

function normalizeRole(raw: string | undefined): StaffRole {
  const value = raw?.trim().toUpperCase() ?? ""
  if (ALLOWED_ROLES.includes(value as StaffRole)) return value as StaffRole
  return "SUPER_ADMIN"
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    console.error("DATABASE_URL is required (load apps/api/.dev.vars).")
    process.exit(1)
  }

  const username = process.env.STAFF_BOOTSTRAP_USERNAME?.trim().toLowerCase()
  const password = process.env.STAFF_BOOTSTRAP_PASSWORD ?? ""
  const displayName = process.env.STAFF_BOOTSTRAP_DISPLAY_NAME?.trim() || username || "Staff"
  const role = normalizeRole(process.env.STAFF_BOOTSTRAP_ROLE)

  if (!username) {
    console.error("STAFF_BOOTSTRAP_USERNAME is required.")
    process.exit(1)
  }

  const strength = validateStaffPasswordLength(password)
  if (strength) {
    console.error(strength)
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  try {
    const existing = await pool.query<{ id: string }>("select id from staff_accounts where lower(username) = $1 limit 1", [
      username,
    ])
    if (existing.rows[0]) {
      console.log(`Staff account already exists for username '${username}'. No changes made.`)
      return
    }

    const passwordHash = await hashStaffPassword(password)
    await pool.query(
      `insert into staff_accounts (
        username,
        password_hash,
        display_name,
        role,
        status,
        password_updated_at
      ) values ($1, $2, $3, $4, 'ACTIVE', now())`,
      [username, passwordHash, displayName, role],
    )

    console.log(`Created staff account '${username}' with role ${role}. Password was not printed.`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
