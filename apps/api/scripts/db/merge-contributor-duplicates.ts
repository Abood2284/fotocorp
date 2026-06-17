#!/usr/bin/env node
/**
 * ONE-TIME — delete after use. See scripts/db/ONE_TIME_SCRIPTS.md
 *
 * Merge duplicate contributor rows into canonical winners, reassign FKs, delete losers.
 * Spec: docs/db-revamp/auth-identity-revamp-migration-spec.md §5–§9
 *
 *   pnpm --dir apps/api db:merge:contributor-duplicates -- --dry-run
 *   pnpm --dir apps/api db:merge:contributor-duplicates
 */
import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

const dryRun = process.argv.includes("--dry-run")

interface ContributorRow {
  id: string
  legacy_photographer_id: number
  display_name: string
}

const MERGES = [
  { loserLegacyId: 2214, winnerLegacyId: 36, reason: "Ganesh L → Ganesh Lad" },
  { loserLegacyId: 2213, winnerLegacyId: 36, reason: "Ganesh → Ganesh Lad" },
  { loserLegacyId: 2216, winnerLegacyId: 36, reason: "Duplicate Ganesh Lad → Ganesh Lad" },
  { loserLegacyId: 2218, winnerLegacyId: 642, reason: "Duplicate Jafar Khan → Jafar Khan" },
  { loserLegacyId: 1072, winnerLegacyId: 773, reason: "SUBHASH BAROLIA → Subhash Barolia" },
] as const

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("FAIL DATABASE_URL is required.")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const client = await pool.connect()

  try {
    const resolvedMerges = []
    for (const merge of MERGES) {
      const loser = await loadContributor(client, merge.loserLegacyId)
      const winner = await loadContributor(client, merge.winnerLegacyId)
      if (!loser || !winner) {
        console.error("FAIL missing contributor rows for merge:", merge)
        process.exit(1)
      }
      resolvedMerges.push({ ...merge, loser, winner })
    }

    const preCounts = []
    for (const merge of resolvedMerges) {
      preCounts.push({
        merge: merge.reason,
        loser: summarizeContributor(merge.loser),
        winner: summarizeContributor(merge.winner),
        references: await loadReferenceCounts(client, merge.loser.id),
      })
    }

    console.log(JSON.stringify({ phase: "pre_merge_counts", dryRun, items: preCounts }, null, 2))

    if (dryRun) {
      console.log("Dry run complete — no rows written.")
      return
    }

    await client.query("BEGIN")

    const applyResults = []
    for (const merge of resolvedMerges) {
      applyResults.push({
        merge: merge.reason,
        ...(await applyMerge(client, merge.loser.id, merge.winner.id)),
      })
    }

    const deleteResults = []
    for (const merge of resolvedMerges) {
      const remaining = await loadReferenceCounts(client, merge.loser.id)
      if (hasRemainingReferences(remaining)) {
        throw new Error(`Cannot delete ${merge.loser.display_name}; references remain: ${JSON.stringify(remaining)}`)
      }

      const deleteResult = await client.query(
        `delete from contributors where id = $1::uuid`,
        [merge.loser.id],
      )
      deleteResults.push({
        deletedContributor: merge.loser.display_name,
        legacyPhotographerId: merge.loser.legacy_photographer_id,
        rowsDeleted: deleteResult.rowCount ?? 0,
      })
    }

    await client.query("COMMIT")

    const postContributorCount = await client.query<{ count: string }>(
      `select count(*)::int as count from contributors`,
    )

    console.log(JSON.stringify({ phase: "apply", items: applyResults }, null, 2))
    console.log(JSON.stringify({ phase: "deleted_contributors", items: deleteResults }, null, 2))
    console.log(
      JSON.stringify(
        { phase: "post_merge", total_contributors: Number(postContributorCount.rows[0]?.count ?? 0) },
        null,
        2,
      ),
    )

    console.log("OK merged contributor duplicates and deleted loser rows.")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

function summarizeContributor(row: ContributorRow) {
  return {
    id: row.id,
    legacyPhotographerId: row.legacy_photographer_id,
    displayName: row.display_name,
  }
}

async function loadContributor(client: pg.PoolClient, legacyPhotographerId: number) {
  const result = await client.query<ContributorRow>(
    `
      select id, legacy_photographer_id, display_name
      from contributors
      where legacy_photographer_id = $1
      limit 1
    `,
    [legacyPhotographerId],
  )

  return result.rows[0] ?? null
}

interface ReferenceCounts {
  image_assets: number
  photo_events: number
  contributor_upload_batches: number
  contributor_upload_items: number
  customer_access_inquiries: number
}

async function loadReferenceCounts(client: pg.PoolClient, contributorId: string): Promise<ReferenceCounts> {
  const result = await client.query<{
    image_assets: string
    photo_events: string
    contributor_upload_batches: string
    contributor_upload_items: string
    customer_access_inquiries: string
  }>(
    `
      select
        (select count(*)::int from image_assets where contributor_id = $1::uuid) as image_assets,
        (select count(*)::int from photo_events where created_by_contributor_id = $1::uuid) as photo_events,
        (select count(*)::int from contributor_upload_batches where contributor_id = $1::uuid) as contributor_upload_batches,
        (select count(*)::int from contributor_upload_items where contributor_id = $1::uuid) as contributor_upload_items,
        (select count(*)::int from customer_access_inquiries where contributor_id = $1::uuid) as customer_access_inquiries
    `,
    [contributorId],
  )

  const row = result.rows[0]
  return {
    image_assets: Number(row?.image_assets ?? 0),
    photo_events: Number(row?.photo_events ?? 0),
    contributor_upload_batches: Number(row?.contributor_upload_batches ?? 0),
    contributor_upload_items: Number(row?.contributor_upload_items ?? 0),
    customer_access_inquiries: Number(row?.customer_access_inquiries ?? 0),
  }
}

function hasRemainingReferences(counts: ReferenceCounts) {
  return (
    counts.image_assets > 0
    || counts.photo_events > 0
    || counts.contributor_upload_batches > 0
    || counts.contributor_upload_items > 0
    || counts.customer_access_inquiries > 0
  )
}

async function applyMerge(client: pg.PoolClient, loserId: string, winnerId: string) {
  const imageAssets = await client.query(
    `
      update image_assets
      set contributor_id = $1::uuid, updated_at = now()
      where contributor_id = $2::uuid
    `,
    [winnerId, loserId],
  )

  const photoEvents = await client.query(
    `
      update photo_events
      set created_by_contributor_id = $1::uuid, updated_at = now()
      where created_by_contributor_id = $2::uuid
    `,
    [winnerId, loserId],
  )

  const uploadBatches = await client.query(
    `
      update contributor_upload_batches
      set contributor_id = $1::uuid, updated_at = now()
      where contributor_id = $2::uuid
    `,
    [winnerId, loserId],
  )

  const uploadItems = await client.query(
    `
      update contributor_upload_items
      set contributor_id = $1::uuid, updated_at = now()
      where contributor_id = $2::uuid
    `,
    [winnerId, loserId],
  )

  const accessInquiries = await client.query(
    `
      update customer_access_inquiries
      set contributor_id = $1::uuid, updated_at = now()
      where contributor_id = $2::uuid
    `,
    [winnerId, loserId],
  )

  return {
    imageAssetsUpdated: imageAssets.rowCount ?? 0,
    photoEventsUpdated: photoEvents.rowCount ?? 0,
    uploadBatchesUpdated: uploadBatches.rowCount ?? 0,
    uploadItemsUpdated: uploadItems.rowCount ?? 0,
    accessInquiriesUpdated: accessInquiries.rowCount ?? 0,
  }
}

main().catch((error) => {
  console.error("FAIL", error)
  process.exit(1)
})
