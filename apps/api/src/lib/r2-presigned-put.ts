import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../appTypes";
import { getPhotographerUploadsS3Context } from "./r2-contributor-uploads";

/**
 * Presigned PUT URL for direct browser → R2 uploads against the photographer staging bucket.
 *
 * The canonical originals bucket (Fotokey originals) MUST NOT receive direct browser PUTs.
 * R2 credentials are only used server-side and are never returned to clients.
 */
export async function createPhotographerStagingPresignedPutUrl(
  env: Env,
  storageKey: string,
  contentType: string,
): Promise<string | null> {
  const ctx = getPhotographerUploadsS3Context(env);
  if (!ctx) return null;

  const command = new PutObjectCommand({
    Bucket: ctx.bucket,
    Key: storageKey,
    ContentType: contentType,
  });

  return getSignedUrl(ctx.client, command, { expiresIn: 15 * 60 });
}

/**
 * @deprecated Use {@link createPhotographerStagingPresignedPutUrl} for photographer staging uploads.
 * Browser uploads to the canonical originals bucket are not supported by the publish pipeline; promotion is
 * server-side only via R2 CopyObject.
 */
export const createOriginalsPresignedPutUrl = createPhotographerStagingPresignedPutUrl;
