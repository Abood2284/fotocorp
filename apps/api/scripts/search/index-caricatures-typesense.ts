#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import {
  buildCaricaturesCollectionSchema,
  buildTypesenseCaricatureDocument,
  type TypesenseCaricatureDocument,
  type TypesenseCaricatureRow,
  type TypesenseCollectionSchema,
} from "../../src/lib/search/typesense-caricatures";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, "../..");
const repoRoot = resolve(apiRoot, "../..");

interface CliOptions {
  batchSize: number;
  limit?: number;
  dryRun: boolean;
  resumeAfterId?: string;
  collection?: string;
}

interface EnvConfig {
  databaseUrl: string;
  typesenseHost: string;
  typesenseApiKey: string;
  collection: string;
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv.slice(2));
  const env = loadEnv(options);

  const pool = new pg.Pool({ connectionString: env.databaseUrl });
  try {
    const candidateCount = await getCandidateCount(pool);
    console.log(`[typesense-caricatures-index] candidates=${candidateCount}`);

    if (options.dryRun) {
      const sample = await selectBatch(pool, null, Math.min(3, options.batchSize));
      console.log(`[typesense-caricatures-index] dry-run sample=${sample.length}`);
      for (const row of sample) {
        console.log(JSON.stringify(buildTypesenseCaricatureDocument(row), null, 2));
      }
      return;
    }

    if (candidateCount === 0) {
      console.log("[typesense-caricatures-index] no candidates to index");
      return;
    }

    await ensureCollection(env);

    let indexed = 0;
    let lastAssetId = options.resumeAfterId ?? null;
    let batchNumber = 0;

    while (true) {
      const remaining = options.limit ? Math.max(options.limit - indexed, 0) : null;
      if (remaining === 0) break;

      const batchLimit = remaining === null ? options.batchSize : Math.min(options.batchSize, remaining);
      const rows = await selectBatch(pool, lastAssetId, batchLimit);
      if (rows.length === 0) break;

      batchNumber += 1;
      const documents = rows.map((row) => buildTypesenseCaricatureDocument(row));
      await importBatch(env, documents);

      indexed += documents.length;
      lastAssetId = rows[rows.length - 1]?.id ?? lastAssetId;
      console.log(
        `[typesense-caricatures-index] batch=${batchNumber} indexed=${documents.length} lastAssetId=${lastAssetId} failures=0`,
      );
    }

    console.log(`[typesense-caricatures-index] done indexed=${indexed} lastAssetId=${lastAssetId ?? "none"}`);
  } finally {
    await pool.end();
  }
}

async function getCandidateCount(pool: pg.Pool): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      select count(*)::text as count
      from caricature_assets ca
      join caricature_derivatives card
        on card.caricature_id = ca.id
       and card.derivative_type = 'BLURRED_CARD'
       and card.status = 'READY'
       and card.public_url is not null
      where ca.status = 'PUBLISHED'
        and ca.visibility = 'PUBLIC'
        and ca.deleted_at is null
    `,
  );
  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

async function selectBatch(pool: pg.Pool, resumeAfterId: string | null, limit: number): Promise<TypesenseCaricatureRow[]> {
  const result = await pool.query<TypesenseCaricatureRow>(
    `
      select
        ca.id::text as id,
        ca.headline,
        ca.description,
        ca.credit,
        ca.category_id::text as category_id,
        cc.name as category_name,
        ca.language,
        ca.has_visible_text,
        ca.visible_text,
        ca.visible_text_translation_en,
        ca.keywords,
        ca.depicted_subjects,
        ca.published_at,
        ca.created_at,
        ca.status,
        ca.visibility,
        card.public_url as preview_card_url,
        card.width as preview_card_width,
        card.height as preview_card_height,
        detail.public_url as preview_detail_url,
        detail.width as preview_detail_width,
        detail.height as preview_detail_height
      from caricature_assets ca
      join caricature_categories cc on cc.id = ca.category_id
      join caricature_derivatives card
        on card.caricature_id = ca.id
       and card.derivative_type = 'BLURRED_CARD'
       and card.status = 'READY'
       and card.public_url is not null
      left join caricature_derivatives detail
        on detail.caricature_id = ca.id
       and detail.derivative_type = 'BLURRED_DETAIL'
       and detail.status = 'READY'
       and detail.public_url is not null
      where ca.status = 'PUBLISHED'
        and ca.visibility = 'PUBLIC'
        and ca.deleted_at is null
        and ($1::uuid is null or ca.id > $1::uuid)
      order by ca.id asc
      limit $2
    `,
    [resumeAfterId, limit],
  );
  return result.rows;
}

async function ensureCollection(env: EnvConfig) {
  const url = new URL(`/collections/${encodeURIComponent(env.collection)}`, normalizeHost(env.typesenseHost));
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-TYPESENSE-API-KEY": env.typesenseApiKey,
    },
  });

  if (response.ok) {
    console.log(`[typesense-caricatures-index] collection exists: ${env.collection}`);
    return;
  }

  if (response.status !== 404) {
    const body = await response.text();
    throw new Error(`Typesense collection lookup failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const createUrl = new URL("/collections", normalizeHost(env.typesenseHost));
  const schema: TypesenseCollectionSchema = buildCaricaturesCollectionSchema(env.collection);
  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-TYPESENSE-API-KEY": env.typesenseApiKey,
    },
    body: JSON.stringify(schema),
  });

  const body = await createResponse.text();
  if (!createResponse.ok) {
    throw new Error(`Typesense collection create failed with HTTP ${createResponse.status}: ${body.slice(0, 500)}`);
  }
  console.log(`[typesense-caricatures-index] collection created: ${env.collection}`);
}

