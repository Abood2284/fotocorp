#!/usr/bin/env node
import dotenv from "dotenv";
import pg from "pg";

type AccessCountParityRow = {
  old_media_access_logs: string;
  new_image_access_logs: string;
};

type AccessPreservedIdsRow = {
  missing_preserved_access_log_ids: string;
};

type AccessMissingAssetRow = {
  image_access_logs_with_missing_image_asset: string;
};

type AccessMissingDerivativeRow = {
  image_access_logs_with_missing_image_derivative: string;
};

type VariantRow = {
  variant: string;
  count: string;
};

type OutcomeRow = {
  outcome: string;
  count: string;
};

type DownloadCountParityRow = {
  old_download_logs: string;
  new_image_download_logs: string;
};

type DownloadPreservedIdsRow = {
  missing_preserved_download_log_ids: string;
};

type DownloadMissingAssetRow = {
  image_download_logs_with_missing_image_asset: string;
};

type DownloadSizeRow = {
  download_size: string;
  count: string;
};

type DownloadStatusRow = {
  download_status: string;
  count: string;
};

type MissingAuthUserRow = {
  missing_auth_user_id_count: string;
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
  const accessParity = await queryOne<AccessCountParityRow>(`
    select
      (select count(*) from asset_media_access_logs) as old_media_access_logs,
      (select count(*) from image_access_logs) as new_image_access_logs
  `);

  const accessPreservedIds = await queryOne<AccessPreservedIdsRow>(`
    select count(*) as missing_preserved_access_log_ids
    from asset_media_access_logs old
    left join image_access_logs clean
      on clean.id = old.id
    where clean.id is null
  `);

  const accessMissingAssets = await queryOne<AccessMissingAssetRow>(`
    select count(*) as image_access_logs_with_missing_image_asset
    from image_access_logs l
    left join image_assets ia
      on ia.id = l.image_asset_id
    where l.image_asset_id is not null
      and ia.id is null
  `);

  const accessMissingDerivatives = await queryOne<AccessMissingDerivativeRow>(`
    select count(*) as image_access_logs_with_missing_image_derivative
    from image_access_logs l
    left join image_derivatives d
      on d.id = l.image_derivative_id
    where l.image_derivative_id is not null
      and d.id is null
  `);

  const unknownOldAccessVariants = await query<VariantRow>(`
    select variant, count(*) as count
    from asset_media_access_logs
    where variant is not null
      and variant not in ('thumb', 'card', 'detail', 'THUMB', 'CARD', 'DETAIL')
    group by variant
    order by count desc
  `);

  const unknownNewAccessVariants = await query<VariantRow>(`
    select variant, count(*) as count
    from image_access_logs
    where variant is not null
      and variant not in ('THUMB', 'CARD', 'DETAIL')
    group by variant
    order by count desc
  `);

  const accessOutcomeDistribution = await query<OutcomeRow>(`
    select outcome, count(*) as count
    from image_access_logs
    group by outcome
    order by count desc
  `);

  const downloadParity = await queryOne<DownloadCountParityRow>(`
    select
      (select count(*) from asset_download_logs) as old_download_logs,
      (select count(*) from image_download_logs) as new_image_download_logs
  `);

  const downloadPreservedIds = await queryOne<DownloadPreservedIdsRow>(`
    select count(*) as missing_preserved_download_log_ids
    from asset_download_logs old
    left join image_download_logs clean
      on clean.id = old.id
    where clean.id is null
  `);

  const downloadMissingAssets = await queryOne<DownloadMissingAssetRow>(`
    select count(*) as image_download_logs_with_missing_image_asset
    from image_download_logs l
    left join image_assets ia
      on ia.id = l.image_asset_id
    where l.image_asset_id is not null
      and ia.id is null
  `);

  const unknownOldDownloadSizes = await query<DownloadSizeRow>(`
    select download_size, count(*) as count
    from asset_download_logs
    where upper(download_size) not in ('WEB', 'MEDIUM', 'LARGE')
    group by download_size
    order by count desc
  `);

  const unknownOldDownloadStatuses = await query<DownloadStatusRow>(`
    select download_status, count(*) as count
    from asset_download_logs
    where upper(download_status) not in ('STARTED', 'COMPLETED', 'FAILED')
    group by download_status
    order by count desc
  `);

  const downloadSizeDistribution = await query<DownloadSizeRow>(`
    select download_size, count(*) as count
    from image_download_logs
    group by download_size
    order by download_size
  `);

  const downloadStatusDistribution = await query<DownloadStatusRow>(`
    select download_status, count(*) as count
    from image_download_logs
    group by download_status
    order by download_status
  `);

  const missingAuthUsers = await queryOne<MissingAuthUserRow>(`
    select count(*) as missing_auth_user_id_count
    from image_download_logs
    where auth_user_id is null
       or btrim(auth_user_id) = ''
  `);

  const oldMediaAccessLogs = toNumber(accessParity.old_media_access_logs);
  const newImageAccessLogs = toNumber(accessParity.new_image_access_logs);
  const missingPreservedAccessLogIds = toNumber(accessPreservedIds.missing_preserved_access_log_ids);
  const accessLogsWithMissingImageAsset = toNumber(accessMissingAssets.image_access_logs_with_missing_image_asset);
  const accessLogsWithMissingImageDerivative = toNumber(accessMissingDerivatives.image_access_logs_with_missing_image_derivative);
  const oldDownloadLogs = toNumber(downloadParity.old_download_logs);
  const newImageDownloadLogs = toNumber(downloadParity.new_image_download_logs);
  const missingPreservedDownloadLogIds = toNumber(downloadPreservedIds.missing_preserved_download_log_ids);
  const downloadLogsWithMissingImageAsset = toNumber(downloadMissingAssets.image_download_logs_with_missing_image_asset);
  const missingAuthUserIdCount = toNumber(missingAuthUsers.missing_auth_user_id_count);

  if (oldMediaAccessLogs !== newImageAccessLogs) {
    failures.push(`expected image_access_logs count ${oldMediaAccessLogs}, got ${newImageAccessLogs}`);
  }
  if (missingPreservedAccessLogIds !== 0) {
    failures.push(`expected 0 missing preserved access log IDs, got ${missingPreservedAccessLogIds}`);
  }
  if (accessLogsWithMissingImageAsset !== 0) {
    failures.push(`expected 0 image access logs missing image asset, got ${accessLogsWithMissingImageAsset}`);
  }
  if (accessLogsWithMissingImageDerivative !== 0) {
    failures.push(`expected 0 image access logs missing image derivative, got ${accessLogsWithMissingImageDerivative}`);
  }
  if (unknownOldAccessVariants.length !== 0) {
    failures.push(`expected 0 unknown old access variants, got ${unknownOldAccessVariants.length}`);
  }
  if (unknownNewAccessVariants.length !== 0) {
    failures.push(`expected 0 unknown new access variants, got ${unknownNewAccessVariants.length}`);
  }
  if (oldDownloadLogs !== newImageDownloadLogs) {
    failures.push(`expected image_download_logs count ${oldDownloadLogs}, got ${newImageDownloadLogs}`);
  }
  if (missingPreservedDownloadLogIds !== 0) {
    failures.push(`expected 0 missing preserved download log IDs, got ${missingPreservedDownloadLogIds}`);
  }
  if (downloadLogsWithMissingImageAsset !== 0) {
    failures.push(`expected 0 image download logs missing image asset, got ${downloadLogsWithMissingImageAsset}`);
  }
  if (unknownOldDownloadSizes.length !== 0) {
    failures.push(`expected 0 unknown old download sizes, got ${unknownOldDownloadSizes.length}`);
  }
  if (unknownOldDownloadStatuses.length !== 0) {
    failures.push(`expected 0 unknown old download statuses, got ${unknownOldDownloadStatuses.length}`);
  }
  if (missingAuthUserIdCount !== 0) {
    failures.push(`expected 0 missing auth user IDs, got ${missingAuthUserIdCount}`);
  }

  console.log("Fotocorp image log normalization validation");
  console.log("");
  printCheck("media access log count parity", {
    old_media_access_logs: oldMediaAccessLogs,
    new_image_access_logs: newImageAccessLogs,
  });
  printCheck("media access log preserved IDs", {
    missing_preserved_access_log_ids: missingPreservedAccessLogIds,
  });
  printCheck("media access log FK checks", {
    image_access_logs_with_missing_image_asset: accessLogsWithMissingImageAsset,
    image_access_logs_with_missing_image_derivative: accessLogsWithMissingImageDerivative,
  });
  printCheck("media access variant checks", {
    unknown_old_access_variants: unknownOldAccessVariants.length,
    unknown_new_access_variants: unknownNewAccessVariants.length,
  });
  console.log("Media access outcome distribution:");
  console.table(accessOutcomeDistribution.map((row) => ({ outcome: row.outcome, count: toNumber(row.count) })));

  printCheck("download log count parity", {
    old_download_logs: oldDownloadLogs,
    new_image_download_logs: newImageDownloadLogs,
  });
  printCheck("download log preserved IDs", {
    missing_preserved_download_log_ids: missingPreservedDownloadLogIds,
  });
  printCheck("download log FK/auth checks", {
    image_download_logs_with_missing_image_asset: downloadLogsWithMissingImageAsset,
    missing_auth_user_id_count: missingAuthUserIdCount,
  });
  printCheck("download normalization checks", {
    unknown_old_download_sizes: unknownOldDownloadSizes.length,
    unknown_old_download_statuses: unknownOldDownloadStatuses.length,
  });
  console.log("Download size distribution:");
  console.table(downloadSizeDistribution.map((row) => ({ download_size: row.download_size, count: toNumber(row.count) })));
  console.log("Download status distribution:");
  console.table(downloadStatusDistribution.map((row) => ({ download_status: row.download_status, count: toNumber(row.count) })));

  if (failures.length > 0) {
    console.error("FAIL image log normalization validation failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log("PASS image log normalization validation passed.");
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
