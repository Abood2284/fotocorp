#!/usr/bin/env node
import { createHash, createHmac } from "node:crypto";
import dns from "node:dns";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import type { Pool as PgPool, QueryResult, QueryResultRow } from "pg";
import sharp from "sharp";
import {
  CARD_CLEAN_PROFILE,
  DETAIL_WATERMARKED_PROFILE,
  THUMB_CLEAN_PROFILE,
} from "../../src/lib/media/watermark";

type Variant = "thumb" | "card" | "detail";
type GenerationStatus = "READY" | "FAILED" | "STALE";
type GenerateReason =
  | "new"
  | "force"
  | "missing-object"
  | "failed"
  | "not-ready"
  | "profile-changed"
  | "not-watermarked"
  | "thumb-watermarked"
  | "card-watermarked";
type ErrorClass =
  | "CORRUPT_ORIGINAL"
  | "UNSUPPORTED_IMAGE"
  | "R2_READ_ERROR"
  | "R2_UPLOAD_ERROR"
  | "DB_WRITE_ERROR"
  | "UNKNOWN_GENERATION_ERROR";

interface CliOptions {
  limit?: number;
  batchSize: number;
  assetConcurrency: number;
  uploadConcurrency: number;
  r2RetryAttempts: number;
  r2RetryBaseMs: number;
  maxRuntimeMinutes?: number;
  reportFile?: string;
  variants: Variant[];
  scope: "public-ready" | "all-verified";
  assetId?: string;
  force: boolean;
  dryRun: boolean;
  failOnItemErrors: boolean;
  retryFailed: boolean;
  verboseErrors: boolean;
  prefix: string;
  /** Profile string stored for `detail` (watermarked) rows; defaults to `DETAIL_WATERMARKED_PROFILE`. */
  detailWatermarkProfile: string;
}

interface R2Config {
  accountId: string;
  originalsBucket: string;
  previewsBucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
}

interface AssetRow {
  id: string;
  original_storage_key: string;
  legacy_image_code: string | null;
  fotokey: string | null;
}

interface ExistingDerivativeRow {
  image_asset_id: string;
  variant: Variant;
  storage_key: string;
  is_watermarked: boolean;
  watermark_profile: string | null;
  generation_status: GenerationStatus;
}

interface GeneratedDerivative {
  key: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  checksum: string;
  buffer: Buffer;
  selectedQuality: number;
  targetReached: boolean;
  variant: Variant;
}

interface PreviewVariantProfile {
  width: number;
  qualities: number[];
  targetMaxBytes?: number;
}

interface GeneratedDerivativeCandidate {
  width: number;
  height: number;
  byteSize: number;
  quality: number;
  buffer: Buffer;
}

interface Counters {
  selectedAssets: number;
  selectedVariants: number;
  processedAssets: number;
  processedVariants: number;
  generatedVariants: number;
  failedVariants: number;
  skippedReady: number;
  regeneratedMissingObject: number;
  regeneratedFailed: number;
  regeneratedProfileChanged: number;
  failed: number;
  corruptOriginalAssets: number;
  unsupportedImageAssets: number;
  r2ReadFailures: number;
  r2UploadFailures: number;
  dbWriteFailures: number;
  totalR2ReadMs: number;
  totalSourceDecodeMs: number;
  totalSharpTransformMs: number;
  totalR2UploadMs: number;
  totalDbWriteMs: number;
  r2ReadCount: number;
  sourceDecodeCount: number;
  transformCount: number;
  uploadCount: number;
  dbWriteCount: number;
}

interface RunSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  selectedAssets: number;
  selectedVariants: number;
  processedAssets: number;
  processedVariants: number;
  generatedVariants: number;
  failedVariants: number;
  skippedReady: number;
  regeneratedFailed: number;
  throughput: {
    assetsPerMinute: number;
    variantsPerMinute: number;
  };
  timing: {
    averageR2ReadMs: number;
    averageSourceDecodeMs: number;
    averageSharpTransformMs: number;
    averageR2UploadMs: number;
    averageDbWriteMs: number;
    totalR2ReadMs: number;
    totalSourceDecodeMs: number;
    totalSharpTransformMs: number;
    totalR2UploadMs: number;
    totalDbWriteMs: number;
  };
  failureCounts: {
    corruptOriginalAssets: number;
    unsupportedImageAssets: number;
    r2ReadFailures: number;
    r2UploadFailures: number;
    dbWriteFailures: number;
    failedVariants: number;
  };
  config: Record<string, unknown>;
}

interface SelectionDiagnostics {
  selected_candidates: number;
  excluded_no_original_key: number;
  excluded_original_missing_in_r2: number;
  excluded_scope_not_public_ready: number;
  excluded_already_ready_for_scope: number;
}

const { Pool } = pg;
try {
  dns.setDefaultResultOrder?.("ipv4first");
} catch {
  // Older Node versions may not support this. Safe to ignore.
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiRoot = resolve(__dirname, "../..");
const repoRoot = resolve(apiRoot, "../..");
const DB_MAX_ATTEMPTS = 7;
const DB_BACKOFF_BASE_MS = 500;
const DB_BACKOFF_MAX_MS = 15_000;
const TRANSIENT_DB_ERROR_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "08000",
  "08001",
  "08003",
  "08006",
  "57P01",
  "57P02",
  "57P03",
  "53300",
]);

const PREVIEW_VARIANT_PROFILES: Record<Variant, PreviewVariantProfile> = {
  thumb: {
    width: 220,
    qualities: [26, 22],
  },
  card: {
    width: 300,
    qualities: [14],
    targetMaxBytes: 22 * 1024,
  },
  detail: {
    width: 520,
    qualities: [20, 16, 12],
    targetMaxBytes: 120 * 1024,
  },
};
const VARIANTS: Variant[] = ["thumb", "card", "detail"];
const MIME_TYPE = "image/webp";

/** Only `detail` uses the tiled watermark; `thumb` and `card` are clean WebPs under the legacy `previews/watermarked/...` paths. */
function variantUsesWatermark(variant: Variant): boolean {
  return variant === "detail";
}

function expectedDerivativeProfile(variant: Variant, options: CliOptions): string {
  if (variant === "thumb") return THUMB_CLEAN_PROFILE;
  if (variant === "card") return CARD_CLEAN_PROFILE;
  return options.detailWatermarkProfile;
}
const DEFAULT_LIMIT_INPUT_PIXELS = 268_402_689;

loadLocalEnv();

