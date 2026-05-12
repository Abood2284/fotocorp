#!/usr/bin/env node
import dotenv from "dotenv";
import pg from "pg";

type CountRow = {
  total_contributors: string;
  distinct_legacy_photographer_ids: string;
  missing_legacy_photographer_id: string;
};

type AssetCoverageRow = {
  legacy_assets: string;
  legacy_assets_with_legacy_photographer_id: string;
  legacy_assets_with_photographer_profile_id: string;
};

type CountOnlyRow = {
  orphan_current_profile_links: string;
};

type DuplicateRow = {
  legacy_photographer_id: string;
  count: string;
};

type OrphanAssetRow = {
  legacy_photographer_id: string;
  asset_count: string;
};

type StatusRow = {
  status: string;
  count: string;
};

dotenv.config({ path: ".dev.vars" });

const EXPECTED_LEGACY_PHOTOGRAPHERS = 786;
const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("FAIL DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const failures: string[] = [];

try {
  const photographerCounts = await queryOne<CountRow>(`
    select
      count(*) as total_contributors,
      count(distinct legacy_photographer_id) as distinct_legacy_photographer_ids,
      count(*) filter (where legacy_photographer_id is null) as missing_legacy_photographer_id
    from contributors
  `);

  const duplicateRows = await query<DuplicateRow>(`
    select legacy_photographer_id, count(*) as count
    from contributors
    group by legacy_photographer_id
    having count(*) > 1
  `);

  const assetCoverage = await queryOne<AssetCoverageRow>(`
    select
      count(*) filter (where source = 'LEGACY_IMPORT') as legacy_assets,
      count(*) filter (
        where source = 'LEGACY_IMPORT'
          and legacy_photographer_id is not null
      ) as legacy_assets_with_legacy_photographer_id,
      count(*) filter (
        where source = 'LEGACY_IMPORT'
          and photographer_profile_id is not null
      ) as legacy_assets_with_photographer_profile_id
    from assets
  `);

  const orphanAssetRows = await query<OrphanAssetRow>(`
    select
      a.legacy_photographer_id,
      count(*) as asset_count
    from assets a
    left join contributors p
      on p.legacy_photographer_id = a.legacy_photographer_id
    where a.source = 'LEGACY_IMPORT'
      and a.legacy_photographer_id is not null
      and p.id is null
    group by a.legacy_photographer_id
    order by asset_count desc
  `);

  const currentFkOrphans = await queryOne<CountOnlyRow>(`
    select count(*) as orphan_current_profile_links
    from assets a
    left join photographer_profiles pp
      on pp.id = a.photographer_profile_id
    where a.photographer_profile_id is not null
      and pp.id is null
  `);

  const statusDistribution = await query<StatusRow>(`
    select status, count(*) as count
    from contributors
    group by status
    order by count desc
  `);

  const totalPhotographers = toNumber(photographerCounts.total_contributors);
  const distinctLegacyPhotographerIds = toNumber(photographerCounts.distinct_legacy_photographer_ids);
  const missingLegacyPhotographerIds = toNumber(photographerCounts.missing_legacy_photographer_id);
  const legacyAssets = toNumber(assetCoverage.legacy_assets);
  const legacyAssetsWithLegacyPhotographerId = toNumber(assetCoverage.legacy_assets_with_legacy_photographer_id);
  const legacyAssetsWithPhotographerProfileId = toNumber(assetCoverage.legacy_assets_with_photographer_profile_id);
  const orphanCurrentProfileLinks = toNumber(currentFkOrphans.orphan_current_profile_links);

  if (totalPhotographers !== EXPECTED_LEGACY_PHOTOGRAPHERS) {
    failures.push(`expected ${EXPECTED_LEGACY_PHOTOGRAPHERS} contributors, got ${totalPhotographers}`);
  }
  if (distinctLegacyPhotographerIds !== EXPECTED_LEGACY_PHOTOGRAPHERS) {
    failures.push(
      `expected ${EXPECTED_LEGACY_PHOTOGRAPHERS} distinct legacy photographer IDs, got ${distinctLegacyPhotographerIds}`,
    );
  }
  if (missingLegacyPhotographerIds !== 0) {
    failures.push(`expected 0 contributors missing legacy IDs, got ${missingLegacyPhotographerIds}`);
  }
  if (duplicateRows.length !== 0) {
    failures.push(`expected 0 duplicate photographer legacy IDs, got ${duplicateRows.length}`);
  }
  if (legacyAssetsWithLegacyPhotographerId !== legacyAssets) {
    failures.push(
      `expected all ${legacyAssets} legacy assets to have typed legacy photographer IDs, got ${legacyAssetsWithLegacyPhotographerId}`,
    );
  }
  if (legacyAssetsWithPhotographerProfileId !== legacyAssets) {
    failures.push(
      `expected all ${legacyAssets} legacy assets to have current photographer profile FK, got ${legacyAssetsWithPhotographerProfileId}`,
    );
  }
  if (orphanAssetRows.length !== 0) {
    failures.push(`expected 0 orphan asset legacy photographer IDs, got ${orphanAssetRows.length}`);
  }
  if (orphanCurrentProfileLinks !== 0) {
    failures.push(`expected 0 orphan current profile links, got ${orphanCurrentProfileLinks}`);
  }

  console.log("Fotocorp photographer normalization validation");
  console.log("");
  printCheck("clean photographer count", {
    total_contributors: totalPhotographers,
    distinct_legacy_photographer_ids: distinctLegacyPhotographerIds,
    missing_legacy_photographer_id: missingLegacyPhotographerIds,
  });
  printCheck("duplicate contributors", {
    duplicate_legacy_photographer_ids: duplicateRows.length,
  });
  printCheck("legacy asset coverage", {
    legacy_assets: legacyAssets,
    legacy_assets_with_legacy_photographer_id: legacyAssetsWithLegacyPhotographerId,
    legacy_assets_with_photographer_profile_id: legacyAssetsWithPhotographerProfileId,
  });
  printCheck("orphan asset photographer IDs", {
    orphan_legacy_photographer_ids: orphanAssetRows.length,
  });
  printCheck("current FK orphan check", {
    orphan_current_profile_links: orphanCurrentProfileLinks,
  });
  console.log("Status distribution:");
  console.table(statusDistribution.map((row) => ({ status: row.status, count: toNumber(row.count) })));

  if (failures.length > 0) {
    console.error("FAIL photographer normalization validation failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log("PASS photographer normalization validation passed.");
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
