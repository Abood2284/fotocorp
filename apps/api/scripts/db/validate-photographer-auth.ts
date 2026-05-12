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
    console.log("--- Photographer session FK orphan check ---")
    const orphanSessions = await pool.query<{ orphan_sessions: string }>(`
      select count(*)::text as orphan_sessions
      from contributor_sessions s
      left join contributor_accounts a on a.id = s.contributor_account_id
      left join contributors p on p.id = s.contributor_id
      where a.id is null or p.id is null
    `)
    console.log(orphanSessions.rows[0])
    if (toNumber(orphanSessions.rows[0]?.orphan_sessions) !== 0) failures.push("orphan_sessions must be 0")

    console.log("\n--- Photographer session account/photographer mismatch ---")
    const mismatchedSessions = await pool.query<{ mismatched_sessions: string }>(`
      select count(*)::text as mismatched_sessions
      from contributor_sessions s
      join contributor_accounts a on a.id = s.contributor_account_id
      where a.contributor_id <> s.contributor_id
    `)
    console.log(mismatchedSessions.rows[0])
    if (toNumber(mismatchedSessions.rows[0]?.mismatched_sessions) !== 0) failures.push("mismatched_sessions must be 0")

    console.log("\n--- Session token hashes ---")
    const weakTokens = await pool.query<{ weak_or_raw_token_hashes: string }>(`
      select count(*)::text as weak_or_raw_token_hashes
      from contributor_sessions
      where token_hash is null
        or btrim(token_hash) = ''
        or length(token_hash) < 32
    `)
    console.log(weakTokens.rows[0])
    if (toNumber(weakTokens.rows[0]?.weak_or_raw_token_hashes) !== 0) failures.push("weak_or_raw_token_hashes must be 0")

    console.log("\n--- Photographer account hashes ---")
    const accountHashes = await pool.query<{
      duplicate_usernames: string
      duplicate_contributor_accounts: string
      missing_password_hash: string
      plaintext_like_passwords: string
    }>(`
      select
        (
          select count(*)::text from (
            select lower(username)
            from contributor_accounts
            group by lower(username)
            having count(*) > 1
          ) d
        ) as duplicate_usernames,
        (
          select count(*)::text from (
            select contributor_id
            from contributor_accounts
            group by contributor_id
            having count(*) > 1
          ) d
        ) as duplicate_contributor_accounts,
        (
          select count(*)::text
          from contributor_accounts
          where password_hash is null or btrim(password_hash) = ''
        ) as missing_password_hash,
        (
          select count(*)::text
          from contributor_accounts
          where password_hash like 'Foto-%'
            or (password_hash like 'ph\\_%' escape '\\' and password_hash not like '$%')
            or password_hash !~ '^\\$'
            or password_hash not like '$scrypt$%'
        ) as plaintext_like_passwords
    `)
    console.log(accountHashes.rows[0])
    const accountHashRow = accountHashes.rows[0]
    if (toNumber(accountHashRow?.duplicate_usernames) !== 0) failures.push("duplicate_usernames must be 0")
    if (toNumber(accountHashRow?.duplicate_contributor_accounts) !== 0) failures.push("duplicate_contributor_accounts must be 0")
    if (toNumber(accountHashRow?.missing_password_hash) !== 0) failures.push("missing_password_hash must be 0")
    if (toNumber(accountHashRow?.plaintext_like_passwords) !== 0) failures.push("plaintext_like_passwords must be 0")

    console.log("\n--- Photographer image ownership FK check ---")
    const imageOwnership = await pool.query<{ images_without_matching_photographer: string }>(`
      select count(*)::text as images_without_matching_photographer
      from image_assets ia
      left join contributors p on p.id = ia.contributor_id
      where ia.contributor_id is not null
        and p.id is null
    `)
    console.log(imageOwnership.rows[0])
    if (toNumber(imageOwnership.rows[0]?.images_without_matching_photographer) !== 0) {
      failures.push("images_without_matching_photographer must be 0")
    }

    console.log("\n--- Account distribution ---")
    const accountDistribution = await pool.query<{ status: string; count: string }>(`
      select status, count(*)::text as count
      from contributor_accounts
      group by status
      order by status
    `)
    console.log(accountDistribution.rows)

    console.log("\n--- Active session distribution ---")
    const sessionDistribution = await pool.query<{
      active_sessions: string
      revoked_sessions: string
      expired_sessions: string
    }>(`
      select
        count(*) filter (where revoked_at is null and expires_at > now())::text as active_sessions,
        count(*) filter (where revoked_at is not null)::text as revoked_sessions,
        count(*) filter (where expires_at <= now())::text as expired_sessions
      from contributor_sessions
    `)
    console.log(sessionDistribution.rows[0])

    if (failures.length > 0) {
      console.error("\nFAIL:")
      for (const failure of failures) console.error(`  - ${failure}`)
      process.exitCode = 1
    } else {
      console.log("\nPASS photographer auth validation.")
    }
  } finally {
    await pool.end()
  }
}

main()
