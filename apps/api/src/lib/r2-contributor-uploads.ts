import { CopyObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Env } from "../appTypes";

export interface R2BucketContext {
  client: S3Client;
  bucket: string;
}

function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t || undefined;
}

function resolveR2AccountId(env: Env): string | undefined {
  return trimEnv(env.R2_ACCOUNT_ID) ?? trimEnv(env.CLOUDFLARE_R2_ACCOUNT_ID);
}

function resolveR2AccessKeyId(env: Env): string | undefined {
  return trimEnv(env.R2_ACCESS_KEY_ID) ?? trimEnv(env.CLOUDFLARE_R2_ACCESS_KEY_ID);
}

function resolveR2SecretAccessKey(env: Env): string | undefined {
  return trimEnv(env.R2_SECRET_ACCESS_KEY) ?? trimEnv(env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
}

/** Staging bucket for contributor browser PUTs (S3 API). Prefer `R2_CONTRIBUTOR_STAGING_BUCKET`. */
export function resolveContributorStagingBucketName(env: Env): string | undefined {
  return trimEnv(env.R2_CONTRIBUTOR_STAGING_BUCKET) ?? trimEnv(env.CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET);
}

function resolveOriginalsBucketName(env: Env): string | undefined {
  return trimEnv(env.R2_ORIGINALS_BUCKET) ?? trimEnv(env.CLOUDFLARE_R2_ORIGINALS_BUCKET);
}

/**
 * Human-readable list of missing env keys (no secret values). Used for logs and API error messages.
 */
export function listMissingContributorStagingS3ConfigKeys(env: Env): string[] {
  const missing: string[] = [];
  if (!resolveR2AccountId(env)) missing.push("R2_ACCOUNT_ID (or CLOUDFLARE_R2_ACCOUNT_ID)");
  if (!resolveR2AccessKeyId(env)) missing.push("R2_ACCESS_KEY_ID (or CLOUDFLARE_R2_ACCESS_KEY_ID)");
  if (!resolveR2SecretAccessKey(env)) missing.push("R2_SECRET_ACCESS_KEY (or CLOUDFLARE_R2_SECRET_ACCESS_KEY)");
  if (!resolveContributorStagingBucketName(env))
    missing.push("R2_CONTRIBUTOR_STAGING_BUCKET (or CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET)");
  return missing;
}

function getR2BaseClient(env: Env, bucketName: string | undefined): R2BucketContext | null {
  const accountId = resolveR2AccountId(env);
  const accessKeyId = resolveR2AccessKeyId(env);
  const secretAccessKey = resolveR2SecretAccessKey(env);
  const bucket = bucketName?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return { client, bucket };
}

/** S3-compatible client + bucket name for the contributor upload staging bucket. */
export function getContributorStagingS3Context(env: Env): R2BucketContext | null {
  return getR2BaseClient(env, resolveContributorStagingBucketName(env));
}

/** @deprecated Use {@link getContributorStagingS3Context}. */
export function getPhotographerUploadsS3Context(env: Env): R2BucketContext | null {
  return getContributorStagingS3Context(env);
}

/** S3-compatible client + bucket name for the canonical originals bucket. */
export function getOriginalsS3Context(env: Env): R2BucketContext | null {
  return getR2BaseClient(env, resolveOriginalsBucketName(env));
}

/** True when contributor staging uploads can be presigned and verified via S3 API (binding optional). */
export function hasContributorStagingS3Config(env: Env): boolean {
  return getContributorStagingS3Context(env) !== null;
}

/** @deprecated Use {@link hasContributorStagingS3Config}. */
export function hasPhotographerUploadsS3Config(env: Env): boolean {
  return hasContributorStagingS3Config(env);
}

/**
 * Returns whether an object exists at `storageKey` in the contributor staging bucket.
 * Prefers the Worker `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET.head` binding when available; otherwise
 * falls back to the S3 `HeadObject` API for local smoke without R2 bindings.
 */
export async function verifyContributorStagingObjectExists(env: Env, storageKey: string): Promise<boolean> {
  const binding = env.MEDIA_CONTRIBUTOR_UPLOADS_BUCKET;
  if (binding) {
    const head = await binding.head(storageKey);
    return Boolean(head);
  }

  const ctx = getContributorStagingS3Context(env);
  if (!ctx) return false;

  try {
    await ctx.client.send(new HeadObjectCommand({ Bucket: ctx.bucket, Key: storageKey }));
    return true;
  } catch (error: unknown) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

/** @deprecated Use {@link verifyContributorStagingObjectExists}. */
export async function verifyPhotographerStagingObjectExists(env: Env, storageKey: string): Promise<boolean> {
  return verifyContributorStagingObjectExists(env, storageKey);
}

export interface CopyStagingToOriginalsInput {
  sourceKey: string;
  destinationKey: string;
}

export interface CopyStagingToOriginalsResult {
  ok: true;
  destinationKey: string;
  destinationContentType: string | null;
  destinationSize: number | null;
}

/**
 * Copies an object from the contributor upload staging bucket to the canonical originals bucket.
 *
 * **Preferred in dev / Workers:** when `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET` and `MEDIA_ORIGINALS_BUCKET`
 * bindings are present, copies via native R2 `get` + `put` (no S3 API keys required).
 *
 * **Otherwise:** uses S3-compatible CopyObject against both buckets (requires `R2_*` / legacy
 * `CLOUDFLARE_R2_*` credentials and bucket names in env).
 *
 * Throws on missing config, missing source, missing destination after copy, or any read/write error.
 */
export async function copyStagingObjectToOriginals(
  env: Env,
  input: CopyStagingToOriginalsInput,
): Promise<CopyStagingToOriginalsResult> {
  const stagingBinding = env.MEDIA_CONTRIBUTOR_UPLOADS_BUCKET;
  const originalsBinding = env.MEDIA_ORIGINALS_BUCKET;

  if (stagingBinding && originalsBinding) {
    const source = await stagingBinding.get(input.sourceKey);
    if (!source?.body) {
      throw new Error(`Staging object missing at key: ${input.sourceKey}`);
    }

    const contentType = source.httpMetadata?.contentType ?? "application/octet-stream";
    await originalsBinding.put(input.destinationKey, source.body, {
      httpMetadata: { contentType },
    });

    const head = await originalsBinding.head(input.destinationKey);
    if (!head) {
      throw new Error(`Canonical original not found after copy: ${input.destinationKey}`);
    }

    return {
      ok: true,
      destinationKey: input.destinationKey,
      destinationContentType: head.httpMetadata?.contentType ?? contentType,
      destinationSize: typeof head.size === "number" ? head.size : null,
    };
  }

  const stagingCtx = getContributorStagingS3Context(env);
  const originalsCtx = getOriginalsS3Context(env);
  if (!stagingCtx || !originalsCtx) {
    throw new Error(
      "Configure Worker R2 bindings MEDIA_CONTRIBUTOR_UPLOADS_BUCKET + MEDIA_ORIGINALS_BUCKET, or set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY with R2_CONTRIBUTOR_STAGING_BUCKET and R2_ORIGINALS_BUCKET (or CLOUDFLARE_R2_* equivalents) for S3 CopyObject.",
    );
  }

  await stagingCtx.client.send(
    new HeadObjectCommand({ Bucket: stagingCtx.bucket, Key: input.sourceKey }),
  );

  await originalsCtx.client.send(
    new CopyObjectCommand({
      Bucket: originalsCtx.bucket,
      Key: input.destinationKey,
      CopySource: `/${stagingCtx.bucket}/${encodeURIObjectKey(input.sourceKey)}`,
    }),
  );

  const head = await originalsCtx.client.send(
    new HeadObjectCommand({ Bucket: originalsCtx.bucket, Key: input.destinationKey }),
  );

  return {
    ok: true,
    destinationKey: input.destinationKey,
    destinationContentType: head.ContentType ?? null,
    destinationSize: typeof head.ContentLength === "number" ? head.ContentLength : null,
  };
}

function encodeURIObjectKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const metadata = "$metadata" in error ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata : undefined;
  if (metadata?.httpStatusCode === 404) return true;
  if ("name" in error && String((error as { name: string }).name) === "NotFound") return true;
  return false;
}
