#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

type AdminJoinHealthRow = {
  total: string;
  with_photographer: string;
  with_event: string;
};

type DerivativeJoinHealthRow = {
  with_card: string;
  with_detail: string;
  with_thumb: string;
};

type DistributionRow = {
  value: string;
  count: string;
};

type OrphanRow = {
  derivative_orphans: string;
};

dotenv.config({ path: ".dev.vars" });

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("FAIL DATABASE_URL is required.");
  process.exit(1);
}

const EXPECTED_IMAGE_ASSETS = 9_993;
const EXPECTED_LINKED_IMAGES = 9_993;
const ALLOWED_STATUSES = new Set(["DRAFT", "ACTIVE", "ARCHIVED", "DELETED", "MISSING_ORIGINAL", "UNKNOWN"]);
const ALLOWED_VISIBILITIES = new Set(["PUBLIC", "PRIVATE", "UNLISTED"]);
const OLD_ADMIN_TABLE_PATTERNS = [
  /\bfrom\s+assets\b/i,
  /\bupdate\s+assets\b/i,
  /\bjoin\s+asset_events\b/i,
  /\bfrom\s+asset_events\b/i,
  /\bjoin\s+photographer_profiles\b/i,
  /\bfrom\s+photographer_profiles\b/i,
  /\basset_media_derivatives\b/i,
  /\bassetEvents\b/,
  /\bphotographerProfiles\b/,
  /\bassetMediaDerivatives\b/,
  /\bassetMediaAccessLogs\b/,
  /\bassetDownloadLogs\b/,
];

const pool = new Pool({ connectionString: databaseUrl });
const failures: string[] = [];

try {
  const joinHealth = await queryOne<AdminJoinHealthRow>(`
    select
      count(*) as total,
      count(*) filter (where p.id is not null) as with_photographer,
      count(*) filter (where pe.id is not null) as with_event
    from image_assets ia
    left join contributors p on p.id = ia.contributor_id
    left join photo_events pe on pe.id = ia.event_id
  `);

  const derivativeHealth = await queryOne<DerivativeJoinHealthRow>(`
    select
      count(*) filter (where card.id is not null) as with_card,
      count(*) filter (where detail.id is not null) as with_detail,
      count(*) filter (where thumb.id is not null) as with_thumb
    from image_assets ia
    left join image_derivatives card
      on card.image_asset_id = ia.id and card.variant = 'CARD'
    left join image_derivatives detail
      on detail.image_asset_id = ia.id and detail.variant = 'DETAIL'
    left join image_derivatives thumb
      on thumb.image_asset_id = ia.id and thumb.variant = 'THUMB'
  `);

  const statusDistribution = await query<DistributionRow>(`
    select status as value, count(*) as count
    from image_assets
    group by status
    order by count desc
  `);

  const visibilityDistribution = await query<DistributionRow>(`
    select visibility as value, count(*) as count
    from image_assets
    group by visibility
    order by count desc
  `);

  const orphanCheck = await queryOne<OrphanRow>(`
    select count(*) as derivative_orphans
    from image_derivatives d
    left join image_assets ia on ia.id = d.image_asset_id
    where ia.id is null
  `);

  const staticMatches = scanAdminOldTableReferences();

  const total = toNumber(joinHealth.total);
  const withPhotographer = toNumber(joinHealth.with_photographer);
  const withEvent = toNumber(joinHealth.with_event);
  const derivativeOrphans = toNumber(orphanCheck.derivative_orphans);

  if (total !== EXPECTED_IMAGE_ASSETS) {
    failures.push(`expected ${EXPECTED_IMAGE_ASSETS} image_assets rows, got ${total}`);
  }
  if (withPhotographer !== EXPECTED_LINKED_IMAGES) {
    failures.push(`expected ${EXPECTED_LINKED_IMAGES} image_assets rows with contributors, got ${withPhotographer}`);
  }
  if (withEvent !== EXPECTED_LINKED_IMAGES) {
    failures.push(`expected ${EXPECTED_LINKED_IMAGES} image_assets rows with events, got ${withEvent}`);
  }
  for (const row of statusDistribution) {
    if (!ALLOWED_STATUSES.has(row.value)) {
      failures.push(`unexpected image_assets status ${row.value}`);
    }
  }
  for (const row of visibilityDistribution) {
    if (!ALLOWED_VISIBILITIES.has(row.value)) {
      failures.push(`unexpected image_assets visibility ${row.value}`);
    }
  }
  if (derivativeOrphans !== 0) {
    failures.push(`expected 0 clean derivative orphans, got ${derivativeOrphans}`);
  }
  if (staticMatches.length !== 0) {
    failures.push(`expected 0 old admin table references in admin runtime files, got ${staticMatches.length}`);
  }

  console.log("Fotocorp clean admin catalog smoke checks");
  console.log("");
  printCheck("admin list join health", {
    total,
    with_photographer: withPhotographer,
    with_event: withEvent,
  });
  printCheck("derivative join health (informational)", {
    with_card: toNumber(derivativeHealth.with_card),
    with_detail: toNumber(derivativeHealth.with_detail),
    with_thumb: toNumber(derivativeHealth.with_thumb),
  });
  console.log("Admin mutable status distribution:");
  console.table(statusDistribution.map((row) => ({ status: row.value, count: toNumber(row.count) })));
  console.log("Admin mutable visibility distribution:");
  console.table(visibilityDistribution.map((row) => ({ visibility: row.value, count: toNumber(row.count) })));
  printCheck("clean derivative orphan check", {
    derivative_orphans: derivativeOrphans,
  });
  printCheck("old admin runtime table reference scan", {
    old_admin_runtime_references: staticMatches.length,
  });

  if (staticMatches.length > 0) {
    console.log("Static old-table matches:");
    for (const match of staticMatches) {
      console.log(`- ${match}`);
    }
  }

  if (failures.length > 0) {
    console.error("FAIL clean admin catalog smoke checks failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log("PASS clean admin catalog smoke checks passed.");
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

function scanAdminOldTableReferences(): string[] {
  const apiRoot = fs.existsSync(path.resolve("src")) ? process.cwd() : path.resolve("apps/api");
  const files = [
    "src/lib/assets/admin-catalog.ts",
    "src/routes/internal/admin/service.ts",
    "src/routes/internal/admin/route.ts",
  ];
  const matches: string[] = [];
  for (const file of files) {
    const absolute = path.join(apiRoot, file);
    const lines = fs.readFileSync(absolute, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (OLD_ADMIN_TABLE_PATTERNS.some((pattern) => pattern.test(line))) {
        matches.push(`apps/api/${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return matches;
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
