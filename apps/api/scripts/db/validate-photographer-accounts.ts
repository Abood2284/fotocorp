#!/usr/bin/env node
import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("FAIL DATABASE_URL is required.")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })
const failures: string[] = []

function toNumber(value: string | undefined) {
  return value === undefined ? NaN : Number(value)
}

async function main() {
  try {
    console.log("--- Duplicate usernames (case-insensitive) ---")
    const dupUser = await pool.query<{ c: string }>(`
      select count(*)::text as c from (
        select lower(username)
        from contributor_accounts
        group by lower(username)
        having count(*) > 1
      ) d
    `)
    console.log(dupUser.rows[0])
    if (toNumber(dupUser.rows[0]?.c) !== 0) failures.push("duplicate_usernames must be 0")

    console.log("\n--- Duplicate contributor_id ---")
    const dupPhoto = await pool.query<{ c: string }>(`
      select count(*)::text as c from (
        select contributor_id
        from contributor_accounts
        group by contributor_id
        having count(*) > 1
      ) d
    `)
    console.log(dupPhoto.rows[0])
    if (toNumber(dupPhoto.rows[0]?.c) !== 0) failures.push("duplicate_contributor_accounts must be 0")

    console.log("\n--- Missing photographer FK ---")
    const missFk = await pool.query<{ c: string }>(`
      select count(*)::text as c
      from contributor_accounts pa
      left join contributors p on p.id = pa.contributor_id
      where p.id is null
    `)
    console.log(missFk.rows[0])
    if (toNumber(missFk.rows[0]?.c) !== 0) failures.push("accounts_missing_photographer must be 0")

    console.log("\n--- Missing password hash ---")
    const missHash = await pool.query<{ c: string }>(`
      select count(*)::text as c
      from contributor_accounts
      where password_hash is null or btrim(password_hash) = ''
    `)
    console.log(missHash.rows[0])
    if (toNumber(missHash.rows[0]?.c) !== 0) failures.push("missing_password_hash must be 0")

    console.log("\n--- Plaintext-like or non-scrypt hashes ---")
    const plainLike = await pool.query<{ c: string }>(`
      select count(*)::text as c
      from contributor_accounts
      where password_hash like 'Foto-%'
        or (password_hash like 'ph\\_%' escape '\\' and password_hash not like '$%')
        or password_hash !~ '^\\$'
        or password_hash not like '$scrypt$%'
    `)
    console.log(plainLike.rows[0])
    if (toNumber(plainLike.rows[0]?.c) !== 0) failures.push("password_hash must be scrypt envelope ($scrypt$...)")

    console.log("\n--- Bad account statuses ---")
    const badStatus = await pool.query<{ status: string; count: string }>(`
      select status, count(*)::text as count
      from contributor_accounts
      where status not in ('ACTIVE', 'DISABLED', 'LOCKED')
      group by status
    `)
    console.log(badStatus.rows)
    if (badStatus.rows.length > 0) failures.push("invalid status values present")

    console.log("\n--- Account status distribution ---")
    const dist = await pool.query<{ status: string; count: string }>(`
      select status, count(*)::text as count
      from contributor_accounts
      group by status
      order by status
    `)
    console.log(dist.rows)

    console.log("\n--- Imported photographer account coverage ---")
    const coverage = await pool.query<{
      imported_contributors: string
      imported_contributors_with_accounts: string
    }>(`
      with imported_contributors as (
        select distinct contributor_id
        from image_assets
        where contributor_id is not null
      )
      select
        (select count(*)::text from imported_contributors) as imported_contributors,
        (
          select count(*)::text
          from imported_contributors ip
          inner join contributor_accounts pa on pa.contributor_id = ip.contributor_id
        ) as imported_contributors_with_accounts
    `)
    console.log(coverage.rows[0])

    if (failures.length > 0) {
      console.error("\nFAIL:")
      for (const f of failures) console.error(`  - ${f}`)
      process.exitCode = 1
    } else {
      console.log("\nPASS photographer accounts validation.")
    }
  } finally {
    await pool.end()
  }
}

main()
