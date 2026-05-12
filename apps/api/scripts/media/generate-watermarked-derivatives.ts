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
import { CURRENT_WATERMARK_PROFILE } from "../../src/lib/media/watermark";

type Variant = "thumb" | "card" | "detail";
type GenerationStatus = "READY" | "FAILED" | "STALE";
type GenerateReason =
  | "new"
  | "force"
  | "missing-object"
  | "failed"
  | "not-ready"
  | "profile-changed"
  | "not-watermarked";

interface CliOptions {
  limit?: number;
  offset: number;
  batchSize: number;
  variants: Variant[];
  assetId?: string;
  force: boolean;
  dryRun: boolean;
  onlyMissing: boolean;
  retryFailed: boolean;
  prefix: string;
  skipReadyHeadCheck: boolean;
  regenerateProfile: boolean;
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
  r2_original_key: string;
  legacy_imagecode: string | null;
}

interface ExistingDerivativeRow {
  asset_id: string;
  variant: Variant;
  r2_key: string;
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
  processed: number;
  generated: number;
  skippedReady: number;
  regeneratedMissingObject: number;
  regeneratedFailed: number;
  regeneratedProfileChanged: number;
  failed: number;
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

loadLocalEnv();

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = requiredEnv("DATABASE_URL");
  const pool = createScriptPool(databaseUrl);
  const failureLogPath = getFailureLogPath();
  const checkpointEvery = envNumber("MEDIA_DERIVATIVE_CHECKPOINT_EVERY", 100);
  let nextCheckpointAt = checkpointEvery;

  const counters: Counters = {
    selectedAssets: 0,
    selectedVariants: 0,
    processed: 0,
    generated: 0,
    skippedReady: 0,
    regeneratedMissingObject: 0,
    regeneratedFailed: 0,
    regeneratedProfileChanged: 0,
    failed: 0,
  };

  try {
    const r2Config = options.dryRun ? null : getR2Config();
    printStartup(options, failureLogPath, checkpointEvery);
    await preflightDatabase(pool, databaseUrl);
    const assets = await selectAssets(pool, options);
    counters.selectedAssets = assets.length;
    counters.selectedVariants = assets.length * options.variants.length;
    console.log(`Selected assets: ${assets.length}`);

    if (assets.length === 0) return;

    for (let index = 0; index < assets.length; index += options.batchSize) {
      const batch = assets.slice(index, index + options.batchSize);
      const existing = await getExistingDerivatives(pool, batch.map((asset) => asset.id), options.variants);

      await Promise.all(
        batch.map((asset) => processAsset(pool, r2Config, options, counters, asset, existing, failureLogPath)),
      );

      console.log(
        `Progress offset=${options.offset} limit=${options.limit ?? "all"} processed=${counters.processed} generated=${counters.generated} skippedReady=${counters.skippedReady} regeneratedMissingObject=${counters.regeneratedMissingObject} regeneratedFailed=${counters.regeneratedFailed} regeneratedProfileChanged=${counters.regeneratedProfileChanged} failed=${counters.failed}`,
      );
      while (checkpointEvery > 0 && counters.processed >= nextCheckpointAt) {
        printCheckpoint(options, counters, failureLogPath);
        nextCheckpointAt += checkpointEvery;
      }
    }
  } finally {
    await pool.end();
    printSummary(counters, failureLogPath);
  }

