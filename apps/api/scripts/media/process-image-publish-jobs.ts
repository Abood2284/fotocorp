#!/usr/bin/env node
/**
 * PR-15.1 — Publish job processor (Node CLI in apps/api).
 *
 * **Production VPS path:** the same derivative + DB semantics are implemented in
 * `apps/jobs` (`ImagePublishProcessor`) for private Docker workers. Keep this script for
 * operator backfill / local runs against Neon + R2 when not using the jobs package.
 *
 * Reads queued items from `image_publish_jobs`/`image_publish_job_items`, generates required
 * watermarked WebP derivatives (THUMB/CARD/DETAIL) for each canonical Fotokey original, upserts
 * `image_derivatives`, and only then promotes the image asset to ACTIVE+PUBLIC.
 *
 * Lifecycle:
 *   pre-pipeline (admin approve): image_assets → APPROVED + PRIVATE, fotokey set, original copied
 *                                 to canonical originals bucket as FCddmmyyNNN.<ext>.
 *   this script:                  read canonical original → generate THUMB/CARD/DETAIL into the
 *                                 previews bucket → upsert image_derivatives → on success only
 *                                 set image_assets.status=ACTIVE, visibility=PUBLIC.
 *   on failure:                   leave image_assets APPROVED + PRIVATE, mark job item FAILED.
 *
 * No image is made public before all required derivatives are READY in image_derivatives.
 *
 * CLI:
 *   pnpm --dir apps/api media:process-image-publish-jobs -- --limit 25
 *   pnpm --dir apps/api media:process-image-publish-jobs -- --job-id <uuid>
 *   pnpm --dir apps/api media:process-image-publish-jobs -- --image-asset-id <uuid>
 *   pnpm --dir apps/api media:process-image-publish-jobs -- --dry-run
 */
