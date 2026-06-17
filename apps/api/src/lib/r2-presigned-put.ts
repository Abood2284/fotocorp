import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../appTypes";
import { getCaricatureOriginalsS3Context } from "./r2-caricature-originals";
import { getContributorStagingS3Context, hasContributorStagingS3Config } from "./r2-contributor-uploads";

const CONTRIBUTOR_STAGING_PRESIGN_TTL_SECONDS = 15 * 60;
const CARICATURE_ORIGINAL_PRESIGN_TTL_SECONDS = 15 * 60;

export interface ContributorStagingPresignedPut {
  uploadUrl: string;
  /** ISO-8601 expiry of the presigned URL (client hint; enforce on R2 side via signature). */
  expiresAt: string;
}

/**
 * Presigned PUT URL for direct browser → R2 uploads against the contributor staging bucket.
 *
 * The canonical originals bucket (Fotokey originals) MUST NOT receive direct browser PUTs.
 * R2 credentials are only used server-side and are never returned to clients.
 */
export async function createContributorStagingPresignedPutUrl(
  env: Env,
  storageKey: string,
  contentType: string,
): Promise<ContributorStagingPresignedPut> {
  const ctx = getContributorStagingS3Context(env);
  if (!ctx) {
    throw new Error("createContributorStagingPresignedPutUrl called without contributor staging S3 config");
  }

  const command = new PutObjectCommand({
    Bucket: ctx.bucket,
    Key: storageKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(ctx.client, command, { expiresIn: CONTRIBUTOR_STAGING_PRESIGN_TTL_SECONDS });
  const expiresAt = new Date(Date.now() + CONTRIBUTOR_STAGING_PRESIGN_TTL_SECONDS * 1000).toISOString();
  return { uploadUrl, expiresAt };
}

/**
 * @deprecated Use {@link createContributorStagingPresignedPutUrl}. Returns only the URL or null when presign is unavailable.
 */
export async function createPhotographerStagingPresignedPutUrl(
  env: Env,
  storageKey: string,
  contentType: string,
): Promise<string | null> {
  if (!hasContributorStagingS3Config(env)) return null;
  const { uploadUrl } = await createContributorStagingPresignedPutUrl(env, storageKey, contentType);
  return uploadUrl;
}

/**
 * @deprecated Use {@link createContributorStagingPresignedPutUrl}.
 * Browser uploads to the canonical originals bucket are not supported by the publish pipeline; promotion is
 * server-side only via R2 CopyObject.
 */
export const createOriginalsPresignedPutUrl = createPhotographerStagingPresignedPutUrl;

export interface CaricatureOriginalPresignedPut {
  uploadUrl: string;
  expiresAt: string;
}

/** Presigned PUT for browser → private caricature originals bucket. */
export async function createCaricatureOriginalPresignedPutUrl(
  env: Env,
  storageKey: string,
  contentType: string,
): Promise<CaricatureOriginalPresignedPut> {
  const ctx = getCaricatureOriginalsS3Context(env);
  if (!ctx) {
    throw new Error("createCaricatureOriginalPresignedPutUrl called without caricature originals S3 config");
  }

  const command = new PutObjectCommand({
    Bucket: ctx.bucket,
    Key: storageKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(ctx.client, command, { expiresIn: CARICATURE_ORIGINAL_PRESIGN_TTL_SECONDS });
  const expiresAt = new Date(Date.now() + CARICATURE_ORIGINAL_PRESIGN_TTL_SECONDS * 1000).toISOString();
  return { uploadUrl, expiresAt };
}
