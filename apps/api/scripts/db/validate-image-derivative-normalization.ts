#!/usr/bin/env node
import dotenv from "dotenv";
import pg from "pg";

type CountParityRow = {
  old_derivatives: string;
  new_derivatives: string;
};

type PreservedIdsRow = {
  missing_preserved_derivative_ids: string;
};

type MissingImageAssetRow = {
  derivative_rows_with_missing_image_asset: string;
};

type OldMissingImageAssetRow = {
  old_derivatives_with_missing_image_asset: string;
};

type DuplicateDerivativeRow = {
  image_asset_id: string;
  variant: string;
  count: string;
};

type UnknownVariantRow = {
  variant: string;
  count: string;
};

type DistributionRow = {
  value: string;
  count: string;
};

type MissingStorageKeyRow = {
  missing_storage_key_count: string;
};

type MissingMimeTypeRow = {
  missing_mime_type_count: string;
};

dotenv.config({ path: ".dev.vars" });

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("FAIL DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const failures: string[] = [];

try {
  const countParity = await queryOne<CountParityRow>(`
    select
      (select count(*) from asset_media_derivatives) as old_derivatives,
      (select count(*) from image_derivatives) as new_derivatives
  `);

  const preservedIds = await queryOne<PreservedIdsRow>(`
    select count(*) as missing_preserved_derivative_ids
    from asset_media_derivatives old
    left join image_derivatives clean
      on clean.id = old.id
    where clean.id is null
  `);

  const missingImageAssets = await queryOne<MissingImageAssetRow>(`
    select count(*) as derivative_rows_with_missing_image_asset
    from image_derivatives d
    left join image_assets ia
      on ia.id = d.image_asset_id
    where ia.id is null
  `);

  const oldMissingImageAssets = await queryOne<OldMissingImageAssetRow>(`
    select count(*) as old_derivatives_with_missing_image_asset
    from asset_media_derivatives old
    left join image_assets ia
      on ia.id = old.asset_id
    where ia.id is null
  `);

  const duplicatePairs = await query<DuplicateDerivativeRow>(`
    select image_asset_id, variant, count(*) as count
    from image_derivatives
    group by image_asset_id, variant
    having count(*) > 1
  `);

  const unknownVariants = await query<UnknownVariantRow>(`
    select variant, count(*) as count
    from asset_media_derivatives
    where variant not in ('thumb', 'card', 'detail')
    group by variant
    order by count desc
  `);

  const variantDistribution = await query<DistributionRow>(`
    select variant as value, count(*) as count
    from image_derivatives
    group by variant
    order by variant
  `);

  const statusDistribution = await query<DistributionRow>(`
    select generation_status as value, count(*) as count
    from image_derivatives
    group by generation_status
    order by count desc
  `);

  const missingStorageKeys = await queryOne<MissingStorageKeyRow>(`
    select count(*) as missing_storage_key_count
    from image_derivatives
    where storage_key is null
       or btrim(storage_key) = ''
  `);

  const missingMimeTypes = await queryOne<MissingMimeTypeRow>(`
    select count(*) as missing_mime_type_count
    from image_derivatives
    where mime_type is null
       or btrim(mime_type) = ''
  `);

  const oldDerivatives = toNumber(countParity.old_derivatives);
  const newDerivatives = toNumber(countParity.new_derivatives);
  const missingPreservedDerivativeIds = toNumber(preservedIds.missing_preserved_derivative_ids);
  const derivativeRowsWithMissingImageAsset = toNumber(missingImageAssets.derivative_rows_with_missing_image_asset);
  const oldDerivativesWithMissingImageAsset = toNumber(oldMissingImageAssets.old_derivatives_with_missing_image_asset);
  const missingStorageKeyCount = toNumber(missingStorageKeys.missing_storage_key_count);
  const missingMimeTypeCount = toNumber(missingMimeTypes.missing_mime_type_count);

  if (oldDerivatives !== newDerivatives) {
    failures.push(`expected image_derivatives count ${oldDerivatives}, got ${newDerivatives}`);
  }
  if (missingPreservedDerivativeIds !== 0) {
    failures.push(`expected 0 missing preserved derivative IDs, got ${missingPreservedDerivativeIds}`);
  }
  if (derivativeRowsWithMissingImageAsset !== 0) {
    failures.push(`expected 0 clean derivative rows missing image asset, got ${derivativeRowsWithMissingImageAsset}`);
  }
  if (oldDerivativesWithMissingImageAsset !== 0) {
    failures.push(`expected 0 old derivative rows missing image asset, got ${oldDerivativesWithMissingImageAsset}`);
  }
  if (duplicatePairs.length !== 0) {
    failures.push(`expected 0 duplicate image asset/variant pairs, got ${duplicatePairs.length}`);
  }
  if (unknownVariants.length !== 0) {
    failures.push(`expected 0 unknown old variants, got ${unknownVariants.length}`);
  }
  if (missingStorageKeyCount !== 0) {
    failures.push(`expected 0 missing storage keys, got ${missingStorageKeyCount}`);
  }
  if (missingMimeTypeCount !== 0) {
    failures.push(`expected 0 missing MIME types, got ${missingMimeTypeCount}`);
  }

  console.log("Fotocorp image derivative normalization validation");
  console.log("");
  printCheck("count parity", { old_derivatives: oldDerivatives, new_derivatives: newDerivatives });
  printCheck("preserved derivative IDs", { missing_preserved_derivative_ids: missingPreservedDerivativeIds });
  printCheck("image asset FK coverage", {
    derivative_rows_with_missing_image_asset: derivativeRowsWithMissingImageAsset,
    old_derivatives_with_missing_image_asset: oldDerivativesWithMissingImageAsset,
  });
  printCheck("duplicate image asset/variant pairs", { duplicate_image_asset_variant_pairs: duplicatePairs.length });
  printCheck("unknown old variants", { unknown_old_variants: unknownVariants.length });
  printCheck("required storage fields", {
    missing_storage_key_count: missingStorageKeyCount,
    missing_mime_type_count: missingMimeTypeCount,
  });

  console.log("Variant distribution:");
  console.table(distributionForPrint(variantDistribution));
  console.log("Generation status distribution:");
  console.table(distributionForPrint(statusDistribution));

  if (failures.length > 0) {
    console.error("FAIL image derivative normalization validation failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log("PASS image derivative normalization validation passed.");
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

function distributionForPrint(rows: DistributionRow[]): Array<{ value: string; count: number }> {
  return rows.map((row) => ({ value: row.value, count: toNumber(row.count) }));
}

function toNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected numeric database value, got ${value}`);
  }
  return parsed;
}