import { createHash, createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import type { Pool as PgPool, QueryResultRow } from "pg";
import sharp from "sharp";
import { CURRENT_WATERMARK_PROFILE } from "../../src/lib/media/watermark";

type Variant = "THUMB" | "CARD" | "DETAIL";
type DerivativeStatus = "READY" | "STALE" | "FAILED";

interface CliOptions {
  limit: number;
  dryRun: boolean;
  jobId?: string;
  imageAssetId?: string;
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

interface JobItemRow extends QueryResultRow {
  item_id: string;
  job_id: string;
  image_asset_id: string;
  fotokey: string;
  canonical_original_key: string;
  source_storage_key: string;
  source_bucket: string;
  item_status: string;
  job_status: string;
  ia_status: string;
  ia_visibility: string;
  fotokey_assigned_at: Date | string | null;
}

interface PreviewVariantProfile {
  width: number;
  qualities: number[];
  targetMaxBytes?: number;
}

const PREVIEW_VARIANT_PROFILES: Record<Variant, PreviewVariantProfile> = {
  THUMB: { width: 220, qualities: [26, 22] },
  CARD: { width: 300, qualities: [14], targetMaxBytes: 22 * 1024 },
  DETAIL: { width: 520, qualities: [20, 16, 12], targetMaxBytes: 120 * 1024 },
};

const REQUIRED_VARIANTS: Variant[] = ["THUMB", "CARD", "DETAIL"];
const PREVIEW_KEY_PREFIX = "previews/watermarked";
const PREVIEW_MIME_TYPE = "image/webp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiRoot = resolve(__dirname, "../..");
const repoRoot = resolve(apiRoot, "../..");

loadLocalEnv();

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = requiredEnv("DATABASE_URL");
  const { Pool } = pg;
  const pool = new Pool({ connectionString: databaseUrl });
  const r2Config = options.dryRun ? null : getR2Config();

  const counters = { processed: 0, completed: 0, failed: 0 };

  try {
    const items = await selectQueuedItems(pool, options);
    console.log(
      `[publish-jobs] selected ${items.length} item(s) (dryRun=${options.dryRun}, limit=${options.limit}` +
        (options.jobId ? `, jobId=${options.jobId}` : "") +
        (options.imageAssetId ? `, imageAssetId=${options.imageAssetId}` : "") +
        ")",
    );

    if (items.length === 0) {
      console.log("[publish-jobs] nothing to do.");
      return;
    }

    if (options.dryRun) {
      for (const item of items) {
        console.log("[publish-jobs.dry-run] would process", {
          itemId: item.item_id,
          jobId: item.job_id,
          imageAssetId: item.image_asset_id,
          fotokey: item.fotokey,
          canonicalKey: item.canonical_original_key,
          itemStatus: item.item_status,
          jobStatus: item.job_status,
          imageAssetStatus: item.ia_status,
          imageAssetVisibility: item.ia_visibility,
        });
      }
      return;
    }

    if (!r2Config) throw new Error("R2 config is required outside dry-run mode.");

    const jobsTouched = new Set<string>();
    for (const item of items) {
      counters.processed += 1;
      jobsTouched.add(item.job_id);
      const ok = await processSingleItem(pool, r2Config, item);
      if (ok) counters.completed += 1;
      else counters.failed += 1;
    }

    for (const jobId of jobsTouched) {
      await reconcileJobAggregate(pool, jobId);
    }
  } finally {
    await pool.end();
    console.log(
      `[publish-jobs] summary processed=${counters.processed} completed=${counters.completed} failed=${counters.failed}`,
    );
  }

  if (counters.failed > 0) process.exitCode = 1;
}

async function selectQueuedItems(pool: PgPool, options: CliOptions): Promise<JobItemRow[]> {
  const filters: string[] = [];
  const params: unknown[] = [];

  filters.push(`(jpi.status in ('QUEUED', 'RUNNING'))`);
  if (options.jobId) {
    params.push(options.jobId);
    filters.push(`jpi.job_id = $${params.length}::uuid`);
  }
  if (options.imageAssetId) {
    params.push(options.imageAssetId);
    filters.push(`jpi.image_asset_id = $${params.length}::uuid`);
  }
  params.push(options.limit);
  const limitParam = `$${params.length}`;

  const result = await pool.query<JobItemRow>(
    `
      select
        jpi.id as item_id,
        jpi.job_id as job_id,
        jpi.image_asset_id as image_asset_id,
        jpi.fotokey as fotokey,
        jpi.canonical_original_key as canonical_original_key,
        jpi.source_storage_key as source_storage_key,
        jpi.source_bucket as source_bucket,
        jpi.status as item_status,
        ipj.status as job_status,
        ia.status as ia_status,
        ia.visibility as ia_visibility,
        ia.fotokey_assigned_at as fotokey_assigned_at
      from image_publish_job_items jpi
      join image_publish_jobs ipj on ipj.id = jpi.job_id
      join image_assets ia on ia.id = jpi.image_asset_id
      where ${filters.join(" and ")}
      order by jpi.created_at asc, jpi.id asc
      limit ${limitParam}
    `,
    params,
  );
  return result.rows;
}

async function processSingleItem(pool: PgPool, r2: R2Config, item: JobItemRow): Promise<boolean> {
  await pool.query(
    `update image_publish_job_items
     set status = 'RUNNING', started_at = coalesce(started_at, now()), updated_at = now()
     where id = $1::uuid and status in ('QUEUED', 'RUNNING')`,
    [item.item_id],
  );

  await pool.query(
    `update image_publish_jobs
     set status = case when status in ('QUEUED') then 'RUNNING' else status end,
         started_at = coalesce(started_at, now()),
         updated_at = now()
     where id = $1::uuid`,
    [item.job_id],
  );

  try {
    const original = await r2GetObject(r2, r2.originalsBucket, item.canonical_original_key);

    const generated: Record<Variant, GeneratedPreview> = {
      THUMB: await generateDerivative(original, "THUMB", item.fotokey),
      CARD: await generateDerivative(original, "CARD", item.fotokey),
      DETAIL: await generateDerivative(original, "DETAIL", item.fotokey),
    };

    for (const variant of REQUIRED_VARIANTS) {
      const built = generated[variant];
      const previewKey = buildDerivativeKey(variant, item.fotokey);
      await r2PutObject(r2, r2.previewsBucket, previewKey, built.buffer, PREVIEW_MIME_TYPE);
      await upsertDerivative(pool, item.image_asset_id, variant, previewKey, built, "READY");
    }

    await pool.query(
      `update image_assets
       set status = 'ACTIVE',
           visibility = 'PUBLIC',
           original_exists_in_storage = true,
           original_storage_checked_at = now(),
           updated_at = now()
       where id = $1::uuid
         and status = 'APPROVED'
         and visibility = 'PRIVATE'
         and fotokey is not null`,
      [item.image_asset_id],
    );

    await pool.query(
      `update image_publish_job_items
       set status = 'COMPLETED',
           failure_code = null,
           failure_message = null,
           completed_at = now(),
           updated_at = now()
       where id = $1::uuid`,
      [item.item_id],
    );

    console.log("[publish-jobs.complete]", {
      itemId: item.item_id,
      imageAssetId: item.image_asset_id,
      fotokey: item.fotokey,
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = errorCode(error);
    await pool.query(
      `update image_publish_job_items
       set status = 'FAILED',
           failure_code = $2,
           failure_message = $3,
           completed_at = now(),
           updated_at = now()
       where id = $1::uuid`,
      [item.item_id, code, truncate(message, 500)],
    );
    console.error("[publish-jobs.failed]", {
      itemId: item.item_id,
      imageAssetId: item.image_asset_id,
      fotokey: item.fotokey,
      code,
      message: truncate(message, 200),
    });
    return false;
  }
}

async function reconcileJobAggregate(pool: PgPool, jobId: string) {
  const result = await pool.query<{
    total: string;
    completed: string;
    failed: string;
    queued: string;
    running: string;
  }>(
    `
      select
        count(*)::text as total,
        count(*) filter (where status = 'COMPLETED')::text as completed,
        count(*) filter (where status = 'FAILED')::text as failed,
        count(*) filter (where status = 'QUEUED')::text as queued,
        count(*) filter (where status = 'RUNNING')::text as running
      from image_publish_job_items
      where job_id = $1::uuid
    `,
    [jobId],
  );
  const row = result.rows[0];
  if (!row) return;
  const total = Number(row.total) || 0;
  const completed = Number(row.completed) || 0;
  const failed = Number(row.failed) || 0;
  const queued = Number(row.queued) || 0;
  const running = Number(row.running) || 0;

  let status: string;
  if (queued > 0 || running > 0) status = "RUNNING";
  else if (failed === 0) status = "COMPLETED";
  else if (completed === 0) status = "FAILED";
  else status = "PARTIAL_FAILED";

  await pool.query(
    `update image_publish_jobs
     set status = $2,
         total_items = $3,
         completed_items = $4,
         failed_items = $5,
         completed_at = case when $2 in ('COMPLETED', 'FAILED', 'PARTIAL_FAILED') then now() else completed_at end,
         updated_at = now()
     where id = $1::uuid`,
    [jobId, status, total, completed, failed],
  );
}

interface GeneratedPreview {
  buffer: Buffer;
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
  selectedQuality: number;
}

async function generateDerivative(original: Buffer, variant: Variant, fotokey: string): Promise<GeneratedPreview> {
  const profile = PREVIEW_VARIANT_PROFILES[variant];
  const metadata = await sharp(original, { failOn: "none" }).metadata();
  const targetWidth = metadata.width ? Math.min(metadata.width, profile.width) : profile.width;
  let bestCandidate: GeneratedPreview | undefined;

  for (const quality of profile.qualities) {
    const candidate = await renderWatermarkedPreview(original, targetWidth, quality);
    if (!bestCandidate || candidate.byteSize < bestCandidate.byteSize) bestCandidate = candidate;
    if (!profile.targetMaxBytes || candidate.byteSize <= profile.targetMaxBytes) return candidate;
  }

  if (!bestCandidate) {
    throw new Error(`Unable to generate ${variant} derivative for ${fotokey}.`);
  }
  return bestCandidate;
}

async function renderWatermarkedPreview(original: Buffer, targetWidth: number, quality: number): Promise<GeneratedPreview> {
  const resized = await sharp(original, { failOn: "none" })
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const width = resized.info.width;
  const height = resized.info.height;
  if (!width || !height) throw new Error("Unable to determine derivative dimensions.");

  const watermark = Buffer.from(buildWatermarkSvg(width, height));
  const encoded = await sharp(resized.data, { failOn: "none" })
    .composite([{ input: watermark, top: 0, left: 0 }])
    .webp({ quality, effort: 6, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: encoded.data,
    width: encoded.info.width ?? width,
    height: encoded.info.height ?? height,
    byteSize: encoded.data.byteLength,
    checksum: createHash("sha256").update(encoded.data).digest("hex"),
    selectedQuality: quality,
  };
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

function buildDerivativeKey(variant: Variant, fotokey: string): string {
  return `${PREVIEW_KEY_PREFIX}/${variant.toLowerCase()}/${fotokey}.webp`;
}

async function upsertDerivative(
  pool: PgPool,
  imageAssetId: string,
  variant: Variant,
  storageKey: string,
  derivative: GeneratedPreview,
  status: DerivativeStatus,
) {
  await pool.query(
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
        source,
        created_at,
        updated_at
      )
      values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, now(), 'GENERATED', now(), now())
      on conflict (image_asset_id, variant) do update
      set
        storage_key = excluded.storage_key,
        mime_type = excluded.mime_type,
        width = excluded.width,
        height = excluded.height,
        size_bytes = excluded.size_bytes,
        checksum = excluded.checksum,
        is_watermarked = true,
        watermark_profile = excluded.watermark_profile,
        generation_status = excluded.generation_status,
        generated_at = excluded.generated_at,
        source = excluded.source,
        updated_at = now()
    `,
    [
      imageAssetId,
      variant,
      storageKey,
      PREVIEW_MIME_TYPE,
      derivative.width,
      derivative.height,
      derivative.byteSize,
      derivative.checksum,
      CURRENT_WATERMARK_PROFILE,
      status,
    ],
  );
}

async function r2GetObject(config: R2Config, bucket: string, key: string): Promise<Buffer> {
  const response = await signedR2Request(config, bucket, "GET", key);
  if (!response.ok) throw new Error(`R2 GET failed with status ${response.status} for ${bucket}/${key}`);
  return Buffer.from(await response.arrayBuffer());
}

async function r2PutObject(config: R2Config, bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
  if (!key.startsWith(`${PREVIEW_KEY_PREFIX}/`)) {
    throw new Error("Refusing to write outside previews/watermarked/.");
  }
  const response = await signedR2Request(config, bucket, "PUT", key, body, { "content-type": contentType });
  if (!response.ok) throw new Error(`R2 PUT failed with status ${response.status} for ${bucket}/${key}`);
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
  const canonicalHeaders = canonicalHeaderNames.map((name) => `${name}:${headers[name]}`).join("\n") + "\n";
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
  const requestBody =
    method === "PUT" && body
      ? (body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer)
      : undefined;

  return fetch(url, { method, headers: requestHeaders, body: requestBody });
}

function getR2Config(): R2Config {
  const accountId = optionalEnv(["CLOUDFLARE_R2_ACCOUNT_ID", "R2_ACCOUNT_ID"]);
  const originalsBucket = optionalEnv(["CLOUDFLARE_R2_ORIGINALS_BUCKET", "R2_ORIGINALS_BUCKET"]);
  const previewsBucket = optionalEnv(["CLOUDFLARE_R2_PREVIEWS_BUCKET", "R2_PREVIEWS_BUCKET"]);
  const accessKeyId = optionalEnv(["CLOUDFLARE_R2_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID"]);
  const secretAccessKey = optionalEnv(["CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY"]);
  const missing = [
    ["CLOUDFLARE_R2_ACCOUNT_ID", accountId],
    ["CLOUDFLARE_R2_ORIGINALS_BUCKET", originalsBucket],
    ["CLOUDFLARE_R2_PREVIEWS_BUCKET", previewsBucket],
    ["CLOUDFLARE_R2_ACCESS_KEY_ID", accessKeyId],
    ["CLOUDFLARE_R2_SECRET_ACCESS_KEY", secretAccessKey],
  ].filter(([, value]) => !value).map(([name]) => name);
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

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { limit: 25, dryRun: false };

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
    } else if (arg === "--limit") options.limit = parsePositiveInteger(next(), "limit");
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--job-id") options.jobId = parseUuid(next(), "job-id");
    else if (arg === "--image-asset-id") options.imageAssetId = parseUuid(next(), "image-asset-id");
    else if (arg === "--") continue;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.limit > 200) throw new Error("--limit must be 200 or lower.");
  return options;
}

function printHelp() {
  console.log(`
Process queued image_publish_jobs/items for photographer publish pipeline.

Examples:
  pnpm --dir apps/api media:process-image-publish-jobs -- --limit 25
  pnpm --dir apps/api media:process-image-publish-jobs -- --job-id <uuid>
  pnpm --dir apps/api media:process-image-publish-jobs -- --image-asset-id <uuid>
  pnpm --dir apps/api media:process-image-publish-jobs -- --dry-run --limit 5

Options:
  --limit <n>            Max items to process (default 25, max 200).
  --job-id <uuid>        Restrict to a single job.
  --image-asset-id <uuid> Restrict to a single image asset.
  --dry-run              List candidate items without R2/DB mutation.
`);
}

function parsePositiveInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer.`);
  return parsed;
}

function parseUuid(value: string, name: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`--${name} must be a UUID.`);
  }
  return value;
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

function errorCode(error: unknown): string {
  if (!error) return "UNKNOWN";
  if (typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  if (typeof error === "object" && "name" in error && typeof (error as { name: unknown }).name === "string") {
    return (error as { name: string }).name.toUpperCase();
  }
  return "PUBLISH_JOB_ERROR";
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