async function main() {
  const startedAt = new Date();
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = requiredEnv("DATABASE_URL");
  const pool = createScriptPool(databaseUrl);
  const failureLogPath = getFailureLogPath();
  const checkpointEvery = envNumber("MEDIA_DERIVATIVE_CHECKPOINT_EVERY", 100);
  let nextCheckpointAt = checkpointEvery;

  const counters: Counters = {
    selectedAssets: 0,
    selectedVariants: 0,
    processedAssets: 0,
    processedVariants: 0,
    generatedVariants: 0,
    failedVariants: 0,
    skippedReady: 0,
    regeneratedMissingObject: 0,
    regeneratedFailed: 0,
    regeneratedProfileChanged: 0,
    failed: 0,
    corruptOriginalAssets: 0,
    unsupportedImageAssets: 0,
    r2ReadFailures: 0,
    r2UploadFailures: 0,
    dbWriteFailures: 0,
    totalR2ReadMs: 0,
    totalSourceDecodeMs: 0,
    totalSharpTransformMs: 0,
    totalR2UploadMs: 0,
    totalDbWriteMs: 0,
    r2ReadCount: 0,
    sourceDecodeCount: 0,
    transformCount: 0,
    uploadCount: 0,
    dbWriteCount: 0,
  };

  try {
    const r2Config = options.dryRun ? null : getR2Config();
    printStartup(options, failureLogPath, checkpointEvery);
    await preflightDatabase(pool, databaseUrl);
    const assets = await selectAssets(pool, options);
    counters.selectedAssets = assets.length;
    console.log(`Selected scope: ${options.scope}`);
    console.log(`Selected eligible assets: ${assets.length}`);
    const diagnostics = await getSelectionDiagnostics(pool, options);
    printSelectionDiagnostics(diagnostics, options);

    if (assets.length === 0) {
      await warnOnScopeMismatch(pool, options, diagnostics);
      return;
    }

    const chunks = chunkAssets(assets, options.batchSize);
    for (const [chunkIndex, batch] of chunks.entries()) {
      const existing = await getExistingDerivatives(pool, batch.map((asset) => asset.id), options.variants);
      counters.selectedVariants += batch.reduce((sum, asset) => {
        const decisions = decideAssetVariantActions(existing, options, asset.id);
        return sum + decisions.length;
      }, 0);

      await runWithConcurrency(batch, options.assetConcurrency, async (asset) => {
        await processAsset(pool, r2Config, options, counters, asset, existing, failureLogPath);
      });

      const runtimeLimitReached = hasRuntimeLimitElapsed(options.maxRuntimeMinutes, startedAt);

      console.log(
        `Progress batch=${chunkIndex + 1}/${chunks.length} processedAssets=${counters.processedAssets} processedVariants=${counters.processedVariants} generatedVariants=${counters.generatedVariants} failedVariants=${counters.failedVariants} skippedReady=${counters.skippedReady} regeneratedFailed=${counters.regeneratedFailed}`,
      );

      while (checkpointEvery > 0 && counters.processedVariants >= nextCheckpointAt) {
        printCheckpoint(options, counters, failureLogPath, startedAt);
        nextCheckpointAt += checkpointEvery;
      }

      if (runtimeLimitReached) {
        console.warn(
          `[runtime-limit] max runtime ${options.maxRuntimeMinutes} minutes reached. Stopping after batch ${chunkIndex + 1}/${chunks.length}.`,
        );
        break;
      }
    }
  } finally {
    await pool.end();
    const summary = buildRunSummary(counters, options, failureLogPath, startedAt, new Date());
    printSummary(summary, failureLogPath);
    if (options.reportFile) {
      await writeReportFile(options.reportFile, summary);
      console.log(`[report] wrote run summary to ${options.reportFile}`);
    }
  }

  if (counters.failedVariants > 0) {
    console.warn(`[done_with_failures] ${counters.failedVariants} item-level failures logged to ${failureLogPath}`);
    if (options.failOnItemErrors) {
      console.warn("Completed with item-level failures. Exiting 1 because --fail-on-item-errors was set.");
      process.exitCode = 1;
    } else {
      console.warn("Completed with item-level failures. Exit code remains 0. Use --fail-on-item-errors for strict mode.");
    }
  }
}

async function processAsset(
  pool: PgPool,
  r2Config: R2Config | null,
  options: CliOptions,
  counters: Counters,
  asset: AssetRow,
  existing: Map<string, ExistingDerivativeRow>,
  failureLogPath: string,
) {
  const previewObjectId = getPreviewObjectId(asset);
  counters.processedAssets += 1;
  const decisions = decideAssetVariantActions(existing, options, asset.id);

  if (decisions.length === 0) return;

  for (const decision of decisions) {
    counters.processedVariants += 1;
    if (decision.action === "skip") {
      counters.skippedReady += 1;
      console.log("skip derivative_generation", {
        assetId: asset.id,
        preview_object_id: previewObjectId,
        variant: decision.variant,
        reason: "ready-derivative-exists",
      });
    }
  }

  const toGenerate = decisions.filter((decision) => decision.action === "generate");
  if (toGenerate.length === 0) return;

  if (options.dryRun) {
    for (const decision of toGenerate) {
      countRegenerationReason(counters, decision.reason);
      console.log("dry-run derivative_decision", {
        assetId: asset.id,
        preview_object_id: previewObjectId,
        variant: decision.variant,
        action: "would-generate",
        reason: decision.reason,
      });
    }
    return;
  }

  if (!r2Config) {
    throw new Error("R2 config is required outside dry-run mode.");
  }

  let original: Buffer;
  try {
    const r2ReadStart = performance.now();
    original = await withR2Retry("r2_get_original", options, () =>
      r2GetObject(r2Config, r2Config.originalsBucket, asset.original_storage_key));
    counters.totalR2ReadMs += performance.now() - r2ReadStart;
    counters.r2ReadCount += 1;
  } catch (error) {
    counters.r2ReadFailures += 1;
    counters.failedVariants += toGenerate.length;
    const errorClass = classifyGenerationError(error, "source_read");
    for (const decision of toGenerate) {
      const derivativeKey = buildDerivativeR2Key({ prefix: options.prefix, variant: decision.variant, objectId: previewObjectId });
      await logDerivativeFailure(failureLogPath, {
        options,
        asset,
        derivativeKey,
        variant: decision.variant,
        stage: "source_read",
        reason: "source_read_failed",
        errorClass,
        error,
      });
      await markDerivativeFailed(pool, asset.id, decision.variant, derivativeKey, expectedDerivativeProfile(decision.variant, options), counters).catch(async (markError) => {
        counters.dbWriteFailures += 1;
        await logDerivativeFailure(failureLogPath, {
          options,
          asset,
          derivativeKey,
          variant: decision.variant,
          stage: "db_update",
          reason: "failure_status_update_failed",
          errorClass: "DB_WRITE_ERROR",
          error: markError,
        });
      });
    }
    return;
  }
  let decodedSource: Buffer;
  try {
    const decodeStart = performance.now();
    decodedSource = await decodeSourceImage(original);
    counters.totalSourceDecodeMs += performance.now() - decodeStart;
    counters.sourceDecodeCount += 1;
  } catch (error) {
    const errorClass = classifyGenerationError(error, "source_decode");
    if (errorClass === "CORRUPT_ORIGINAL") counters.corruptOriginalAssets += 1;
    if (errorClass === "UNSUPPORTED_IMAGE") counters.unsupportedImageAssets += 1;
    counters.failedVariants += toGenerate.length;
    for (const decision of toGenerate) {
      const derivativeKey = buildDerivativeR2Key({ prefix: options.prefix, variant: decision.variant, objectId: previewObjectId });
      await logDerivativeFailure(failureLogPath, {
        options,
        asset,
        derivativeKey,
        variant: decision.variant,
        stage: "source_decode",
        reason: errorClass,
        errorClass,
        error,
      });
      await markDerivativeFailed(pool, asset.id, decision.variant, derivativeKey, expectedDerivativeProfile(decision.variant, options), counters).catch(async (markError) => {
        counters.dbWriteFailures += 1;
        await logDerivativeFailure(failureLogPath, {
          options,
          asset,
          derivativeKey,
          variant: decision.variant,
          stage: "db_update",
          reason: "failure_status_update_failed",
          errorClass: "DB_WRITE_ERROR",
          error: markError,
        });
      });
    }
    return;
  }

  const generatedVariants: GeneratedDerivative[] = [];

  await runWithConcurrency(toGenerate, options.uploadConcurrency, async (decision) => {
    const derivativeKey = buildDerivativeR2Key({ prefix: options.prefix, variant: decision.variant, objectId: previewObjectId });

    try {
      countRegenerationReason(counters, decision.reason);
      const transformStart = performance.now();
      const generated = await generateDerivative(decodedSource, derivativeKey, decision.variant, asset.id, previewObjectId);
      counters.totalSharpTransformMs += performance.now() - transformStart;
      counters.transformCount += 1;

      const uploadStart = performance.now();
      await withR2Retry("r2_put_derivative", options, () =>
        r2PutObject(r2Config, r2Config.previewsBucket, generated.key, generated.buffer, MIME_TYPE));
      counters.totalR2UploadMs += performance.now() - uploadStart;
      counters.uploadCount += 1;

      generatedVariants.push(generated);
      counters.generatedVariants += 1;
      console.log("generated derivative_generation", {
        assetId: asset.id,
        preview_object_id: previewObjectId,
        variant: decision.variant,
        reason: decision.reason,
        newR2Key: generated.key,
        outputBytes: generated.byteSize,
        selectedWebpQuality: generated.selectedQuality,
        targetReached: generated.targetReached,
      });
    } catch (error) {
      const errorClass = classifyGenerationError(error, "generation");
      if (errorClass === "R2_UPLOAD_ERROR") counters.r2UploadFailures += 1;
      counters.failedVariants += 1;
      await logDerivativeFailure(failureLogPath, {
        options,
        asset,
        derivativeKey,
        variant: decision.variant,
        stage: "generation",
        reason: "generation_error",
        errorClass,
        error,
      });
      await markDerivativeFailed(pool, asset.id, decision.variant, derivativeKey, expectedDerivativeProfile(decision.variant, options), counters).catch(async (markError) => {
        counters.dbWriteFailures += 1;
        await logDerivativeFailure(failureLogPath, {
          options,
          asset,
          derivativeKey,
          variant: decision.variant,
          stage: "db_update",
          reason: "failure_status_update_failed",
          errorClass: "DB_WRITE_ERROR",
          error: markError,
        });
      });
      console.error("failed derivative_generation", {
        assetId: asset.id,
        preview_object_id: previewObjectId,
        legacyImageCode: asset.legacy_image_code,
        originalStorageKey: asset.original_storage_key,
        derivativeR2Key: derivativeKey,
        variant: decision.variant,
        reason: "generation_error",
        errorClass,
        error: errorMessage(error),
      });
    }
  });

  if (generatedVariants.length > 0) {
    try {
      await upsertDerivativesBatch(pool, asset.id, generatedVariants, options, "READY", counters);
    } catch (error) {
      counters.dbWriteFailures += 1;
      counters.failedVariants += generatedVariants.length;
      for (const item of generatedVariants) {
        await logDerivativeFailure(failureLogPath, {
          options,
          asset,
          derivativeKey: item.key,
          variant: item.variant,
          stage: "db_update",
          reason: "generated_object_db_update_failed",
          errorClass: "DB_WRITE_ERROR",
          error,
        });
      }
      console.error("failed derivative_generation", {
        assetId: asset.id,
        preview_object_id: previewObjectId,
        reason: "generated_object_db_update_failed",
        generatedCount: generatedVariants.length,
        error: errorMessage(error),
      });
    }
  }
}