  if (counters.failed > 0) {
    console.warn(`[done_with_failures] ${counters.failed} failures logged to ${failureLogPath}`);
    process.exitCode = 1;
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
  for (const variant of options.variants) {
    let derivativeKey = "";
    let previewObjectId = "";
    const existingDerivative = existing.get(derivativeIdentity(asset.id, variant));

    counters.processed += 1;

    try {
      previewObjectId = getPreviewObjectId(asset);
      derivativeKey = buildDerivativeR2Key({ prefix: options.prefix, variant, objectId: previewObjectId });

      if (options.dryRun) {
        const dryRunDecision = await decideDerivativeAction(r2Config, options, existingDerivative);
        if (dryRunDecision.action === "skip") {
          counters.skippedReady += 1;
          console.log("dry-run derivative_decision", {
            assetId: asset.id,
            preview_object_id: previewObjectId,
            variant,
            action: "would-skip",
            reason: "ready-derivative-exists",
            oldR2Key: existingDerivative?.r2_key,
            newR2Key: derivativeKey,
          });
        } else {
          countRegenerationReason(counters, dryRunDecision.reason);
          console.log("dry-run derivative_decision", {
            assetId: asset.id,
            preview_object_id: previewObjectId,
            variant,
            action: "would-generate",
            reason: dryRunDecision.reason,
            oldR2Key: existingDerivative?.r2_key,
            newR2Key: derivativeKey,
          });
        }
        continue;
      }

      if (!r2Config) {
        throw new Error("R2 config is required outside dry-run mode.");
      }

      const decision = await decideDerivativeAction(r2Config, options, existingDerivative);
      if (decision.action === "skip") {
        counters.skippedReady += 1;
        console.log("skip derivative_generation", {
          assetId: asset.id,
          preview_object_id: previewObjectId,
          variant,
          reason: "ready-object-exists",
          oldR2Key: existingDerivative?.r2_key,
          newR2Key: derivativeKey,
        });
        continue;
      }

      countRegenerationReason(counters, decision.reason);
      const original = await r2GetObject(r2Config, r2Config.originalsBucket, asset.r2_original_key);
      const generated = await generateDerivative(original, derivativeKey, variant, asset.id, previewObjectId);
      await r2PutObject(r2Config, r2Config.previewsBucket, generated.key, generated.buffer, MIME_TYPE);
      try {
        await upsertDerivative(pool, asset.id, variant, generated, "READY");
      } catch (error) {
        counters.failed += 1;
        await logDerivativeFailure(failureLogPath, {
          asset,
          derivativeKey,
          variant,
          stage: "db_update",
          reason: "generated_object_db_update_failed",
          error,
        });
        console.error("failed derivative_generation", {
          assetId: asset.id,
          preview_object_id: previewObjectId,
          legacyImagecode: asset.legacy_imagecode,
          originalR2Key: asset.r2_original_key,
          derivativeR2Key: derivativeKey,
          variant,
          reason: "generated_object_db_update_failed",
          error: errorMessage(error),
        });
        continue;
      }
      counters.generated += 1;
      console.log("generated derivative_generation", {
        assetId: asset.id,
        preview_object_id: previewObjectId,
        variant,
        reason: decision.reason,
        oldR2Key: existingDerivative?.r2_key,
        newR2Key: generated.key,
        outputBytes: generated.byteSize,
        selectedWebpQuality: generated.selectedQuality,
        targetReached: generated.targetReached,
      });
    } catch (error) {
      counters.failed += 1;
      await logDerivativeFailure(failureLogPath, {
        asset,
        derivativeKey,
        variant,
        stage: "generation",
        reason: "generation_error",
        error,
      });
      if (derivativeKey) {
        await markDerivativeFailed(pool, asset.id, variant, derivativeKey).catch(async (markError) => {
          await logDerivativeFailure(failureLogPath, {
            asset,
            derivativeKey,
            variant,
            stage: "db_update",
            reason: "failure_status_update_failed",
            error: markError,
          });
        });
      }
      console.error("failed derivative_generation", {
        assetId: asset.id,
        preview_object_id: previewObjectId || undefined,
        legacyImagecode: asset.legacy_imagecode,
        originalR2Key: asset.r2_original_key,
        derivativeR2Key: derivativeKey || undefined,
        variant,
        reason: "generation_error",
        error: errorMessage(error),
      });
    }
  }
}

function createScriptPool(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: envNumber("MEDIA_DERIVATIVE_DB_POOL_MAX", 3),
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
  const params: unknown[] = [];
  const where = [
    "media_type = 'IMAGE'",
    "r2_exists = true",
    "r2_original_key is not null",
    "status = 'APPROVED'",
    "visibility = 'PUBLIC'",
  ];

  if (options.assetId) {
    params.push(options.assetId);
    where.push(`id = $${params.length}`);
  }

  if (options.retryFailed) {
    params.push(options.variants);
    where.push(`
      exists (
        select 1
        from asset_media_derivatives failed_derivative
        where failed_derivative.asset_id = assets.id
          and failed_derivative.variant = any($${params.length}::text[])
          and failed_derivative.generation_status = 'FAILED'
      )
    `);
  }

  const limitOffset = [];
  if (options.limit !== undefined) {
    params.push(options.limit);
    limitOffset.push(`limit $${params.length}`);
  }
  if (options.offset > 0) {
    params.push(options.offset);
    limitOffset.push(`offset $${params.length}`);
  }

  const result = await dbQuery<AssetRow>(
    pool,
    "selectAssets",
    `
      select id, r2_original_key, legacy_imagecode
      from assets
      where ${where.join(" and ")}
      order by created_at asc, id asc
      ${limitOffset.join(" ")}
    `,
    params,
  );

  return result.rows;
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
      select asset_id, variant, r2_key, is_watermarked, watermark_profile, generation_status
      from asset_media_derivatives
      where asset_id = any($1::uuid[])
        and variant = any($2::text[])
    `,
    [assetIds, variants],
  );

  return new Map(result.rows.map((row) => [derivativeIdentity(row.asset_id, row.variant), row]));
}

async function decideDerivativeAction(
  r2Config: R2Config | null,
  options: CliOptions,
  existingDerivative: ExistingDerivativeRow | undefined,
): Promise<{ action: "skip" } | { action: "generate"; reason: GenerateReason }> {
  if (options.force) return { action: "generate", reason: "force" };
  if (!existingDerivative) return { action: "generate", reason: "new" };
  if (options.regenerateProfile && existingDerivative.watermark_profile !== CURRENT_WATERMARK_PROFILE) {
    return { action: "generate", reason: "profile-changed" };
  }
  if (!existingDerivative.is_watermarked) return { action: "generate", reason: "not-watermarked" };
  if (existingDerivative.watermark_profile !== CURRENT_WATERMARK_PROFILE) {
    return { action: "generate", reason: "profile-changed" };
  }
  if (existingDerivative.generation_status === "FAILED") return { action: "generate", reason: "failed" };
  if (existingDerivative.generation_status !== "READY") return { action: "generate", reason: "not-ready" };
  if (options.skipReadyHeadCheck || !r2Config) return { action: "skip" };

  const exists = await r2HeadObject(r2Config, r2Config.previewsBucket, existingDerivative.r2_key);
  return exists ? { action: "skip" } : { action: "generate", reason: "missing-object" };
}

function countRegenerationReason(counters: Counters, reason: GenerateReason) {
  if (reason === "missing-object") counters.regeneratedMissingObject += 1;
  else if (reason === "failed") counters.regeneratedFailed += 1;
  else if (reason === "profile-changed") counters.regeneratedProfileChanged += 1;
}

async function generateDerivative(
  original: Buffer,
  key: string,
  variant: Variant,
  assetId?: string,
  previewObjectId?: string,
): Promise<GeneratedDerivative> {
  const profile = PREVIEW_VARIANT_PROFILES[variant];
  const metadata = await sharp(original, { failOn: "none" }).metadata();
  const targetWidth = metadata.width ? Math.min(metadata.width, profile.width) : profile.width;
  let bestCandidate: GeneratedDerivativeCandidate | undefined;

  for (const quality of profile.qualities) {
    const candidate = await renderWatermarkedPreview(original, targetWidth, quality);
    if (!bestCandidate || candidate.byteSize < bestCandidate.byteSize) {
      bestCandidate = candidate;
    }

    if (!profile.targetMaxBytes || candidate.byteSize <= profile.targetMaxBytes) {
      return buildGeneratedDerivative(key, candidate, true);
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

  return buildGeneratedDerivative(key, bestCandidate, false);
}

async function renderWatermarkedPreview(
  original: Buffer,
  targetWidth: number,
  quality: number,
): Promise<GeneratedDerivativeCandidate> {
  const resized = await sharp(original, { failOn: "none" })
    .rotate()
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
  candidate: GeneratedDerivativeCandidate,
  targetReached: boolean,
): GeneratedDerivative {
  return {
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

async function upsertDerivative(
  pool: PgPool,
  assetId: string,
  variant: Variant,
  derivative: GeneratedDerivative,
  status: GenerationStatus,
) {
  await dbQuery(
    pool,
    "insertDerivative",
    `
      insert into asset_media_derivatives (
        asset_id,
        variant,
        r2_key,
        mime_type,
        width,
        height,
        byte_size,
        checksum,
        is_watermarked,
        watermark_profile,
        generation_status,
        generated_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, now(), now())
      on conflict (asset_id, variant) do update
      set
        r2_key = excluded.r2_key,
        mime_type = excluded.mime_type,
        width = excluded.width,
        height = excluded.height,
        byte_size = excluded.byte_size,
        checksum = excluded.checksum,
        is_watermarked = true,
        watermark_profile = excluded.watermark_profile,
        generation_status = excluded.generation_status,
        generated_at = excluded.generated_at,
        updated_at = now()
    `,
    [
      assetId,
      variant,
      derivative.key,
      MIME_TYPE,
      derivative.width,
      derivative.height,
      derivative.byteSize,
      derivative.checksum,
      CURRENT_WATERMARK_PROFILE,
      status,
    ],
  );
}

async function markDerivativeFailed(
  pool: PgPool,
  assetId: string,
  variant: Variant,
  derivativeKey: string,
) {
  await dbQuery(
    pool,
    "updateDerivativeStatus",
    `
      insert into asset_media_derivatives (
        asset_id,
        variant,
        r2_key,
        mime_type,
        is_watermarked,
        watermark_profile,
        generation_status,
        updated_at
      )
      values ($1, $2, $3, $4, true, $5, 'FAILED', now())
      on conflict (asset_id, variant) do update
      set
        generation_status = 'FAILED',
        updated_at = now()
    `,
    [assetId, variant, derivativeKey, MIME_TYPE, CURRENT_WATERMARK_PROFILE],
  );
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

async function r2HeadObject(config: R2Config, bucket: string, key: string): Promise<boolean> {
  const response = await signedR2Request(config, bucket, "HEAD", key);
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`R2 HEAD failed with status ${response.status}`);
  return true;
}

async function signedR2Request(
  config: R2Config,
  bucket: string,
  method: "GET" | "PUT" | "HEAD",
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
  const legacyImagecode = asset.legacy_imagecode?.trim();
  if (legacyImagecode) return legacyImagecode;

  const originalR2Key = asset.r2_original_key?.trim();
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
    offset: 0,
    batchSize: 25,
    variants: ["card"],
    force: false,
    dryRun: false,
    onlyMissing: true,
    retryFailed: false,
    prefix: "previews/watermarked",
    skipReadyHeadCheck: false,
    regenerateProfile: false,
  };
  let variantsExplicit = false;

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
    else if (arg === "--offset") options.offset = parseNonNegativeInteger(next(), "offset");
    else if (arg === "--batch-size") options.batchSize = parsePositiveInteger(next(), "batch-size");
    else if (arg === "--variant") {
      options.variants = [parseVariant(next())];
      variantsExplicit = true;
    }
    else if (arg === "--variants") {
      options.variants = parseVariants(next());
      variantsExplicit = true;
    }
    else if (arg === "--asset-id") options.assetId = parseUuid(next(), "asset-id");
    else if (arg === "--force") {
      options.force = true;
      options.onlyMissing = false;
    } else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--only-missing") options.onlyMissing = true;
    else if (arg === "--no-only-missing") options.onlyMissing = false;
    else if (arg === "--retry-failed") {
      options.retryFailed = true;
      options.onlyMissing = false;
    }
    else if (arg === "--prefix") options.prefix = normalizePrefix(next());
    else if (arg === "--skip-ready-head-check") options.skipReadyHeadCheck = true;
    else if (arg === "--regenerate-profile") {
      options.regenerateProfile = true;
      options.onlyMissing = false;
      if (!variantsExplicit) options.variants = VARIANTS;
    }
    else if (arg === "--") continue;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.batchSize > 50) {
    throw new Error("--batch-size must be 50 or lower to avoid loading too many images concurrently.");
  }
  if (!options.prefix) throw new Error("--prefix is required.");
  if (!isAllowedDerivativePrefix(options.prefix)) {
    throw new Error("--prefix must stay under previews/watermarked.");
  }

  return options;
}

function printHelp() {
  console.log(`
Generate Fotocorp watermarked WebP preview derivatives.

Examples:
  pnpm --dir apps/api media:generate-derivatives -- --offset 0 --limit 100 --regenerate-profile
  pnpm --dir apps/api media:generate-derivatives -- --offset 0 --limit 5000 --regenerate-profile

Options:
  --limit <n>
  --offset <n>
  --batch-size <n>
  --variant <thumb|card|detail>
  --variants <thumb,card,detail>
  --asset-id <uuid>
  --force
  --dry-run
  --only-missing
  --no-only-missing
  --retry-failed
  --skip-ready-head-check
  --regenerate-profile
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

function parsePositiveInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer.`);
  return parsed;
}

function parseNonNegativeInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative integer.`);
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
  return `${assetId}:${variant}`;
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

