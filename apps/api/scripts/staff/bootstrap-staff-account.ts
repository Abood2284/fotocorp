#!/usr/bin/env node
import dotenv from "dotenv"
import { createHttpDb } from "../../src/db"
import { createStaffMember, findStaffMemberByUsername } from "../../src/lib/staff/staff-member"
import { validateStaffPasswordLength } from "../../src/lib/auth/staff-password"

dotenv.config({ path: ".dev.vars" })

const ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "CATALOG_MANAGER",
  "REVIEWER",
  "CAPTION_MANAGER",
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

  const db = createHttpDb(databaseUrl)
  const existing = await findStaffMemberByUsername(db, username)
  if (existing) {
    console.log(`Staff member already exists for username '${username}'. No changes made.`)
    return
  }

  const created = await createStaffMember(db, {
    username,
    password,
    displayName,
    role,
  })

  if (!created) {
    console.error("Staff member could not be created.")
    process.exit(1)
  }

  console.log(`Created staff member '${username}' with role ${role}. Password was not printed.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