function createScriptPool(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: envNumber("MEDIA_DERIVATIVE_DB_POOL_MAX", 5),
    connectionTimeoutMillis: envNumber("MEDIA_DERIVATIVE_DB_CONNECTION_TIMEOUT_MS", 15_000),
    idleTimeoutMillis: envNumber("MEDIA_DERIVATIVE_DB_IDLE_TIMEOUT_MS", 30_000),
    maxLifetimeSeconds: envNumber("MEDIA_DERIVATIVE_DB_MAX_LIFETIME_SECONDS", 60),
    allowExitOnIdle: true,
  });

  pool.on("error", (error) => {
    const info = dbErrorInfo(error);
    console.warn("[db.pool.error]", {
      code: info.code,
      hostname: info.hostname,
      message: errorMessage(error),
    });
  });

  return pool;
}

async function preflightDatabase(pool: PgPool, databaseUrl: string) {
  const host = new URL(databaseUrl).hostname;
  const addresses = await withDbRetry("dns.lookup database host", async () => {
    return dns.promises.lookup(host, { all: true });
  });

  console.log("[db.preflight.dns]", {
    host,
    addresses: addresses.map((item) => `${item.address}/${item.family}`),
  });

  await dbQuery(pool, "db preflight select 1", "select 1");
  console.log("[db.preflight.ok]");
}

async function dbQuery<Row extends QueryResultRow>(
  pool: PgPool,
  label: string,
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  return withDbRetry(label, () => pool.query<Row>(text, params as unknown[]));
}

async function selectAssets(pool: PgPool, options: CliOptions): Promise<AssetRow[]> {
  const where: string[] = [
    "a.media_type = 'IMAGE'",
    "a.original_exists_in_storage = true",
    "a.original_storage_key is not null",
    "btrim(a.original_storage_key) <> ''",
  ];
  const params: unknown[] = [
    options.variants,
    THUMB_CLEAN_PROFILE,
    CARD_CLEAN_PROFILE,
    options.detailWatermarkProfile,
    options.retryFailed,
    options.force,
  ];

  if (options.scope === "public-ready") {
    where.push("a.status = 'APPROVED'");
    where.push("a.visibility = 'PUBLIC'");
  }

  if (options.assetId) {
    params.push(options.assetId);
    where.push(`a.id = $${params.length}`);
  } else {
    where.push(`
      exists (
        select 1
        from unnest($1::text[]) as v(variant)
        left join image_derivatives d
          on d.image_asset_id = a.id
         and d.variant = upper(v.variant)
        where
          $6::boolean = true
          or d.image_asset_id is null
          or d.generation_status <> 'READY'
          or (
            case upper(v.variant)
              when 'THUMB' then d.is_watermarked is distinct from false
              when 'CARD' then d.is_watermarked is distinct from false
              else d.is_watermarked is distinct from true
            end
          )
          or (
            case upper(v.variant)
              when 'THUMB' then d.watermark_profile is distinct from $2::text
              when 'CARD' then d.watermark_profile is distinct from $3::text
              else d.watermark_profile is distinct from $4::text
            end
          )
          or ($5::boolean = true and d.generation_status = 'FAILED')
      )
    `);
  }

  let limitClause = "";
  if (options.limit !== undefined) {
    params.push(options.limit);
    limitClause = `limit $${params.length}`;
  }

  const result = await dbQuery<AssetRow>(
    pool,
    "selectAssets",
    `
      select a.id, a.original_storage_key, a.legacy_image_code, a.fotokey
      from image_assets a
      where ${where.join(" and ")}
      order by a.created_at asc, a.id asc
      ${limitClause}
    `,
    params,
  );

  return result.rows;
}

