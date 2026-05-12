#!/usr/bin/env node
import dotenv from "dotenv";
import pg from "pg";

type CleanAssetCountRow = {
  clean_image_assets: string;
};

type JoinCoverageRow = {
  total: string;
  with_photographer: string;
  with_event: string;
};

type VariantDistributionRow = {
  variant: string;
  count: string;
};

type MissingDerivativeCoverageRow = {
  missing_card: string;
  missing_detail: string;
  missing_thumb: string;
};

type LogCountRow = {
  old_access_logs: string;
  new_access_logs: string;
  old_download_logs: string;
  new_download_logs: string;
};

dotenv.config({ path: ".dev.vars" });

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("FAIL DATABASE_URL is required.");
  process.exit(1);
}

const EXPECTED_IMAGE_ASSETS = 9_993;
const EXPECTED_DERIVATIVE_COUNT = 9_616;
const EXPECTED_VARIANTS = new Map([
  ["CARD", EXPECTED_DERIVATIVE_COUNT],
  ["DETAIL", EXPECTED_DERIVATIVE_COUNT],
  ["THUMB", EXPECTED_DERIVATIVE_COUNT],
]);

const pool = new Pool({ connectionString: databaseUrl });
const failures: string[] = [];

try {
  const cleanAssetCount = await queryOne<CleanAssetCountRow>(`
    select count(*) as clean_image_assets from image_assets
  `);

  const joinCoverage = await queryOne<JoinCoverageRow>(`
    select
      count(*) as total,
      count(*) filter (where p.id is not null) as with_photographer,
      count(*) filter (where pe.id is not null) as with_event
    from image_assets ia
    left join contributors p on p.id = ia.contributor_id
    left join photo_events pe on pe.id = ia.event_id
    where ia.source = 'LEGACY_IMPORT'
  `);

  const derivativeDistribution = await query<VariantDistributionRow>(`
    select
      variant,
      count(*) as count
    from image_derivatives
    group by variant
    order by variant
  `);

  const missingDerivativeCoverage = await queryOne<MissingDerivativeCoverageRow>(`
    select
      count(*) filter (where card.id is null) as missing_card,
      count(*) filter (where detail.id is null) as missing_detail,
      count(*) filter (where thumb.id is null) as missing_thumb
    from image_assets ia
    left join image_derivatives card
      on card.image_asset_id = ia.id and card.variant = 'CARD'
    left join image_derivatives detail
      on detail.image_asset_id = ia.id and detail.variant = 'DETAIL'
    left join image_derivatives thumb
      on thumb.image_asset_id = ia.id and thumb.variant = 'THUMB'
  `);

  const logCounts = await queryOne<LogCountRow>(`
    select
      (select count(*) from asset_media_access_logs) as old_access_logs,
      (select count(*) from image_access_logs) as new_access_logs,
      (select count(*) from asset_download_logs) as old_download_logs,
      (select count(*) from image_download_logs) as new_download_logs
  `);

  const cleanImageAssets = toNumber(cleanAssetCount.clean_image_assets);
  const total = toNumber(joinCoverage.total);
  const withPhotographer = toNumber(joinCoverage.with_photographer);
  const withEvent = toNumber(joinCoverage.with_event);

  if (cleanImageAssets !== EXPECTED_IMAGE_ASSETS) {
    failures.push(`expected ${EXPECTED_IMAGE_ASSETS} image_assets rows, got ${cleanImageAssets}`);
  }
  if (total !== EXPECTED_IMAGE_ASSETS) {
    failures.push(`expected ${EXPECTED_IMAGE_ASSETS} legacy image assets, got ${total}`);
  }
  if (withPhotographer !== EXPECTED_IMAGE_ASSETS) {
    failures.push(`expected ${EXPECTED_IMAGE_ASSETS} legacy image assets with contributors, got ${withPhotographer}`);
  }
  if (withEvent !== EXPECTED_IMAGE_ASSETS) {
    failures.push(`expected ${EXPECTED_IMAGE_ASSETS} legacy image assets with events, got ${withEvent}`);
  }

  const distributionByVariant = new Map(
    derivativeDistribution.map((row) => [row.variant, toNumber(row.count)]),
  );
  for (const [variant, expectedCount] of EXPECTED_VARIANTS) {
    const actualCount = distributionByVariant.get(variant) ?? 0;
    if (actualCount !== expectedCount) {
      failures.push(`expected ${variant} derivative count ${expectedCount}, got ${actualCount}`);
    }
  }
  for (const variant of distributionByVariant.keys()) {
    if (!EXPECTED_VARIANTS.has(variant)) {
      failures.push(`unexpected derivative variant ${variant}`);
    }
  }

  console.log("Fotocorp clean runtime route smoke checks");
  console.log("");
  printCheck("clean catalog rows", {
    clean_image_assets: cleanImageAssets,
  });
  printCheck("search/detail clean joins", {
    total,
    with_photographer: withPhotographer,
    with_event: withEvent,
  });
  console.log("Derivative distribution:");
  console.table(derivativeDistribution.map((row) => ({ variant: row.variant, count: toNumber(row.count) })));
  printCheck("Missing derivative coverage (informational)", {
    missing_card: toNumber(missingDerivativeCoverage.missing_card),
    missing_detail: toNumber(missingDerivativeCoverage.missing_detail),
    missing_thumb: toNumber(missingDerivativeCoverage.missing_thumb),
  });
  printCheck("Current old/new log counts before manual runtime requests", {
    old_access_logs: toNumber(logCounts.old_access_logs),
    new_access_logs: toNumber(logCounts.new_access_logs),
    old_download_logs: toNumber(logCounts.old_download_logs),
    new_download_logs: toNumber(logCounts.new_download_logs),
  });

  console.log("Manual runtime log smoke instructions:");
  console.log("- Before and after a media preview request, compare asset_media_access_logs and image_access_logs counts; only image_access_logs should increase.");
  console.log("- Before and after a subscriber download request, compare asset_download_logs and image_download_logs counts; only image_download_logs should increase.");

  if (failures.length > 0) {
    console.error("FAIL clean runtime route smoke checks failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log("PASS clean runtime route smoke checks passed.");
  }
} finally {
  await pool.end();
}

async function query<T extends pg.QueryResultRow>(sql: string): Promise<T[]> {
  const result = await pool.query<T>(sql);
  return result.rows;
}

async function queryOne<T extends pg.QueryResultRow>(sql: string): Promise<T> {
  const rows = await query<T>(sql);
  const [row] = rows;
  if (!row) {
    throw new Error("Expected query to return one row.");
  }
  return row;
}

function printCheck(name: string, values: Record<string, number>): void {
  console.log(`${name}:`);
  console.table([values]);
}

function toNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected numeric database value, got ${value}`);
  }
  return parsed;
}
