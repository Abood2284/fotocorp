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
    console.log("--- Invalid created_by_source values ---")
    const badSources = await pool.query<{ created_by_source: string; count: string }>(`
      select created_by_source, count(*)::text as count
      from photo_events
      where created_by_source not in ('LEGACY_IMPORT', 'ADMIN', 'PHOTOGRAPHER', 'SYSTEM')
      group by created_by_source
    `)
    console.log(badSources.rows)
    if (badSources.rows.length > 0) failures.push("created_by_source must be only LEGACY_IMPORT, ADMIN, PHOTOGRAPHER, SYSTEM")

    console.log("\n--- Photographer-created events missing creator ---")
    const missingCreator = await pool.query<{ photographer_events_missing_creator: string }>(`
      select count(*)::text as photographer_events_missing_creator
      from photo_events
      where created_by_source = 'PHOTOGRAPHER'
        and created_by_contributor_id is null
    `)
    console.log(missingCreator.rows[0])
    if (toNumber(missingCreator.rows[0]?.photographer_events_missing_creator) !== 0) {
      failures.push("photographer_events_missing_creator must be 0")
    }

    console.log("\n--- Photographer-created events missing account ---")
    const missingAccount = await pool.query<{ photographer_events_missing_account: string }>(`
      select count(*)::text as photographer_events_missing_account
      from photo_events
      where created_by_source = 'PHOTOGRAPHER'
        and created_by_contributor_account_id is null
    `)
    console.log(missingAccount.rows[0])
    if (toNumber(missingAccount.rows[0]?.photographer_events_missing_account) !== 0) {
      failures.push("photographer_events_missing_account must be 0")
    }

    console.log("\n--- Event creator photographer FK orphans ---")
    const creatorOrphans = await pool.query<{ event_creator_orphans: string }>(`
      select count(*)::text as event_creator_orphans
      from photo_events pe
      left join contributors p on p.id = pe.created_by_contributor_id
      where pe.created_by_contributor_id is not null
        and p.id is null
    `)
    console.log(creatorOrphans.rows[0])
    if (toNumber(creatorOrphans.rows[0]?.event_creator_orphans) !== 0) {
      failures.push("event_creator_orphans must be 0")
    }

    console.log("\n--- Event creator account FK orphans ---")
    const accountOrphans = await pool.query<{ event_creator_account_orphans: string }>(`
      select count(*)::text as event_creator_account_orphans
      from photo_events pe
      left join contributor_accounts pa on pa.id = pe.created_by_contributor_account_id
      where pe.created_by_contributor_account_id is not null
        and pa.id is null
    `)
    console.log(accountOrphans.rows[0])
    if (toNumber(accountOrphans.rows[0]?.event_creator_account_orphans) !== 0) {
      failures.push("event_creator_account_orphans must be 0")
    }

    console.log("\n--- created_by_source distribution (informational) ---")
    const distribution = await pool.query<{ created_by_source: string; count: string }>(`
      select created_by_source, count(*)::text as count
      from photo_events
      group by created_by_source
      order by created_by_source
    `)
    console.log(distribution.rows)

    if (failures.length > 0) {
      console.error("\nFAIL:")
      for (const failure of failures) console.error(`  - ${failure}`)
      process.exitCode = 1
    } else {
      console.log("\nPASS photographer events validation.")
    }
  } finally {
    await pool.end()
  }
}

main()