async function getSelectionDiagnostics(pool: PgPool, options: CliOptions): Promise<SelectionDiagnostics> {
  const result = await dbQuery<SelectionDiagnostics>(
    pool,
    "selectionDiagnostics",
    `
      with base as (
        select
          a.id,
          a.original_storage_key,
          a.original_exists_in_storage,
          a.status,
          a.visibility
        from image_assets a
        where a.media_type = 'IMAGE'
      ),
      candidates as (
        select b.*
        from base b
        where b.original_storage_key is not null
          and btrim(b.original_storage_key) <> ''
          and b.original_exists_in_storage = true
      ),
      scope_filtered as (
        select c.*
        from candidates c
        where
          $5::text = 'all-verified'
          or (
            $5::text = 'public-ready'
            and c.status = 'APPROVED'
            and c.visibility = 'PUBLIC'
          )
      ),
      needs_work as (
        select sf.id
        from scope_filtered sf
        where exists (
          select 1
          from unnest($1::text[]) as v(variant)
          left join image_derivatives d
            on d.image_asset_id = sf.id
           and d.variant = upper(v.variant)
          where
            $6::boolean = true
            or d.image_asset_id is null
            or d.generation_status <> 'READY'
            or (
              case upper(v.variant)
                when 'THUMB' then d.is_watermarked is distinct from false
                when 'CARD' then d.is_watermarked is distinct from false
                else d.is_watermarked is distinct from true
              end
            )
            or (
              case upper(v.variant)
                when 'THUMB' then d.watermark_profile is distinct from $2::text
                when 'CARD' then d.watermark_profile is distinct from $3::text
                else d.watermark_profile is distinct from $4::text
              end
            )
            or ($7::boolean = true and d.generation_status = 'FAILED')
        )
      )
      select
        (select count(*)::int from needs_work) as selected_candidates,
        (select count(*)::int from base where original_storage_key is null or btrim(coalesce(original_storage_key, '')) = '') as excluded_no_original_key,
        (select count(*)::int from base where original_storage_key is not null and btrim(original_storage_key) <> '' and coalesce(original_exists_in_storage, false) = false) as excluded_original_missing_in_r2,
        (
          select count(*)::int
          from candidates
          where $5::text = 'public-ready'
            and not (status = 'APPROVED' and visibility = 'PUBLIC')
        ) as excluded_scope_not_public_ready,
        (
          select greatest(
            (select count(*)::int from scope_filtered) - (select count(*)::int from needs_work),
            0
          )
        ) as excluded_already_ready_for_scope
    `,
    [
      options.variants,
      THUMB_CLEAN_PROFILE,
      CARD_CLEAN_PROFILE,
      options.detailWatermarkProfile,
      options.scope,
      options.force,
      options.retryFailed,
    ],
  );

  return result.rows[0] ?? {
    selected_candidates: 0,
    excluded_no_original_key: 0,
    excluded_original_missing_in_r2: 0,
    excluded_scope_not_public_ready: 0,
    excluded_already_ready_for_scope: 0,
  };
}

function printSelectionDiagnostics(diagnostics: SelectionDiagnostics, options: CliOptions) {
  console.log("Selection diagnostics:");
  console.table({
    selectedCandidates: diagnostics.selected_candidates,
    excludedNoOriginalKey: diagnostics.excluded_no_original_key,
    excludedOriginalMissingInR2: diagnostics.excluded_original_missing_in_r2,
    excludedAlreadyReadyForScope: diagnostics.excluded_already_ready_for_scope,
    excludedNotPublicReadyScope: options.scope === "public-ready" ? diagnostics.excluded_scope_not_public_ready : 0,
  });
}

async function warnOnScopeMismatch(pool: PgPool, options: CliOptions, diagnostics: SelectionDiagnostics) {
  if (diagnostics.selected_candidates > 0) return;

  const missing = await dbQuery<{ missing_count: number }>(
    pool,
    "scopeMismatchMissingCount",
    `
      with variants as (
        select unnest($1::text[]) as variant
      )
      select count(*)::int as missing_count
      from image_assets a
      cross join variants v
      left join image_derivatives d
        on d.image_asset_id = a.id
       and d.variant = upper(v.variant)
      where a.media_type = 'IMAGE'
        and a.original_exists_in_storage = true
        and a.original_storage_key is not null
        and btrim(a.original_storage_key) <> ''
        and (
          d.image_asset_id is null
          or d.generation_status <> 'READY'
          or (
            case upper(v.variant)
              when 'THUMB' then d.is_watermarked is distinct from false
              when 'CARD' then d.is_watermarked is distinct from false
              else d.is_watermarked is distinct from true
            end
          )
          or (
            case upper(v.variant)
              when 'THUMB' then d.watermark_profile is distinct from $2::text
              when 'CARD' then d.watermark_profile is distinct from $3::text
              else d.watermark_profile is distinct from $4::text
            end
          )
        )
    `,
    [options.variants, THUMB_CLEAN_PROFILE, CARD_CLEAN_PROFILE, options.detailWatermarkProfile],
  );

  const missingCount = Number(missing.rows[0]?.missing_count ?? 0);
  if (missingCount > 0 && options.scope === "public-ready") {
    console.warn(
      `[scope-warning] selected=0 for scope=public-ready, but ${missingCount} derivative slots are still missing/invalid across verified assets. Use --scope all-verified for migration backfill.`,
    );
  }
}

async function getExistingDerivatives(
  pool: PgPool,
  assetIds: string[],
  variants: Variant[],
): Promise<Map<string, ExistingDerivativeRow>> {
  if (assetIds.length === 0) return new Map();

  const result = await dbQuery<ExistingDerivativeRow>(
    pool,
    "getExistingDerivatives",
    `
      select image_asset_id, lower(variant) as variant, storage_key, is_watermarked, watermark_profile, generation_status
      from image_derivatives
      where image_asset_id = any($1::uuid[])
        and variant = any(
          array(
            select upper(v) from unnest($2::text[]) as v
          )
        )
    `,
    [assetIds, variants],
  );

  return new Map(result.rows.map((row) => [derivativeIdentity(row.image_asset_id, row.variant), row]));
}

function decideAssetVariantActions(
  existing: Map<string, ExistingDerivativeRow>,
  options: CliOptions,
  assetId: string,
): Array<{ variant: Variant; action: "skip" } | { variant: Variant; action: "generate"; reason: GenerateReason }> {
  return options.variants.map((variant) => {
    const row = existing.get(derivativeIdentity(assetId, variant));
    return decideDerivativeAction(options, variant, row);
  });
}

function decideDerivativeAction(
  options: CliOptions,
  variant: Variant,
  existingDerivative: ExistingDerivativeRow | undefined,
): { variant: Variant; action: "skip" } | { variant: Variant; action: "generate"; reason: GenerateReason } {
  if (options.force) return { variant, action: "generate", reason: "force" };
  if (!existingDerivative) return { variant, action: "generate", reason: "new" };
  if (variantUsesWatermark(variant)) {
    if (existingDerivative.is_watermarked !== true) return { variant, action: "generate", reason: "not-watermarked" };
  } else if (existingDerivative.is_watermarked !== false) {
    return {
      variant,
      action: "generate",
      reason: variant === "thumb" ? "thumb-watermarked" : "card-watermarked",
    };
  }
  if (existingDerivative.watermark_profile !== expectedDerivativeProfile(variant, options)) {
    return { variant, action: "generate", reason: "profile-changed" };
  }
  if (existingDerivative.generation_status === "FAILED") {
    return options.retryFailed
      ? { variant, action: "generate", reason: "failed" }
      : { variant, action: "skip" };
  }
  if (existingDerivative.generation_status !== "READY") return { variant, action: "generate", reason: "not-ready" };
  return { variant, action: "skip" };
}

function countRegenerationReason(counters: Counters, reason: GenerateReason) {
  if (reason === "missing-object") counters.regeneratedMissingObject += 1;
  else if (reason === "failed") counters.regeneratedFailed += 1;
  else if (reason === "profile-changed") counters.regeneratedProfileChanged += 1;
}

