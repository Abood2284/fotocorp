#!/usr/bin/env node
import dotenv from "dotenv";
import pg from "pg";
import {
  CARD_LIGHT_PREVIEW_PROFILE,
  DETAIL_PREVIEW_PROFILE,
  THUMB_LIGHT_PREVIEW_PROFILE,
} from "../../src/lib/media/watermark.js";

dotenv.config({ path: ".dev.vars" });

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("FAIL DATABASE_URL is required.");
  process.exit(1);
}

const shardCount = parsePositiveInteger(process.env.DERIVATIVE_SHARD_SMOKE_COUNT ?? "6", "DERIVATIVE_SHARD_SMOKE_COUNT");
const limit = parsePositiveInteger(process.env.DERIVATIVE_SHARD_SMOKE_LIMIT ?? "1000", "DERIVATIVE_SHARD_SMOKE_LIMIT");
if (shardCount > 128) {
  console.error("FAIL DERIVATIVE_SHARD_SMOKE_COUNT must be 128 or lower.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  try {
    const result = await pool.query<{
      eligible_count: number;
      assignment_count: number;
      distinct_assigned_count: number;
      min_assignments_per_asset: number | null;
      max_assignments_per_asset: number | null;
      duplicate_asset_count: number;
      missing_asset_count: number;
      shard_counts: Array<{ shardIndex: number; selectedCount: number }>;
    }>(
      `
        with eligible as (
          select a.id
          from image_assets a
          where a.media_type = 'IMAGE'
            and a.original_exists_in_storage = true
            and a.original_storage_key is not null
            and btrim(a.original_storage_key) <> ''
            and exists (
              select 1
              from unnest($1::text[]) as v(variant)
              left join image_derivatives d
                on d.image_asset_id = a.id
               and d.variant = upper(v.variant)
              where
                $6::boolean = true
                or d.image_asset_id is null
                or d.generation_status <> 'READY'
                or d.is_watermarked is distinct from true
                or (
                  case upper(v.variant)
                    when 'THUMB' then d.watermark_profile is distinct from $2::text
                    when 'CARD' then d.watermark_profile is distinct from $3::text
                    else d.watermark_profile is distinct from $4::text
                  end
                )
                or ($5::boolean = true and d.generation_status = 'FAILED')
            )
          order by a.created_at asc, a.id asc
          limit $7
        ),
        shard_assignments as (
          select e.id, s.shard_index
          from eligible e
          join generate_series(0, $8::int - 1) as s(shard_index)
            on mod((('x' || substr(md5(e.id::text), 1, 8))::bit(32)::bigint), $8::bigint) = s.shard_index::bigint
        ),
        per_asset as (
          select e.id, count(sa.shard_index)::int as assignment_count
          from eligible e
          left join shard_assignments sa on sa.id = e.id
          group by e.id
        ),
        per_shard as (
          select
            s.shard_index,
            count(sa.id)::int as selected_count
          from generate_series(0, $8::int - 1) as s(shard_index)
          left join shard_assignments sa on sa.shard_index = s.shard_index
          group by s.shard_index
        )
        select
          (select count(*)::int from eligible) as eligible_count,
          (select count(*)::int from shard_assignments) as assignment_count,
          (select count(distinct id)::int from shard_assignments) as distinct_assigned_count,
          (select min(assignment_count)::int from per_asset) as min_assignments_per_asset,
          (select max(assignment_count)::int from per_asset) as max_assignments_per_asset,
          (select count(*)::int from per_asset where assignment_count > 1) as duplicate_asset_count,
          (select count(*)::int from per_asset where assignment_count = 0) as missing_asset_count,
          (
            select jsonb_agg(
              jsonb_build_object('shardIndex', shard_index, 'selectedCount', selected_count)
              order by shard_index
            )
            from per_shard
          ) as shard_counts
      `,
      [
        ["thumb", "card", "detail"],
        THUMB_LIGHT_PREVIEW_PROFILE,
        CARD_LIGHT_PREVIEW_PROFILE,
        DETAIL_PREVIEW_PROFILE,
        true,
        false,
        limit,
        shardCount,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error("Shard smoke query returned no rows.");

    console.table({
      shardCount,
      boundedEligibleCount: row.eligible_count,
      assignmentCount: row.assignment_count,
      distinctAssignedCount: row.distinct_assigned_count,
      minAssignmentsPerAsset: row.min_assignments_per_asset ?? 0,
      maxAssignmentsPerAsset: row.max_assignments_per_asset ?? 0,
      duplicateAssetCount: row.duplicate_asset_count,
      missingAssetCount: row.missing_asset_count,
    });
    console.table(row.shard_counts);

    const failures: string[] = [];
    if (row.assignment_count !== row.eligible_count) {
      failures.push("combined shard assignment count does not equal unsharded bounded eligible count");
    }
    if (row.distinct_assigned_count !== row.eligible_count) {
      failures.push("combined distinct shard assignment count does not equal unsharded bounded eligible count");
    }
    if (row.eligible_count > 0 && row.min_assignments_per_asset !== 1) {
      failures.push("at least one eligible asset was not assigned to exactly one shard");
    }
    if (row.eligible_count > 0 && row.max_assignments_per_asset !== 1) {
      failures.push("at least one eligible asset appeared in more than one shard");
    }
    if (row.duplicate_asset_count !== 0) {
      failures.push("duplicate asset assignments found across shard selections");
    }
    if (row.missing_asset_count !== 0) {
      failures.push("eligible assets missing from all shard selections");
    }

    if (failures.length > 0) {
      console.error("FAIL derivative shard smoke:");
      for (const failure of failures) console.error(`  - ${failure}`);
      process.exitCode = 1;
      return;
    }

    console.log("PASS derivative shard smoke");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

function parsePositiveInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

await main();
