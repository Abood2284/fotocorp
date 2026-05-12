#!/usr/bin/env node
/**
 * PR-15 — Admin photographer upload review queue validation.
 *
 * Verifies that upload-linked image assets are tracked correctly via
 * `contributor_upload_items` so the admin review/approval queue stays
 * consistent with PR-14.1 (`source = FOTOCORP`) and the SUBMITTED/PRIVATE
 * vs ACTIVE/PUBLIC invariant.
 *
 * Failures (non-zero exit) on:
 *   1. upload-linked assets with non-FOTOCORP source
 *   2. upload-linked assets with status outside SUBMITTED/ACTIVE
 *   3. upload-linked assets with invalid status/visibility pair
 *   4. upload items pointing at missing image_assets
 */
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
    console.log("--- 1. Upload-linked assets must have source = FOTOCORP ---");
    const wrongSource = await pool.query<{ upload_assets_with_wrong_source: string }>(`
      select count(*)::text as upload_assets_with_wrong_source
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where ia.source <> 'FOTOCORP'
    `);
    console.log(wrongSource.rows[0]);
    if (toNumber(wrongSource.rows[0]?.upload_assets_with_wrong_source) !== 0) {
      failures.push("upload_assets_with_wrong_source must be 0");
    }

    console.log("\n--- 2. Upload-linked assets must have status in (SUBMITTED, APPROVED, ACTIVE) ---");
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
      failures.push(
        "upload-linked assets must have status SUBMITTED, APPROVED, or ACTIVE only",
      );
    }

    console.log("\n--- 3. Upload-linked assets must have valid status/visibility pair ---");
    const badVisibility = await pool.query<{
      visibility: string;
      status: string;
      count: string;
    }>(`
      select ia.visibility, ia.status, count(*)::text as count
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where not (
        (ia.status = 'SUBMITTED' and ia.visibility = 'PRIVATE')
        or
        (ia.status = 'APPROVED' and ia.visibility = 'PRIVATE')
        or
        (ia.status = 'ACTIVE' and ia.visibility = 'PUBLIC')
      )
      group by ia.visibility, ia.status
      order by ia.status, ia.visibility
    `);
    console.table(badVisibility.rows);
    if (badVisibility.rows.length > 0) {
      failures.push(
        "upload-linked assets must use SUBMITTED+PRIVATE, APPROVED+PRIVATE, or ACTIVE+PUBLIC pairs only",
      );
    }

    console.log("\n--- 4. Upload items must not have orphan image_asset_id ---");
    const itemOrphans = await pool.query<{ upload_item_image_orphans: string }>(`
      select count(*)::text as upload_item_image_orphans
      from contributor_upload_items pui
      left join image_assets ia on ia.id = pui.image_asset_id
      where pui.image_asset_id is not null
        and ia.id is null
    `);
    console.log(itemOrphans.rows[0]);
    if (toNumber(itemOrphans.rows[0]?.upload_item_image_orphans) !== 0) {
      failures.push("upload_item_image_orphans must be 0");
    }

    console.log("\n--- 5. Review queue distribution (informational) ---");
    const distribution = await pool.query<{
      status: string;
      visibility: string;
      count: string;
    }>(`
      select ia.status, ia.visibility, count(*)::text as count
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      group by ia.status, ia.visibility
      order by ia.status, ia.visibility
    `);
    console.table(distribution.rows);

    console.log("\n--- 6. Submitted queue count (informational) ---");
    const submittedCount = await pool.query<{ submitted_private_uploads: string }>(`
      select count(*)::text as submitted_private_uploads
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where ia.status = 'SUBMITTED'
        and ia.visibility = 'PRIVATE'
    `);
    console.log(submittedCount.rows[0]);

    console.log("\n--- 7. Approved (ACTIVE/PUBLIC) upload-linked count (informational) ---");
    const approvedCount = await pool.query<{ active_public_uploads: string }>(`
      select count(*)::text as active_public_uploads
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where ia.status = 'ACTIVE'
        and ia.visibility = 'PUBLIC'
    `);
    console.log(approvedCount.rows[0]);

    if (failures.length > 0) {
      console.error("\nFAIL admin photographer upload review validation:");
      for (const failure of failures) console.error(`- ${failure}`);
      process.exitCode = 1;
    } else {
      console.log("\nPASS admin photographer upload review validation.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