      // Long-running local derivative jobs can hit temporary Neon DNS or
      // connection failures. Retrying DB boundaries keeps generated batches
      // moving without retrying expensive image/R2 work unnecessarily.
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
    asset: AssetRow;
    derivativeKey: string;
    variant: Variant;
    stage: string;
    reason: string;
    error: unknown;
  },
) {
  await appendJsonl(failureLogPath, {
    type: "derivative_generation_failure",
    timestamp: new Date().toISOString(),
    assetId: input.asset.id,
    legacyImagecode: input.asset.legacy_imagecode,
    originalR2Key: input.asset.r2_original_key,
    derivativeR2Key: input.derivativeKey,
    variant: input.variant,
    stage: input.stage,
    reason: input.reason,
    errorCode: dbErrorInfo(input.error).code,
    errorMessage: errorMessage(input.error),
    stack: input.error instanceof Error ? input.error.stack : undefined,
  });
}

function printCheckpoint(
  options: CliOptions,
  counters: Counters,
  failureLogPath: string,
) {
  console.log("[checkpoint]", {
    offset: options.offset,
    limit: options.limit ?? "all",
    processed: counters.processed,
    generated: counters.generated,
    skippedReady: counters.skippedReady,
    regeneratedMissingObject: counters.regeneratedMissingObject,
    regeneratedFailed: counters.regeneratedFailed,
    regeneratedProfileChanged: counters.regeneratedProfileChanged,
    failed: counters.failed,
    failureLogPath,
  });
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
    `Derivative generation dryRun=${options.dryRun} variants=${options.variants.join(",")} limit=${options.limit ?? "all"} offset=${options.offset} batchSize=${options.batchSize} prefix=${options.prefix} onlyMissing=${options.onlyMissing} retryFailed=${options.retryFailed} force=${options.force} regenerateProfile=${options.regenerateProfile} watermarkProfile=${CURRENT_WATERMARK_PROFILE} skipReadyHeadCheck=${options.skipReadyHeadCheck} checkpointEvery=${checkpointEvery} failureLogPath=${failureLogPath}`,
  );
}

function printSummary(counters: Counters, failureLogPath: string) {
  console.log("Derivative generation summary:");
  console.table({
    selectedAssets: counters.selectedAssets,
    selectedVariants: counters.selectedVariants,
    generated: counters.generated,
    skippedReady: counters.skippedReady,
    regeneratedMissingObject: counters.regeneratedMissingObject,
    regeneratedFailed: counters.regeneratedFailed,
    regeneratedProfileChanged: counters.regeneratedProfileChanged,
    failed: counters.failed,
    failureLogPath,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
