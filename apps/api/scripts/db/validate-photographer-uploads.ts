#!/usr/bin/env node
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".dev.vars" });

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("FAIL DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const failures: string[] = [];

function toNumber(value: string | undefined) {
  return value === undefined ? NaN : Number(value);
}

async function main() {
  try {
    console.log("--- Batch FK orphans ---");
    const batchOrphans = await pool.query<{ batch_fk_orphans: string }>(`
      select count(*)::text as batch_fk_orphans
      from contributor_upload_batches b
      left join contributors p on p.id = b.contributor_id
      left join contributor_accounts pa on pa.id = b.contributor_account_id
      left join photo_events pe on pe.id = b.event_id
      where p.id is null or pa.id is null or pe.id is null
    `);
    console.log(batchOrphans.rows[0]);
    if (toNumber(batchOrphans.rows[0]?.batch_fk_orphans) !== 0) {
      failures.push("batch_fk_orphans must be 0");
    }

    console.log("\n--- Item FK orphans ---");
    const itemOrphans = await pool.query<{ item_fk_orphans: string }>(`
      select count(*)::text as item_fk_orphans
      from contributor_upload_items i
      left join contributor_upload_batches b on b.id = i.batch_id
      left join contributors p on p.id = i.contributor_id
      left join contributor_accounts pa on pa.id = i.contributor_account_id
      where b.id is null or p.id is null or pa.id is null
    `);
    console.log(itemOrphans.rows[0]);
    if (toNumber(itemOrphans.rows[0]?.item_fk_orphans) !== 0) {
      failures.push("item_fk_orphans must be 0");
    }

    console.log("\n--- Item/image photographer mismatch ---");
    const mismatches = await pool.query<{ item_image_photographer_mismatches: string }>(`
      select count(*)::text as item_image_photographer_mismatches
      from contributor_upload_items i
      join image_assets ia on ia.id = i.image_asset_id
      where ia.contributor_id <> i.contributor_id
    `);
    console.log(mismatches.rows[0]);
    if (toNumber(mismatches.rows[0]?.item_image_photographer_mismatches) !== 0) {
      failures.push("item_image_photographer_mismatches must be 0");
    }

    console.log("\n--- 1. Uploaded image source (must be FOTOCORP) ---");
    const wrongSource = await pool.query<{ uploaded_items_with_non_fotocorp_source: string }>(`
      select count(*)::text as uploaded_items_with_non_fotocorp_source
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where ia.source <> 'FOTOCORP'
    `);
    console.log(wrongSource.rows[0]);
    if (toNumber(wrongSource.rows[0]?.uploaded_items_with_non_fotocorp_source) !== 0) {
      failures.push("uploaded_items_with_non_fotocorp_source must be 0");
    }

    console.log("\n--- 2. Uploaded image privacy (PR-15.1: PRIVATE for SUBMITTED/APPROVED, PUBLIC for ACTIVE) ---");
    const badVisibilityPair = await pool.query<{ uploaded_items_bad_visibility: string }>(`
      select count(*)::text as uploaded_items_bad_visibility
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where not (
        (ia.status in ('SUBMITTED', 'APPROVED') and ia.visibility = 'PRIVATE')
        or
        (ia.status = 'ACTIVE' and ia.visibility = 'PUBLIC')
      )
    `);
    console.log(badVisibilityPair.rows[0]);
    if (toNumber(badVisibilityPair.rows[0]?.uploaded_items_bad_visibility) !== 0) {
      failures.push("uploaded_items_bad_visibility must be 0");
    }

    console.log("\n--- 3. Uploaded image status (must be SUBMITTED, APPROVED, or ACTIVE only) ---");
    const badStatuses = await pool.query<{ status: string; count: string }>(`
      select ia.status, count(*)::text as count
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where ia.status not in ('SUBMITTED', 'APPROVED', 'ACTIVE')
      group by ia.status
      order by ia.status
    `);
    console.table(badStatuses.rows);
    if (badStatuses.rows.length > 0) {
      failures.push("photographer-uploaded assets must have status SUBMITTED, APPROVED, or ACTIVE only");
    }

    console.log("\n--- 4. Upload items referencing missing image_assets ---");
    const missingAssets = await pool.query<{ upload_items_missing_image_asset: string }>(`
      select count(*)::text as upload_items_missing_image_asset
      from contributor_upload_items pui
      left join image_assets ia on ia.id = pui.image_asset_id
      where pui.image_asset_id is not null
        and ia.id is null
    `);
    console.log(missingAssets.rows[0]);
    if (toNumber(missingAssets.rows[0]?.upload_items_missing_image_asset) !== 0) {
      failures.push("upload_items_missing_image_asset must be 0");
    }

    console.log("\n--- 5. Distribution: source / status / visibility (upload-linked assets) ---");
    const dist = await pool.query<{ source: string; status: string; visibility: string; count: string }>(`
      select ia.source, ia.status, ia.visibility, count(*)::text as count
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      group by ia.source, ia.status, ia.visibility
      order by ia.source, ia.status, ia.visibility
    `);
    console.table(dist.rows);

    console.log("\n--- Remaining image_assets.source = PHOTOGRAPHER_UPLOAD (deprecated; expect 0) ---");
    const legacySource = await pool.query<{ remaining_photographer_upload_source_rows: string }>(`
      select count(*)::text as remaining_photographer_upload_source_rows
      from image_assets
      where source = 'PHOTOGRAPHER_UPLOAD'
    `);
    console.log(legacySource.rows[0]);
    if (toNumber(legacySource.rows[0]?.remaining_photographer_upload_source_rows) !== 0) {
      failures.push(
        "remaining_photographer_upload_source_rows must be 0 (run migration 0020 or fix orphan rows not linked from contributor_upload_items)",
      );
    }

    console.log("\n--- Duplicate upload storage keys ---");
    const dupKeys = await pool.query<{ duplicate_upload_storage_keys: string }>(`
      select count(*)::text as duplicate_upload_storage_keys
      from (
        select storage_key, count(*)
        from contributor_upload_items
        group by storage_key
        having count(*) > 1
      ) d
    `);
    console.log(dupKeys.rows[0]);
    if (toNumber(dupKeys.rows[0]?.duplicate_upload_storage_keys) !== 0) {
      failures.push("duplicate_upload_storage_keys must be 0");
    }

    console.log("\n--- Upload status distribution (informational) ---");
    const uploadStatusDist = await pool.query<{ upload_status: string; count: string }>(`
      select upload_status, count(*)::text as count
      from contributor_upload_items
      group by upload_status
      order by upload_status
    `);
    console.table(uploadStatusDist.rows);

    console.log("\n--- Batch status distribution (informational) ---");
    const batchStatusDist = await pool.query<{ status: string; count: string }>(`
      select status, count(*)::text as count
      from contributor_upload_batches
      group by status
      order by status
    `);
    console.table(batchStatusDist.rows);

    if (failures.length > 0) {
      console.error("FAIL photographer uploads validation:");
      for (const failure of failures) console.error(`- ${failure}`);
      process.exitCode = 1;
    } else {
      console.log("\nPASS photographer uploads validation.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
