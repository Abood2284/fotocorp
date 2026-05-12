#!/usr/bin/env node
import dotenv from "dotenv";
import pg from "pg";

type EventParityRow = {
  old_asset_events: string;
  new_photo_events: string;
};

type AssetParityRow = {
  old_assets: string;
  new_image_assets: string;
};

type PreservedImageIdsRow = {
  missing_preserved_image_asset_ids: string;
};

type PreservedEventIdsRow = {
  missing_preserved_photo_event_ids: string;
};

type PhotographerCoverageRow = {
  legacy_image_assets: string;
  with_legacy_photographer_id: string;
  with_contributor_id: string;
};

type EventCoverageRow = {
  old_assets_with_event_id: string;
  new_image_assets_with_event_id: string;
};

type OrphanEventRow = {
  orphan_event_links: string;
};

type OrphanPhotographerRow = {
  legacy_photographer_id: string | null;
  image_count: string;
};

type DuplicateLegacyAssetRow = {
  legacy_source: string;
  legacy_asset_id: string;
  count: string;
};

type DistributionRow = {
  value: string;
  count: string;
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
  const eventParity = await queryOne<EventParityRow>(`
    select
      (select count(*) from asset_events) as old_asset_events,
      (select count(*) from photo_events) as new_photo_events
  `);

  const assetParity = await queryOne<AssetParityRow>(`
    select
      (select count(*) from assets) as old_assets,
      (select count(*) from image_assets) as new_image_assets
  `);

  const preservedImageIds = await queryOne<PreservedImageIdsRow>(`
    select count(*) as missing_preserved_image_asset_ids
    from assets a
    left join image_assets ia on ia.id = a.id
    where ia.id is null
  `);

  const preservedEventIds = await queryOne<PreservedEventIdsRow>(`
    select count(*) as missing_preserved_photo_event_ids
    from asset_events ae
    left join photo_events pe on pe.id = ae.id
    where pe.id is null
  `);

  const photographerCoverage = await queryOne<PhotographerCoverageRow>(`
    select
      count(*) filter (where source = 'LEGACY_IMPORT') as legacy_image_assets,
      count(*) filter (
        where source = 'LEGACY_IMPORT'
          and legacy_photographer_id is not null
      ) as with_legacy_photographer_id,
      count(*) filter (
        where source = 'LEGACY_IMPORT'
          and contributor_id is not null
      ) as with_contributor_id
    from image_assets
  `);

  const orphanPhotographerLinks = await query<OrphanPhotographerRow>(`
    select
      ia.legacy_photographer_id,
      count(*) as image_count
    from image_assets ia
    left join contributors p
      on p.id = ia.contributor_id
    where ia.source = 'LEGACY_IMPORT'
      and ia.contributor_id is not null
      and p.id is null
    group by ia.legacy_photographer_id
    order by image_count desc
  `);

  const orphanLegacyPhotographerIds = await query<OrphanPhotographerRow>(`
    select
      ia.legacy_photographer_id,
      count(*) as image_count
    from image_assets ia
    left join contributors p
      on p.legacy_photographer_id = ia.legacy_photographer_id
    where ia.source = 'LEGACY_IMPORT'
      and ia.legacy_photographer_id is not null
      and p.id is null
    group by ia.legacy_photographer_id
    order by image_count desc
  `);

  const eventCoverage = await queryOne<EventCoverageRow>(`
    select
      count(*) filter (where a.event_id is not null) as old_assets_with_event_id,
      count(*) filter (where ia.event_id is not null) as new_image_assets_with_event_id
    from assets a
    join image_assets ia on ia.id = a.id
  `);

  const orphanEventLinks = await queryOne<OrphanEventRow>(`
    select count(*) as orphan_event_links
    from image_assets ia
    left join photo_events pe on pe.id = ia.event_id
    where ia.event_id is not null
      and pe.id is null
  `);

  const duplicateLegacyAssets = await query<DuplicateLegacyAssetRow>(`
    select legacy_source, legacy_asset_id, count(*) as count
    from image_assets
    where legacy_source is not null
      and legacy_asset_id is not null
    group by legacy_source, legacy_asset_id
    having count(*) > 1
  `);

  const imageStatusDistribution = await query<DistributionRow>(`
    select status as value, count(*) as count
    from image_assets
    group by status
    order by count desc
  `);

  const imageVisibilityDistribution = await query<DistributionRow>(`
    select visibility as value, count(*) as count
    from image_assets
    group by visibility
    order by count desc
  `);

  const eventStatusDistribution = await query<DistributionRow>(`
    select status as value, count(*) as count
    from photo_events
    group by status
    order by count desc
  `);

  const oldAssetEvents = toNumber(eventParity.old_asset_events);
  const newPhotoEvents = toNumber(eventParity.new_photo_events);
  const oldAssets = toNumber(assetParity.old_assets);
  const newImageAssets = toNumber(assetParity.new_image_assets);
  const missingPreservedImageAssetIds = toNumber(preservedImageIds.missing_preserved_image_asset_ids);
  const missingPreservedPhotoEventIds = toNumber(preservedEventIds.missing_preserved_photo_event_ids);
  const legacyImageAssets = toNumber(photographerCoverage.legacy_image_assets);
  const withLegacyPhotographerId = toNumber(photographerCoverage.with_legacy_photographer_id);
  const withPhotographerId = toNumber(photographerCoverage.with_contributor_id);
  const oldAssetsWithEventId = toNumber(eventCoverage.old_assets_with_event_id);
  const newImageAssetsWithEventId = toNumber(eventCoverage.new_image_assets_with_event_id);
  const orphanEventLinkCount = toNumber(orphanEventLinks.orphan_event_links);

  if (oldAssetEvents !== newPhotoEvents) {
    failures.push(`expected photo_events count ${oldAssetEvents}, got ${newPhotoEvents}`);
  }
  if (oldAssets !== newImageAssets) {
    failures.push(`expected image_assets count ${oldAssets}, got ${newImageAssets}`);
  }
  if (missingPreservedImageAssetIds !== 0) {
    failures.push(`expected 0 missing preserved image asset ids, got ${missingPreservedImageAssetIds}`);
  }
  if (missingPreservedPhotoEventIds !== 0) {
    failures.push(`expected 0 missing preserved photo event ids, got ${missingPreservedPhotoEventIds}`);
  }
  if (withLegacyPhotographerId !== legacyImageAssets) {
    failures.push(`expected all ${legacyImageAssets} legacy image assets to have legacy photographer IDs, got ${withLegacyPhotographerId}`);
  }
  if (withPhotographerId !== legacyImageAssets) {
    failures.push(`expected all ${legacyImageAssets} legacy image assets to have photographer IDs, got ${withPhotographerId}`);
  }
  if (orphanPhotographerLinks.length !== 0) {
    failures.push(`expected 0 orphan photographer links, got ${orphanPhotographerLinks.length}`);
  }
  if (orphanLegacyPhotographerIds.length !== 0) {
    failures.push(`expected 0 orphan legacy photographer IDs, got ${orphanLegacyPhotographerIds.length}`);
  }
  if (oldAssetsWithEventId !== newImageAssetsWithEventId) {
    failures.push(`expected event link coverage ${oldAssetsWithEventId}, got ${newImageAssetsWithEventId}`);
  }
  if (orphanEventLinkCount !== 0) {
    failures.push(`expected 0 orphan event links, got ${orphanEventLinkCount}`);
  }
  if (duplicateLegacyAssets.length !== 0) {
    failures.push(`expected 0 duplicate legacy source/asset ID rows, got ${duplicateLegacyAssets.length}`);
  }

  console.log("Fotocorp image asset normalization validation");
  console.log("");
  printCheck("event count parity", { old_asset_events: oldAssetEvents, new_photo_events: newPhotoEvents });
  printCheck("image asset count parity", { old_assets: oldAssets, new_image_assets: newImageAssets });
  printCheck("preserved UUIDs", {
    missing_preserved_image_asset_ids: missingPreservedImageAssetIds,
    missing_preserved_photo_event_ids: missingPreservedPhotoEventIds,
  });
  printCheck("photographer link coverage", {
    legacy_image_assets: legacyImageAssets,
    with_legacy_photographer_id: withLegacyPhotographerId,
    with_contributor_id: withPhotographerId,
  });
  printCheck("orphan photographer checks", {
    orphan_photographer_links: orphanPhotographerLinks.length,
    orphan_legacy_photographer_ids: orphanLegacyPhotographerIds.length,
  });
  printCheck("event link coverage", {
    old_assets_with_event_id: oldAssetsWithEventId,
    new_image_assets_with_event_id: newImageAssetsWithEventId,
    orphan_event_links: orphanEventLinkCount,
  });
  printCheck("duplicate legacy asset check", {
    duplicate_legacy_source_asset_id_rows: duplicateLegacyAssets.length,
  });

  console.log("Image asset status distribution:");
  console.table(distributionForPrint(imageStatusDistribution));
  console.log("Image asset visibility distribution:");
  console.table(distributionForPrint(imageVisibilityDistribution));
  console.log("Photo event status distribution:");
  console.table(distributionForPrint(eventStatusDistribution));

  if (failures.length > 0) {
    console.error("FAIL image asset normalization validation failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log("PASS image asset normalization validation passed.");
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