async function generateDerivative(
  source: Buffer,
  key: string,
  variant: Variant,
  assetId?: string,
  previewObjectId?: string,
): Promise<GeneratedDerivative> {
  const profile = PREVIEW_VARIANT_PROFILES[variant];
  const metadata = await sharp(source, { failOn: "none", limitInputPixels: DEFAULT_LIMIT_INPUT_PIXELS }).metadata();
  const targetWidth = metadata.width ? Math.min(metadata.width, profile.width) : profile.width;
  let bestCandidate: GeneratedDerivativeCandidate | undefined;

  for (const quality of profile.qualities) {
    const candidate = variantUsesWatermark(variant)
      ? await renderWatermarkedPreview(source, targetWidth, quality)
      : await renderCleanPreview(source, targetWidth, quality);
    if (!bestCandidate || candidate.byteSize < bestCandidate.byteSize) {
      bestCandidate = candidate;
    }

    if (!profile.targetMaxBytes || candidate.byteSize <= profile.targetMaxBytes) {
      return buildGeneratedDerivative(key, variant, candidate, true);
    }
  }

  if (!bestCandidate) {
    throw new Error("Unable to generate derivative candidate.");
  }

  console.warn("[derivative.detail_size_target_not_reached]", {
    assetId,
    preview_object_id: previewObjectId,
    key,
    variant,
    finalByteSize: bestCandidate.byteSize,
    targetMaxBytes: profile.targetMaxBytes ?? null,
    finalWidth: bestCandidate.width,
    finalQuality: bestCandidate.quality,
  });

  return buildGeneratedDerivative(key, variant, bestCandidate, false);
}

async function renderCleanPreview(
  source: Buffer,
  targetWidth: number,
  quality: number,
): Promise<GeneratedDerivativeCandidate> {
  const encoded = await sharp(source, { failOn: "none", limitInputPixels: DEFAULT_LIMIT_INPUT_PIXELS })
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
  const width = encoded.info.width;
  const height = encoded.info.height;
  if (!width || !height) {
    throw new Error("Unable to determine derivative dimensions.");
  }
  return {
    width,
    height,
    byteSize: encoded.data.byteLength,
    quality,
    buffer: encoded.data,
  };
}

async function renderWatermarkedPreview(
  source: Buffer,
  targetWidth: number,
  quality: number,
): Promise<GeneratedDerivativeCandidate> {
  const resized = await sharp(source, { failOn: "none", limitInputPixels: DEFAULT_LIMIT_INPUT_PIXELS })
    .resize({ width: targetWidth, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const width = resized.info.width;
  const height = resized.info.height;

  if (!width || !height) {
    throw new Error("Unable to determine derivative dimensions.");
  }

  const watermark = Buffer.from(buildWatermarkSvg(width, height));
  const encoded = await sharp(resized.data, { failOn: "none" })
    .composite([{ input: watermark, top: 0, left: 0 }])
    .webp({ quality, effort: 6, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  return {
    width: encoded.info.width ?? width,
    height: encoded.info.height ?? height,
    byteSize: encoded.data.byteLength,
    quality,
    buffer: encoded.data,
  };
}

function buildGeneratedDerivative(
  key: string,
  variant: Variant,
  candidate: GeneratedDerivativeCandidate,
  targetReached: boolean,
): GeneratedDerivative {
  return {
    variant,
    key,
    width: candidate.width,
    height: candidate.height,
    byteSize: candidate.byteSize,
    checksum: createHash("sha256").update(candidate.buffer).digest("hex"),
    buffer: candidate.buffer,
    selectedQuality: candidate.quality,
    targetReached,
  };
}

async function upsertDerivativesBatch(
  pool: PgPool,
  assetId: string,
  derivatives: GeneratedDerivative[],
  options: CliOptions,
  status: GenerationStatus,
  counters: Counters,
) {
  const values: unknown[] = [];
  const tuples: string[] = [];

  for (const derivative of derivatives) {
    const isWatermarked = variantUsesWatermark(derivative.variant);
    const profile = expectedDerivativeProfile(derivative.variant, options);
    values.push(
      assetId,
      derivative.variant.toUpperCase(),
      derivative.key,
      MIME_TYPE,
      derivative.width,
      derivative.height,
      derivative.byteSize,
      derivative.checksum,
      isWatermarked,
      profile,
      status,
    );
    const base = values.length - 11;
    tuples.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, now(), now())`,
    );
  }

  const dbStart = performance.now();
  await dbQuery(
    pool,
    "upsertDerivativesBatch",
    `
      insert into image_derivatives (
        image_asset_id,
        variant,
        storage_key,
        mime_type,
        width,
        height,
        size_bytes,
        checksum,
        is_watermarked,
        watermark_profile,
        generation_status,
        generated_at,
        updated_at
      )
      values ${tuples.join(",\n")}
      on conflict (image_asset_id, variant) do update
      set
        storage_key = excluded.storage_key,
        mime_type = excluded.mime_type,
        width = excluded.width,
        height = excluded.height,
        size_bytes = excluded.size_bytes,
        checksum = excluded.checksum,
        is_watermarked = excluded.is_watermarked,
        watermark_profile = excluded.watermark_profile,
        generation_status = excluded.generation_status,
        generated_at = excluded.generated_at,
        updated_at = now()
    `,
    values,
  );
  counters.totalDbWriteMs += performance.now() - dbStart;
  counters.dbWriteCount += 1;
}

async function markDerivativeFailed(
  pool: PgPool,
  assetId: string,
  variant: Variant,
  derivativeKey: string,
  watermarkProfile: string,
  counters: Counters,
) {
  const dbStart = performance.now();
  await dbQuery(
    pool,
    "updateDerivativeStatus",
    `
      insert into image_derivatives (
        image_asset_id,
        variant,
        storage_key,
        mime_type,
        is_watermarked,
        watermark_profile,
        generation_status,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, 'FAILED', now())
      on conflict (image_asset_id, variant) do update
      set
        generation_status = 'FAILED',
        updated_at = now()
    `,
    [assetId, variant.toUpperCase(), derivativeKey, MIME_TYPE, variantUsesWatermark(variant), watermarkProfile],
  );
  counters.totalDbWriteMs += performance.now() - dbStart;
  counters.dbWriteCount += 1;
}

async function r2GetObject(config: R2Config, bucket: string, key: string): Promise<Buffer> {
  const response = await signedR2Request(config, bucket, "GET", key);
  if (!response.ok) {
    throw new Error(`R2 GET failed with status ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function r2PutObject(config: R2Config, bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
  assertDerivativeKey(key);
  const response = await signedR2Request(config, bucket, "PUT", key, body, {
    "content-type": contentType,
  });

  if (!response.ok) {
    throw new Error(`R2 PUT failed with status ${response.status}`);
  }
}

async function signedR2Request(
  config: R2Config,
  bucket: string,
  method: "GET" | "PUT",
  key: string,
  body?: Buffer,
  extraHeaders: Record<string, string> = {},
) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`/${bucket}/${encodedKey}`, config.endpoint);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashHex(body ?? "");
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders,
  };
  const canonicalHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = canonicalHeaderNames
    .map((name) => `${name}:${headers[name]}`)
    .join("\n") + "\n";
  const signedHeaders = canonicalHeaderNames.join(";");
  const canonicalRequest = [method, url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n");
  const signingKey = getSignatureKey(config.secretAccessKey, dateStamp, config.region, "s3");
  const signature = hmacHex(signingKey, stringToSign);
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestHeaders = new Headers(headers);
  requestHeaders.delete("host");
  requestHeaders.set("Authorization", authorization);
  const requestBody = method === "PUT" && body
    ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
    : undefined;

  return fetch(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
  });
}

function buildWatermarkSvg(width: number, height: number) {
  const tileWidth = 190;
  const tileHeight = 105;
  const tiles: string[] = [];

  for (let y = -tileHeight; y < height + tileHeight; y += tileHeight) {
    for (let x = -tileWidth; x < width + tileWidth; x += tileWidth) {
      tiles.push(`
       <g transform="translate(${x} ${y}) rotate(-28 95 52.5)">
  <text
    x="95"
    y="57"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="27"
    font-weight="800"
    letter-spacing="3"
    fill="#111111"
    fill-opacity="0.52"
    stroke="#ffffff"
    stroke-opacity="0.20"
    stroke-width="1.0"
  >fotocorp</text>
</g>
      `);
    }
  }

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="none"/>
      ${tiles.join("\n")}
    </svg>
  `;
}

function getPreviewObjectId(asset: AssetRow) {
  const legacyImagecode = asset.legacy_image_code?.trim();
  if (legacyImagecode) return legacyImagecode;

  const originalR2Key = asset.original_storage_key?.trim();
  if (originalR2Key) {
    const filename = basename(originalR2Key);
    const stem = filename.replace(/\.[^.]+$/, "");
    if (stem) return stem;
  }

  throw new Error(`Cannot build preview key: missing legacyImagecode/originalR2Key for asset ${asset.id}`);
}

function buildDerivativeR2Key(input: { prefix: string; variant: Variant; objectId: string }) {
  return `${normalizePrefix(input.prefix)}/${input.variant}/${input.objectId}.webp`;
}

function assertDerivativeKey(key: string) {
  const normalized = normalizePrefix(key);
  if (!normalized.startsWith("previews/watermarked/")) {
    throw new Error("Refusing to write derivative outside previews/watermarked/.");
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    batchSize: 50,
    assetConcurrency: 4,
    uploadConcurrency: 8,
    r2RetryAttempts: 3,
    r2RetryBaseMs: 250,
    variants: VARIANTS,
    scope: "public-ready",
    force: false,
    dryRun: false,
    failOnItemErrors: false,
    retryFailed: true,
    verboseErrors: false,
    prefix: "previews/watermarked",
    detailWatermarkProfile: DETAIL_WATERMARKED_PROFILE,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = () => {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--limit") options.limit = parsePositiveInteger(next(), "limit");
    else if (arg === "--batch-size") options.batchSize = parsePositiveInteger(next(), "batch-size");
    else if (arg === "--concurrency") options.assetConcurrency = parsePositiveInteger(next(), "concurrency");
    else if (arg === "--asset-concurrency") options.assetConcurrency = parsePositiveInteger(next(), "asset-concurrency");
    else if (arg === "--upload-concurrency") options.uploadConcurrency = parsePositiveInteger(next(), "upload-concurrency");
    else if (arg === "--r2-retry-attempts") options.r2RetryAttempts = parsePositiveInteger(next(), "r2-retry-attempts");
    else if (arg === "--r2-retry-base-ms") options.r2RetryBaseMs = parsePositiveInteger(next(), "r2-retry-base-ms");
    else if (arg === "--max-runtime-minutes") options.maxRuntimeMinutes = parsePositiveInteger(next(), "max-runtime-minutes");
    else if (arg === "--report-file") options.reportFile = next();
    else if (arg === "--variant") options.variants = [parseVariant(next())];
    else if (arg === "--variants") options.variants = parseVariants(next());
    else if (arg === "--scope") options.scope = parseScope(next());
    else if (arg === "--asset-id") options.assetId = parseUuid(next(), "asset-id");
    else if (arg === "--force") options.force = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--fail-on-item-errors") options.failOnItemErrors = true;
    else if (arg === "--retry-failed") options.retryFailed = true;
    else if (arg === "--no-retry-failed") options.retryFailed = false;
    else if (arg === "--verbose-errors") options.verboseErrors = true;
    else if (arg === "--prefix") options.prefix = normalizePrefix(next());
    else if (arg === "--watermark-profile") options.detailWatermarkProfile = next().trim();
    else if (arg === "--") continue;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.batchSize > 200) {
    throw new Error("--batch-size must be 200 or lower.");
  }
  if (options.assetConcurrency > 32) {
    throw new Error("--asset-concurrency/--concurrency must be 32 or lower.");
  }
  if (options.uploadConcurrency > 64) {
    throw new Error("--upload-concurrency must be 64 or lower.");
  }
  if (!options.prefix) throw new Error("--prefix is required.");
  if (!isAllowedDerivativePrefix(options.prefix)) {
    throw new Error("--prefix must stay under previews/watermarked.");
  }
  if (!options.detailWatermarkProfile) throw new Error("--watermark-profile / detail profile cannot be empty.");

  return options;
}

function printHelp() {
  console.log(`
Generate Fotocorp WebP preview derivatives: thumb and card are clean (no tiled watermark); detail is watermarked. Objects stay under previews/watermarked/<variant>/… for URL stability.

Examples:
  pnpm --dir apps/api media:generate-derivatives -- --dry-run --limit 1000
  pnpm --dir apps/api media:generate-derivatives -- --limit 500 --batch-size 100 --concurrency 6
  pnpm --dir apps/api media:generate-derivatives -- --asset-id <uuid> --force
  pnpm --dir apps/api media:generate-derivatives -- --dry-run --force --variants thumb,card --limit 50

Options:
  --limit <n>
  --batch-size <n>
  --concurrency <n> (alias for --asset-concurrency)
  --asset-concurrency <n>
  --upload-concurrency <n>
  --r2-retry-attempts <n>
  --r2-retry-base-ms <n>
  --max-runtime-minutes <n>
  --report-file <path>
  --variant <thumb|card|detail>
  --variants <thumb,card,detail>
  --scope <public-ready|all-verified>
  --asset-id <uuid>
  --force
  --dry-run
  --fail-on-item-errors
  --retry-failed
  --no-retry-failed
  --verbose-errors
  --watermark-profile <name>  (detail / watermarked variant only; default ${DETAIL_WATERMARKED_PROFILE})
`);
}

function parseVariants(value: string) {
  const variants = value.split(",").map((item) => parseVariant(item.trim()));
  return [...new Set(variants)];
}

function parseVariant(value: string): Variant {
  if (VARIANTS.includes(value as Variant)) return value as Variant;
  throw new Error(`Unsupported variant '${value}'. Expected one of: ${VARIANTS.join(", ")}`);
}

function parseScope(value: string): CliOptions["scope"] {
  if (value === "public-ready" || value === "all-verified") return value;
  throw new Error("Unsupported --scope. Expected one of: public-ready, all-verified");
}

function parsePositiveInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer.`);
  return parsed;
}

function parseUuid(value: string, name: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`--${name} must be a UUID.`);
  }
  return value;
}

