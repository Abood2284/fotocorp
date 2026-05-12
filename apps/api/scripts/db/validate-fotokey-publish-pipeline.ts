#!/usr/bin/env node
/**
 * PR-15.1 — Validate Fotokey + photographer publish pipeline invariants.
 *
 * Run: pnpm --dir apps/api db:validate:fotokey-publish
 *
 * Exits non-zero on the first hard failure.
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
    console.log("--- 1. Duplicate Fotokey ---");
    const duplicates = await pool.query<{ fotokey: string; count: string }>(`
      select fotokey, count(*)::text as count
      from image_assets
      where fotokey is not null
      group by fotokey
      having count(*) > 1
    `);
    console.log(`duplicate_fotokeys: ${duplicates.rowCount ?? 0}`);
    if ((duplicates.rowCount ?? 0) !== 0) {
      console.log(duplicates.rows);
      failures.push("duplicate_fotokeys must be 0");
    }

    console.log("\n--- 2. Fotokey format (FC + 6 date digits + ≥3 sequence digits) ---");
    const badFormat = await pool.query<{ bad_format_fotokeys: string }>(`
      select count(*)::text as bad_format_fotokeys
      from image_assets
      where fotokey is not null
        and fotokey !~ '^FC[0-9]{6}[0-9]{3,}$'
    `);
    console.log(badFormat.rows[0]);
    if (toNumber(badFormat.rows[0]?.bad_format_fotokeys) !== 0) {
      failures.push("bad_format_fotokeys must be 0");
    }

    console.log("\n--- 3. Fotokey date/sequence/assigned-at consistency ---");
    const badConsistency = await pool.query<{ bad_consistency: string }>(`
      select count(*)::text as bad_consistency
      from image_assets
      where fotokey is not null
        and (fotokey_date is null or fotokey_sequence is null or fotokey_assigned_at is null)
    `);
    console.log(badConsistency.rows[0]);
    if (toNumber(badConsistency.rows[0]?.bad_consistency) !== 0) {
      failures.push("fotokey date/sequence/assigned_at must be set when fotokey is set");
    }

    console.log("\n--- 4. Active public photographer-uploaded assets must have READY THUMB/CARD/DETAIL ---");
    const missingDerivatives = await pool.query<{ active_public_missing_derivatives: string }>(`
      select count(*)::text as active_public_missing_derivatives
      from image_assets ia
      left join image_derivatives thumb
        on thumb.image_asset_id = ia.id and thumb.variant = 'THUMB' and thumb.generation_status = 'READY'
      left join image_derivatives card
        on card.image_asset_id = ia.id and card.variant = 'CARD' and card.generation_status = 'READY'
      left join image_derivatives detail
        on detail.image_asset_id = ia.id and detail.variant = 'DETAIL' and detail.generation_status = 'READY'
      where ia.source = 'FOTOCORP'
        and ia.status = 'ACTIVE'
        and ia.visibility = 'PUBLIC'
        and ia.fotokey is not null
        and exists (
          select 1
          from contributor_upload_items pui
          where pui.image_asset_id = ia.id
        )
        and (thumb.id is null or card.id is null or detail.id is null)
    `);
    console.log(missingDerivatives.rows[0]);
    if (toNumber(missingDerivatives.rows[0]?.active_public_missing_derivatives) !== 0) {
      failures.push("active_public_missing_derivatives (photographer uploads) must be 0");
    }

    console.log("\n--- 5. Upload-linked APPROVED/ACTIVE assets must have a Fotokey ---");
    const approvedMissingFotokey = await pool.query<{ approved_uploads_missing_fotokey: string }>(`
      select count(*)::text as approved_uploads_missing_fotokey
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where ia.status in ('APPROVED', 'ACTIVE')
        and ia.fotokey is null
    `);
    console.log(approvedMissingFotokey.rows[0]);
    if (toNumber(approvedMissingFotokey.rows[0]?.approved_uploads_missing_fotokey) !== 0) {
      failures.push("approved_uploads_missing_fotokey must be 0");
    }

    console.log("\n--- 6. Active upload-linked assets must be PUBLIC ---");
    const activeNotPublic = await pool.query<{ active_uploads_not_public: string }>(`
      select count(*)::text as active_uploads_not_public
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where ia.status = 'ACTIVE'
        and ia.visibility <> 'PUBLIC'
    `);
    console.log(activeNotPublic.rows[0]);
    if (toNumber(activeNotPublic.rows[0]?.active_uploads_not_public) !== 0) {
      failures.push("active_uploads_not_public must be 0");
    }

    console.log("\n--- 7. APPROVED upload-linked assets must remain PRIVATE ---");
    const approvedNotPrivate = await pool.query<{ approved_uploads_not_private: string }>(`
      select count(*)::text as approved_uploads_not_private
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where ia.status = 'APPROVED'
        and ia.visibility <> 'PRIVATE'
    `);
    console.log(approvedNotPrivate.rows[0]);
    if (toNumber(approvedNotPrivate.rows[0]?.approved_uploads_not_private) !== 0) {
      failures.push("approved_uploads_not_private must be 0");
    }

    console.log("\n--- 8a. image_publish_job_items.job_id orphans ---");
    const jobOrphans = await pool.query<{ job_id_orphans: string }>(`
      select count(*)::text as job_id_orphans
      from image_publish_job_items jpi
      left join image_publish_jobs ipj on ipj.id = jpi.job_id
      where ipj.id is null
    `);
    console.log(jobOrphans.rows[0]);
    if (toNumber(jobOrphans.rows[0]?.job_id_orphans) !== 0) {
      failures.push("publish_job_id_orphans must be 0");
    }

    console.log("\n--- 8b. image_publish_job_items.image_asset_id orphans ---");
    const assetOrphans = await pool.query<{ asset_id_orphans: string }>(`
      select count(*)::text as asset_id_orphans
      from image_publish_job_items jpi
      left join image_assets ia on ia.id = jpi.image_asset_id
      where ia.id is null
    `);
    console.log(assetOrphans.rows[0]);
    if (toNumber(assetOrphans.rows[0]?.asset_id_orphans) !== 0) {
      failures.push("publish_job_asset_id_orphans must be 0");
    }

    console.log("\n--- 9. Upload-linked assets must remain source=FOTOCORP ---");
    const wrongSource = await pool.query<{ wrong_source: string }>(`
      select count(*)::text as wrong_source
      from contributor_upload_items pui
      join image_assets ia on ia.id = pui.image_asset_id
      where ia.source <> 'FOTOCORP'
    `);
    console.log(wrongSource.rows[0]);
    if (toNumber(wrongSource.rows[0]?.wrong_source) !== 0) {
      failures.push("upload-linked assets must have source = FOTOCORP");
    }

    console.log("\n--- 10. Counter sequence sanity vs assigned Fotokeys ---");
    const counterCheck = await pool.query<{
      mismatches: string;
    }>(`
      with per_day as (
        select fotokey_date, max(fotokey_sequence)::bigint as max_seq
        from image_assets
        where fotokey is not null
        group by fotokey_date
      )
      select count(*)::text as mismatches
      from per_day pd
      left join fotokey_daily_counters c on c.code_date = pd.fotokey_date
      where c.last_sequence is null
         or c.last_sequence < pd.max_seq
    `);
    console.log(counterCheck.rows[0]);
    if (toNumber(counterCheck.rows[0]?.mismatches) !== 0) {
      failures.push("fotokey_daily_counters.last_sequence must be >= max sequence in image_assets per day");
    }

    console.log("\n--- 11. Informational: active publish job item counts by status ---");
    const itemDistribution = await pool.query<{ status: string; count: string }>(`
      select status, count(*)::text as count
      from image_publish_job_items
      group by status
      order by status
    `);
    if (itemDistribution.rows.length === 0) {
      console.log("no rows");
    } else {
      for (const row of itemDistribution.rows) console.log(row);
    }

    console.log("\n--- 12. Informational: assets with Fotokey ---");
    const fotokeyCount = await pool.query<{ count: string }>(
      `select count(*)::text as count from image_assets where fotokey is not null`,
    );
    console.log(fotokeyCount.rows[0]);

    if (failures.length > 0) {
      console.error("\nFAIL:");
      for (const reason of failures) console.error(`  - ${reason}`);
      process.exitCode = 1;
    } else {
      console.log("\nOK fotokey publish pipeline validations passed.");
    }
  } catch (error) {
    console.error("FAIL", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
