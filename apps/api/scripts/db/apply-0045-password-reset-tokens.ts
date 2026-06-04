/**
 * One-off: apply 0045_password_reset_tokens when the SQL file exists but the table does not.
 * Safe to re-run (uses IF NOT EXISTS).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createHash } from "node:crypto"
import pg from "pg"
import * as dotenv from "dotenv"

dotenv.config({ path: resolve(import.meta.dirname, "../../.dev.vars") })

const DATABASE_URL = process.env.DATABASE_URL?.trim()
if (!DATABASE_URL) {
  console.error("DATABASE_URL missing in apps/api/.dev.vars")
  process.exit(1)
}

const sqlPath = resolve(import.meta.dirname, "../../drizzle/0045_password_reset_tokens.sql")
const sqlFile = readFileSync(sqlPath, "utf8")
const fileHash = createHash("sha256").update(sqlFile).digest("hex")

const statements = sqlFile
  .split(/--> statement-breakpoint\n?/)
  .map((s) => s.trim())
  .filter(Boolean)

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    for (const statement of statements) {
      await client.query(statement)
    }

    const exists = await client.query(
      "select to_regclass('public.password_reset_tokens') as exists",
    )
    console.log("password_reset_tokens:", exists.rows[0]?.exists ?? null)

    const existing = await client.query(
      "select id, hash from drizzle.__drizzle_migrations where hash = $1",
      [fileHash],
    )
    if (existing.rows.length === 0) {
      await client.query(
        "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
        [fileHash, Date.now()],
      )
      console.log("Recorded migration hash in drizzle.__drizzle_migrations")
    } else {
      console.log("Migration hash already recorded")
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
