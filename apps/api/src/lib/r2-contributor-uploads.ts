import { CopyObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Env } from "../appTypes";

export interface R2BucketContext {
  client: S3Client;
  bucket: string;
}

function getR2BaseClient(env: Env, bucketName: string | undefined): R2BucketContext | null {
  const accountId = env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
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

/** S3-compatible client + bucket name for the photographer upload staging bucket. */
export function getPhotographerUploadsS3Context(env: Env): R2BucketContext | null {
  return getR2BaseClient(env, env.CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET);
}

/** S3-compatible client + bucket name for the canonical originals bucket. */
export function getOriginalsS3Context(env: Env): R2BucketContext | null {
  return getR2BaseClient(env, env.CLOUDFLARE_R2_ORIGINALS_BUCKET);
}

/** True when staging photographer uploads can be verified via S3 API (used for presigned PUT + head fallback). */
export function hasPhotographerUploadsS3Config(env: Env): boolean {
  return getPhotographerUploadsS3Context(env) !== null;
}

/**
 * Returns whether an object exists at `storageKey` in the photographer staging bucket.
 * Prefers the Worker `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET.head` binding when available; otherwise
 * falls back to the S3 `HeadObject` API for local smoke without R2 bindings.
 */
export async function verifyPhotographerStagingObjectExists(env: Env, storageKey: string): Promise<boolean> {
  const binding = env.MEDIA_CONTRIBUTOR_UPLOADS_BUCKET;
  if (binding) {
    const head = await binding.head(storageKey);
    return Boolean(head);
  }

  const ctx = getPhotographerUploadsS3Context(env);
  if (!ctx) return false;

  try {
    await ctx.client.send(new HeadObjectCommand({ Bucket: ctx.bucket, Key: storageKey }));
    return true;
  } catch (error: unknown) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
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
 * Copies an object from the photographer upload staging bucket to the canonical originals bucket.
 * Uses S3-compatible CopyObject (R2 supports it). Verifies the destination via HeadObject after copy.
 *
 * Throws on missing config, missing source, missing destination after copy, or any S3 error.
 */
export async function copyStagingObjectToOriginals(
  env: Env,
  input: CopyStagingToOriginalsInput,
): Promise<CopyStagingToOriginalsResult> {
  const stagingCtx = getPhotographerUploadsS3Context(env);
  const originalsCtx = getOriginalsS3Context(env);
  if (!stagingCtx || !originalsCtx) {
    throw new Error(
      "R2 S3 API credentials, photographer uploads bucket, and originals bucket must all be configured.",
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