async function importBatch(env: EnvConfig, documents: TypesenseCaricatureDocument[]) {
  const url = new URL(
    `/collections/${encodeURIComponent(env.collection)}/documents/import`,
    normalizeHost(env.typesenseHost),
  );
  url.searchParams.set("action", "upsert");
  url.searchParams.set("dirty_values", "coerce_or_reject");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "X-TYPESENSE-API-KEY": env.typesenseApiKey,
    },
    body: documents.map((document) => JSON.stringify(document)).join("\n"),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Typesense import failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const failures = parseImportFailures(body);
  if (failures.length > 0) {
    console.error(`[typesense-caricatures-index] Typesense returned ${failures.length} row failure(s). First failures:`);
    for (const failure of failures.slice(0, 10)) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    throw new Error("Typesense import returned row failures.");
  }
}

function parseImportFailures(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as { success?: boolean; error?: string; document?: { id?: string } };
        if (parsed.success === false) {
          const id = parsed.document?.id ? `id=${parsed.document.id} ` : "";
          return [`${id}${parsed.error ?? "Unknown Typesense row failure"}`];
        }
      } catch {
        return [`Unparseable Typesense import response line: ${line.slice(0, 300)}`];
      }
      return [];
    });
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const options: CliOptions = { batchSize: 500, dryRun: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--batch-size") {
      options.batchSize = parsePositiveInteger(args[++i], "--batch-size");
    } else if (arg === "--limit") {
      options.limit = parsePositiveInteger(args[++i], "--limit");
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--resume-after-id") {
      options.resumeAfterId = parseUuid(args[++i], "--resume-after-id");
    } else if (arg === "--collection") {
      options.collection = parseRequiredValue(args[++i], "--collection");
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function loadEnv(options: CliOptions): EnvConfig {
  return {
    databaseUrl: requiredEnv("DATABASE_URL"),
    typesenseHost: requiredEnv("TYPESENSE_HOST"),
    typesenseApiKey: requiredEnv("TYPESENSE_API_KEY"),
    collection: options.collection ?? optionalEnv("TYPESENSE_CARICATURE_COLLECTION_ALIAS") ?? "caricatures_current",
  };
}

function parsePositiveInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} requires a positive integer`);
  return parsed;
}

function parseUuid(value: string | undefined, flag: string): string {
  const parsed = parseRequiredValue(value, flag);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
    throw new Error(`${flag} requires a UUID`);
  }
  return parsed;
}

function parseRequiredValue(value: string | undefined, flag: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${flag} requires a value`);
  return normalized;
}

function normalizeHost(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function loadLocalEnv() {
  for (const file of [
    resolve(apiRoot, ".dev.vars"),
    resolve(apiRoot, ".env.local"),
    resolve(apiRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, ".env"),
  ]) {
    if (existsSync(file)) dotenv.config({ path: file, override: false });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function printHelp() {
  console.log(`
Usage:
  pnpm --dir apps/api typesense:index-caricatures -- [options]

Options:
  --batch-size <number>       Batch size for DB reads and Typesense imports (default 500)
  --limit <number>            Optional maximum documents to process
  --dry-run                   Print candidate count and first 3 documents without indexing
  --resume-after-id <uuid>    Resume keyset pagination after a caricature_assets.id
  --collection <name>         Override TYPESENSE_CARICATURE_COLLECTION_ALIAS
`);
}

main().catch((error: unknown) => {
  console.error(`[typesense-caricatures-index] failed: ${errorMessage(error)}`);
  process.exitCode = 1;
});