function getR2Config(): R2Config {
  const accountId = optionalEnv(["CLOUDFLARE_R2_ACCOUNT_ID", "R2_ACCOUNT_ID"]);
  const originalsBucket = optionalEnv(["CLOUDFLARE_R2_ORIGINALS_BUCKET", "R2_ORIGINALS_BUCKET"]);
  const previewsBucket = optionalEnv(["CLOUDFLARE_R2_PREVIEWS_BUCKET", "R2_PREVIEWS_BUCKET"]);
  const accessKeyId = optionalEnv(["CLOUDFLARE_R2_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID"]);
  const secretAccessKey = optionalEnv(["CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY"]);
  const legacyBucket = optionalEnv(["CLOUDFLARE_R2_BUCKET", "R2_BUCKET_NAME"]);
  const missing = [
    ["CLOUDFLARE_R2_ACCOUNT_ID or R2_ACCOUNT_ID", accountId],
    ["CLOUDFLARE_R2_ORIGINALS_BUCKET or R2_ORIGINALS_BUCKET", originalsBucket],
    ["CLOUDFLARE_R2_PREVIEWS_BUCKET or R2_PREVIEWS_BUCKET", previewsBucket],
    ["CLOUDFLARE_R2_ACCESS_KEY_ID or R2_ACCESS_KEY_ID", accessKeyId],
    ["CLOUDFLARE_R2_SECRET_ACCESS_KEY or R2_SECRET_ACCESS_KEY", secretAccessKey],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (legacyBucket) {
    console.warn("CLOUDFLARE_R2_BUCKET/R2_BUCKET_NAME is deprecated for derivative generation; use explicit originals and previews bucket variables.");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required R2 environment variables: ${missing.join(", ")}`);
  }

  return {
    accountId,
    originalsBucket,
    previewsBucket,
    accessKeyId,
    secretAccessKey,
    endpoint: optionalEnv(["CLOUDFLARE_R2_ENDPOINT", "R2_ENDPOINT"]) || `https://${accountId}.r2.cloudflarestorage.com`,
    region: optionalEnv(["CLOUDFLARE_R2_REGION", "R2_REGION"]) || "auto",
  };
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

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

function normalizePrefix(prefix: string) {
  return prefix.trim().replace(/^\/+|\/+$/g, "");
}

function isAllowedDerivativePrefix(prefix: string) {
  const normalized = normalizePrefix(prefix);
  return normalized === "previews/watermarked" || normalized.startsWith("previews/watermarked/");
}

function derivativeIdentity(assetId: string, variant: Variant) {
  return `${assetId}:${variant.toLowerCase()}`;
}

function hashHex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function getSignatureKey(secret: string, dateStamp: string, region: string, service: string) {
  const dateKey = hmac(`AWS4${secret}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function withDbRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { retries?: number },
): Promise<T> {
  const retries = options?.retries ?? envNumber("MEDIA_DERIVATIVE_DB_RETRIES", DB_MAX_ATTEMPTS - 1);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isTransientDbError(error) || attempt === retries) {
        throw error;
      }

      const delayMs = dbRetryDelayMs(attempt);
      const errorInfo = dbErrorInfo(error);
      console.warn("[db.retry]", {
        label,
        attempt: attempt + 1,
        retries,
        delayMs,
        code: errorInfo.code,
        hostname: errorInfo.hostname,
        message: errorMessage(error),
      });

      await sleep(delayMs);
    }
  }

  throw lastError;
}

function isTransientDbError(error: unknown) {
  const info = dbErrorInfo(error);
  const message = info.message.toLowerCase();
  return (
    (info.code !== undefined && TRANSIENT_DB_ERROR_CODES.has(info.code)) ||
    message.includes("getaddrinfo") ||
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("connection terminated") ||
    message.includes("timeout") ||
    message.includes("terminating connection") ||
    message.includes("connection reset")
  );
}

function dbErrorInfo(error: unknown) {
  const record = errorRecord(error);
  const causeRecord = errorRecord(record?.cause);
  const message = errorMessage(error);
  const code = stringField(record, "code") ?? stringField(causeRecord, "code");
  const hostname = stringField(record, "hostname") ?? stringField(causeRecord, "hostname");

  return { code, hostname, message };
}

function errorRecord(error: unknown): Record<string, unknown> | undefined {
  if (typeof error === "object" && error !== null) return error as Record<string, unknown>;
  return undefined;
}

function stringField(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

function dbRetryDelayMs(attempt: number) {
  const baseMs = envNumber("MEDIA_DERIVATIVE_DB_RETRY_BASE_MS", DB_BACKOFF_BASE_MS);
  const maxMs = envNumber("MEDIA_DERIVATIVE_DB_RETRY_MAX_MS", DB_BACKOFF_MAX_MS);
  const exponential = Math.min(maxMs, baseMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 250);
  return exponential + jitter;
}

function getFailureLogPath() {
  return process.env.MEDIA_DERIVATIVE_FAILURE_LOG_PATH ??
    `logs/media-derivative-generation-failures-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
}

async function appendJsonl(filePath: string, payload: unknown) {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

async function logDerivativeFailure(
  failureLogPath: string,
  input: {
    options: CliOptions;
    asset: AssetRow;
    derivativeKey: string;
    variant?: Variant;
    stage: string;
    reason: string;
    errorClass: ErrorClass;
    error: unknown;
  },
) {
  const shortErrorMessage = truncateErrorMessage(errorMessage(input.error));
  await appendJsonl(failureLogPath, {
    type: "derivative_generation_failure",
    timestamp: new Date().toISOString(),
    assetId: input.asset.id,
    legacyImageCode: input.asset.legacy_image_code,
    fotokey: input.asset.fotokey,
    originalStorageKey: input.asset.original_storage_key,
    derivativeR2Key: input.derivativeKey,
    variant: input.variant,
    stage: input.stage,
    reason: input.reason,
    errorClass: input.errorClass,
    errorCode: dbErrorInfo(input.error).code,
    errorMessage: shortErrorMessage,
    stack: input.options.verboseErrors && input.error instanceof Error ? input.error.stack : undefined,
  });
}

function printCheckpoint(
  options: CliOptions,
  counters: Counters,
  failureLogPath: string,
  startedAt: Date,
) {
  const elapsedMinutes = elapsedMsSince(startedAt) / 60_000;
  const variantsPerMinute = elapsedMinutes > 0 ? counters.processedVariants / elapsedMinutes : 0;
  const remainingVariants = Math.max(counters.selectedVariants - counters.processedVariants, 0);
  const estimatedRemainingMinutes = variantsPerMinute > 0 ? remainingVariants / variantsPerMinute : null;
  console.log("[checkpoint]", {
    limit: options.limit ?? "all",
    selectedAssets: counters.selectedAssets,
    selectedVariants: counters.selectedVariants,
    processedAssets: counters.processedAssets,
    processedVariants: counters.processedVariants,
    generatedVariants: counters.generatedVariants,
    failedVariants: counters.failedVariants,
    skippedReady: counters.skippedReady,
    regeneratedFailed: counters.regeneratedFailed,
    elapsedMinutes: Number(elapsedMinutes.toFixed(2)),
    variantsPerMinute: Number(variantsPerMinute.toFixed(2)),
    estimatedRemainingMinutes: estimatedRemainingMinutes === null ? null : Number(estimatedRemainingMinutes.toFixed(2)),
    corruptOriginalAssets: counters.corruptOriginalAssets,
    unsupportedImageAssets: counters.unsupportedImageAssets,
    r2ReadFailures: counters.r2ReadFailures,
    r2UploadFailures: counters.r2UploadFailures,
    dbWriteFailures: counters.dbWriteFailures,
    failureLogPath,
  });
}

async function decodeSourceImage(source: Buffer): Promise<Buffer> {
  return sharp(source, { failOn: "none", limitInputPixels: DEFAULT_LIMIT_INPUT_PIXELS })
    .rotate()
    .toBuffer();
}

function classifyGenerationError(error: unknown, stage: string): ErrorClass {
  if (stage === "source_read") return "R2_READ_ERROR";
  if (stage === "db_update") return "DB_WRITE_ERROR";

  const msg = errorMessage(error).toLowerCase();
  if (
    msg.includes("vipsjpeg: corrupt jpeg") ||
    msg.includes("corrupt jpeg") ||
    msg.includes("found marker") ||
    msg.includes("instead of rst")
  ) return "CORRUPT_ORIGINAL";

  if (
    msg.includes("unsupported image format") ||
    msg.includes("unsupported input") ||
    msg.includes("unsupported") ||
    msg.includes("input file is missing")
  ) return "UNSUPPORTED_IMAGE";

  if (msg.includes("r2 get failed")) return "R2_READ_ERROR";
  if (msg.includes("r2 put failed")) return "R2_UPLOAD_ERROR";
  if (msg.includes("insert into image_derivatives") || msg.includes("update image_derivatives")) return "DB_WRITE_ERROR";
  return "UNKNOWN_GENERATION_ERROR";
}

function truncateErrorMessage(message: string, maxLength = 240): string {
  if (message.length <= maxLength) return message;
  return `${message.slice(0, maxLength - 3)}...`;
}

function envNumber(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function printStartup(options: CliOptions, failureLogPath: string, checkpointEvery: number) {
  console.log(
    `Derivative generation dryRun=${options.dryRun} scope=${options.scope} variants=${options.variants.join(",")} limit=${options.limit ?? "all"} batchSize=${options.batchSize} assetConcurrency=${options.assetConcurrency} uploadConcurrency=${options.uploadConcurrency} r2RetryAttempts=${options.r2RetryAttempts} r2RetryBaseMs=${options.r2RetryBaseMs} maxRuntimeMinutes=${options.maxRuntimeMinutes ?? "none"} reportFile=${options.reportFile ?? "none"} prefix=${options.prefix} retryFailed=${options.retryFailed} failOnItemErrors=${options.failOnItemErrors} force=${options.force} detailWatermarkProfile=${options.detailWatermarkProfile} checkpointEvery=${checkpointEvery} failureLogPath=${failureLogPath}`,
  );
  console.log("Variant policy: thumb=clean, card=clean, detail=watermarked");
  console.log(
    `Stored profiles: thumb=${THUMB_CLEAN_PROFILE} card=${CARD_CLEAN_PROFILE} detail=${options.detailWatermarkProfile}`,
  );
}

function printSummary(summary: RunSummary, failureLogPath: string) {
  console.log("Derivative generation summary:");
  console.table({
    selectedAssets: summary.selectedAssets,
    selectedVariants: summary.selectedVariants,
    processedAssets: summary.processedAssets,
    processedVariants: summary.processedVariants,
    generatedVariants: summary.generatedVariants,
    failedVariants: summary.failedVariants,
    skippedReady: summary.skippedReady,
    regeneratedFailed: summary.regeneratedFailed,
    durationMs: summary.durationMs,
    assetsPerMinute: Number(summary.throughput.assetsPerMinute.toFixed(2)),
    variantsPerMinute: Number(summary.throughput.variantsPerMinute.toFixed(2)),
    averageR2ReadMs: Number(summary.timing.averageR2ReadMs.toFixed(2)),
    averageSourceDecodeMs: Number(summary.timing.averageSourceDecodeMs.toFixed(2)),
    averageSharpTransformMs: Number(summary.timing.averageSharpTransformMs.toFixed(2)),
    averageR2UploadMs: Number(summary.timing.averageR2UploadMs.toFixed(2)),
    averageDbWriteMs: Number(summary.timing.averageDbWriteMs.toFixed(2)),
    totalR2ReadMs: Number(summary.timing.totalR2ReadMs.toFixed(2)),
    totalTransformMs: Number(summary.timing.totalSharpTransformMs.toFixed(2)),
    totalUploadMs: Number(summary.timing.totalR2UploadMs.toFixed(2)),
    totalDbWriteMs: Number(summary.timing.totalDbWriteMs.toFixed(2)),
    corruptOriginalAssets: summary.failureCounts.corruptOriginalAssets,
    unsupportedImageAssets: summary.failureCounts.unsupportedImageAssets,
    r2ReadFailures: summary.failureCounts.r2ReadFailures,
    r2UploadFailures: summary.failureCounts.r2UploadFailures,
    dbWriteFailures: summary.failureCounts.dbWriteFailures,
    failureLogPath,
  });
}

function buildRunSummary(
  counters: Counters,
  options: CliOptions,
  failureLogPath: string,
  startedAt: Date,
  finishedAt: Date,
): RunSummary {
  const durationMs = Math.max(finishedAt.getTime() - startedAt.getTime(), 1);
  const durationMinutes = durationMs / 60_000;
  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    selectedAssets: counters.selectedAssets,
    selectedVariants: counters.selectedVariants,
    processedAssets: counters.processedAssets,
    processedVariants: counters.processedVariants,
    generatedVariants: counters.generatedVariants,
    failedVariants: counters.failedVariants,
    skippedReady: counters.skippedReady,
    regeneratedFailed: counters.regeneratedFailed,
    throughput: {
      assetsPerMinute: counters.processedAssets / durationMinutes,
      variantsPerMinute: counters.processedVariants / durationMinutes,
    },
    timing: {
      averageR2ReadMs: safeAvg(counters.totalR2ReadMs, counters.r2ReadCount),
      averageSourceDecodeMs: safeAvg(counters.totalSourceDecodeMs, counters.sourceDecodeCount),
      averageSharpTransformMs: safeAvg(counters.totalSharpTransformMs, counters.transformCount),
      averageR2UploadMs: safeAvg(counters.totalR2UploadMs, counters.uploadCount),
      averageDbWriteMs: safeAvg(counters.totalDbWriteMs, counters.dbWriteCount),
      totalR2ReadMs: counters.totalR2ReadMs,
      totalSourceDecodeMs: counters.totalSourceDecodeMs,
      totalSharpTransformMs: counters.totalSharpTransformMs,
      totalR2UploadMs: counters.totalR2UploadMs,
      totalDbWriteMs: counters.totalDbWriteMs,
    },
    failureCounts: {
      corruptOriginalAssets: counters.corruptOriginalAssets,
      unsupportedImageAssets: counters.unsupportedImageAssets,
      r2ReadFailures: counters.r2ReadFailures,
      r2UploadFailures: counters.r2UploadFailures,
      dbWriteFailures: counters.dbWriteFailures,
      failedVariants: counters.failedVariants,
    },
    config: {
      scope: options.scope,
      limit: options.limit ?? null,
      batchSize: options.batchSize,
      assetConcurrency: options.assetConcurrency,
      uploadConcurrency: options.uploadConcurrency,
      r2RetryAttempts: options.r2RetryAttempts,
      r2RetryBaseMs: options.r2RetryBaseMs,
      maxRuntimeMinutes: options.maxRuntimeMinutes ?? null,
      failOnItemErrors: options.failOnItemErrors,
      dryRun: options.dryRun,
      variants: options.variants,
      variantPolicy: "thumb=clean, card=clean, detail=watermarked",
      thumbDerivativeProfile: THUMB_CLEAN_PROFILE,
      cardDerivativeProfile: CARD_CLEAN_PROFILE,
      detailWatermarkProfile: options.detailWatermarkProfile,
    },
  };
}

async function writeReportFile(filePath: string, summary: RunSummary) {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(summary, null, 2), "utf8");
}

function elapsedMsSince(startedAt: Date) {
  return Date.now() - startedAt.getTime();
}

function hasRuntimeLimitElapsed(maxRuntimeMinutes: number | undefined, startedAt: Date) {
  if (!maxRuntimeMinutes || maxRuntimeMinutes <= 0) return false;
  return elapsedMsSince(startedAt) >= maxRuntimeMinutes * 60_000;
}

function safeAvg(total: number, count: number) {
  if (count <= 0) return 0;
  return total / count;
}

async function withR2Retry<T>(label: string, options: CliOptions, fn: () => Promise<T>): Promise<T> {
  const attempts = Math.max(options.r2RetryAttempts, 1);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientR2Error(error) || attempt >= attempts) throw error;
      const jitter = Math.floor(Math.random() * 150);
      const delayMs = options.r2RetryBaseMs * 2 ** (attempt - 1) + jitter;
      console.warn("[r2.retry]", { label, attempt, attempts, delayMs, message: errorMessage(error) });
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function isTransientR2Error(error: unknown) {
  const msg = errorMessage(error).toLowerCase();
  if (msg.includes("r2 get failed with status 408") || msg.includes("r2 put failed with status 408")) return true;
  if (msg.includes("r2 get failed with status 429") || msg.includes("r2 put failed with status 429")) return true;
  if (/r2 (get|put) failed with status 5\\d\\d/.test(msg)) return true;
  return (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("eai_again") ||
    msg.includes("enotfound")
  );
}

function chunkAssets<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
