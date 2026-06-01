#!/usr/bin/env node
/**
 * ONE-TIME — delete after use. See scripts/db/ONE_TIME_SCRIPTS.md
 *
 * Merge asset categories:
 *   ShowBiz & LifeStyle → Entertainment
 *   Politics → News
 * Then delete the source category rows.
 *
 *   pnpm --dir apps/api db:merge:asset-categories -- --dry-run
 *   pnpm --dir apps/api db:merge:asset-categories
 */
import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: ".dev.vars" })

const { Pool } = pg

const dryRun = process.argv.includes("--dry-run")

const MERGES = [
  {
    fromLegacyCode: 7,
    fromName: "ShowBiz & LifeStyle",
    toLegacyCode: 5,
    toName: "Entertainment",
  },
  {
    fromLegacyCode: 2,
    fromName: "Politics",
    toLegacyCode: 1,
    toName: "News",
  },
] as const

interface CategoryRow {
  id: string
  name: string
  legacy_category_code: number
}

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
      const from = await loadCategory(client, merge.fromLegacyCode, merge.fromName)
      const to = await loadCategory(client, merge.toLegacyCode, merge.toName)
      if (!from || !to) {
        console.error("FAIL missing category rows for merge:", merge)
        process.exit(1)
      }
      resolvedMerges.push({ ...merge, from, to })
    }

    const preCounts = []
    for (const merge of resolvedMerges) {
      preCounts.push({
        merge: `${merge.fromName} → ${merge.toName}`,
        ...await loadReferenceCounts(client, merge.from.id, merge.to.id),
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
        merge: `${merge.fromName} → ${merge.toName}`,
        ...(await applyMerge(client, merge.from, merge.to)),
      })
    }

    const deleteResults = []
    for (const merge of resolvedMerges) {
      const remaining = await loadReferenceCounts(client, merge.from.id, merge.to.id)
      if (
        remaining.image_assets > 0
        || remaining.photo_events > 0
        || remaining.assets > 0
      ) {
        throw new Error(`Cannot delete ${merge.fromName}; references remain: ${JSON.stringify(remaining)}`)
      }

      const deleteResult = await client.query(
        `delete from asset_categories where id = $1::uuid`,
        [merge.from.id],
      )
      deleteResults.push({
        deletedCategory: merge.fromName,
        rowsDeleted: deleteResult.rowCount ?? 0,
      })
    }

    await client.query("COMMIT")

    const postCategoryCount = await client.query<{ count: string }>(
      `select count(*)::int as count from asset_categories`,
    )

    console.log(JSON.stringify({ phase: "apply", items: applyResults }, null, 2))
    console.log(JSON.stringify({ phase: "deleted_categories", items: deleteResults }, null, 2))
    console.log(
      JSON.stringify(
        { phase: "post_merge", total_categories: Number(postCategoryCount.rows[0]?.count ?? 0) },
        null,
        2,
      ),
    )

    console.log("OK merged categories and deleted source rows.")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

async function loadCategory(client: pg.PoolClient, legacyCode: number, name: string) {
  const result = await client.query<CategoryRow>(
    `
      select id, name, legacy_category_code
      from asset_categories
      where legacy_category_code = $1
        and name = $2
      limit 1
    `,
    [legacyCode, name],
  )

  return result.rows[0] ?? null
}

async function loadReferenceCounts(client: pg.PoolClient, fromId: string, toId: string) {
  const result = await client.query<{
    image_assets_from: string
    photo_events_from: string
    assets_from: string
    image_assets_to: string
    photo_events_to: string
    assets_to: string
  }>(
    `
      select
        (select count(*)::int from image_assets where category_id = $1::uuid) as image_assets_from,
        (select count(*)::int from photo_events where category_id = $1::uuid) as photo_events_from,
        (select count(*)::int from assets where category_id = $1::uuid) as assets_from,
        (select count(*)::int from image_assets where category_id = $2::uuid) as image_assets_to,
        (select count(*)::int from photo_events where category_id = $2::uuid) as photo_events_to,
        (select count(*)::int from assets where category_id = $2::uuid) as assets_to
    `,
    [fromId, toId],
  )

  return {
    image_assets: Number(result.rows[0]?.image_assets_from ?? 0),
    photo_events: Number(result.rows[0]?.photo_events_from ?? 0),
    assets: Number(result.rows[0]?.assets_from ?? 0),
    target_image_assets: Number(result.rows[0]?.image_assets_to ?? 0),
    target_photo_events: Number(result.rows[0]?.photo_events_to ?? 0),
    target_assets: Number(result.rows[0]?.assets_to ?? 0),
  }
}

async function applyMerge(client: pg.PoolClient, from: CategoryRow, to: CategoryRow) {
  const imageAssets = await client.query(
    `
      update image_assets
      set
        category_id = $1::uuid,
        legacy_category_id = $2,
        updated_at = now()
      where category_id = $3::uuid
    `,
    [to.id, to.legacy_category_code, from.id],
  )

  const photoEvents = await client.query(
    `
      update photo_events
      set
        category_id = $1::uuid,
        updated_at = now()
      where category_id = $2::uuid
    `,
    [to.id, from.id],
  )

  const assets = await client.query(
    `
      update assets
      set
        category_id = $1::uuid,
        updated_at = now()
      where category_id = $2::uuid
    `,
    [to.id, from.id],
  )

  return {
    imageAssetsUpdated: imageAssets.rowCount ?? 0,
    photoEventsUpdated: photoEvents.rowCount ?? 0,
    assetsUpdated: assets.rowCount ?? 0,
  }
}

main().catch((error) => {
  console.error("FAIL", error)
  process.exit(1)
})
