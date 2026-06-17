import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { Env } from "../appTypes"
import { CARICATURE_PREVIEWS_BUCKET_NAME } from "./caricature-preview-storage-key"

export interface R2BucketContext {
  client: S3Client
  bucket: string
}

function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t || undefined
}

function resolveR2AccountId(env: Env): string | undefined {
  return trimEnv(env.R2_ACCOUNT_ID) ?? trimEnv(env.CLOUDFLARE_R2_ACCOUNT_ID)
}

function resolveR2AccessKeyId(env: Env): string | undefined {
  return trimEnv(env.R2_ACCESS_KEY_ID) ?? trimEnv(env.CLOUDFLARE_R2_ACCESS_KEY_ID)
}

function resolveR2SecretAccessKey(env: Env): string | undefined {
  return trimEnv(env.R2_SECRET_ACCESS_KEY) ?? trimEnv(env.CLOUDFLARE_R2_SECRET_ACCESS_KEY)
}

export function resolveCaricaturePreviewsBucketName(env: Env): string {
  return (
    trimEnv(env.R2_CARICATURE_PREVIEWS_BUCKET) ??
    trimEnv(env.CLOUDFLARE_R2_CARICATURE_PREVIEWS_BUCKET) ??
    CARICATURE_PREVIEWS_BUCKET_NAME
  )
}

export function listMissingCaricaturePreviewsS3ConfigKeys(env: Env): string[] {
  const missing: string[] = []
  if (!resolveR2AccountId(env)) missing.push("R2_ACCOUNT_ID (or CLOUDFLARE_R2_ACCOUNT_ID)")
  if (!resolveR2AccessKeyId(env)) missing.push("R2_ACCESS_KEY_ID (or CLOUDFLARE_R2_ACCESS_KEY_ID)")
  if (!resolveR2SecretAccessKey(env)) missing.push("R2_SECRET_ACCESS_KEY (or CLOUDFLARE_R2_SECRET_ACCESS_KEY)")
  if (!resolveCaricaturePreviewsBucketName(env)) {
    missing.push("R2_CARICATURE_PREVIEWS_BUCKET (or CLOUDFLARE_R2_CARICATURE_PREVIEWS_BUCKET)")
  }
  return missing
}

function getR2BaseClient(env: Env, bucketName: string): R2BucketContext | null {
  const accountId = resolveR2AccountId(env)
  const accessKeyId = resolveR2AccessKeyId(env)
  const secretAccessKey = resolveR2SecretAccessKey(env)
  const bucket = bucketName.trim()
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
  return { client, bucket }
}

export function getCaricaturePreviewsS3Context(env: Env): R2BucketContext | null {
  return getR2BaseClient(env, resolveCaricaturePreviewsBucketName(env))
}

export function hasCaricaturePreviewsS3Config(env: Env): boolean {
  return getCaricaturePreviewsS3Context(env) !== null
}

export async function putCaricaturePreviewObject(
  env: Env,
  storageKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const binding = env.MEDIA_CARICATURE_PREVIEWS_BUCKET
  if (binding) {
    await binding.put(storageKey, body, {
      httpMetadata: { contentType },
    })
    return
  }

  const ctx = getCaricaturePreviewsS3Context(env)
  if (!ctx) {
    throw new Error("Caricature previews storage is not configured.")
  }

  await ctx.client.send(
    new PutObjectCommand({
      Bucket: ctx.bucket,
      Key: storageKey,
      Body: body,
      ContentType: contentType,
    }),
  )
}
