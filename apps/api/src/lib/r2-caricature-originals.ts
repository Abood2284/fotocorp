import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { Env } from "../appTypes"
import { CARICATURE_ORIGINALS_BUCKET_NAME } from "./caricature-original-storage-key"

export interface R2BucketContext {
  client: S3Client
  bucket: string
}

export interface CaricatureOriginalObjectHead {
  contentType: string | null
  contentLength: number | null
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

/** Private caricature originals bucket (S3 API). Prefer `R2_CARICATURE_ORIGINALS_BUCKET`. */
export function resolveCaricatureOriginalsBucketName(env: Env): string {
  return (
    trimEnv(env.R2_CARICATURE_ORIGINALS_BUCKET) ??
    trimEnv(env.CLOUDFLARE_R2_CARICATURE_ORIGINALS_BUCKET) ??
    CARICATURE_ORIGINALS_BUCKET_NAME
  )
}

export function listMissingCaricatureOriginalsS3ConfigKeys(env: Env): string[] {
  const missing: string[] = []
  if (!resolveR2AccountId(env)) missing.push("R2_ACCOUNT_ID (or CLOUDFLARE_R2_ACCOUNT_ID)")
  if (!resolveR2AccessKeyId(env)) missing.push("R2_ACCESS_KEY_ID (or CLOUDFLARE_R2_ACCESS_KEY_ID)")
  if (!resolveR2SecretAccessKey(env)) missing.push("R2_SECRET_ACCESS_KEY (or CLOUDFLARE_R2_SECRET_ACCESS_KEY)")
  if (!resolveCaricatureOriginalsBucketName(env)) {
    missing.push("R2_CARICATURE_ORIGINALS_BUCKET (or CLOUDFLARE_R2_CARICATURE_ORIGINALS_BUCKET)")
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

export function getCaricatureOriginalsS3Context(env: Env): R2BucketContext | null {
  return getR2BaseClient(env, resolveCaricatureOriginalsBucketName(env))
}

export function hasCaricatureOriginalsS3Config(env: Env): boolean {
  return getCaricatureOriginalsS3Context(env) !== null
}

export async function verifyCaricatureOriginalObjectExists(env: Env, storageKey: string): Promise<boolean> {
  const binding = env.MEDIA_CARICATURE_ORIGINALS_BUCKET
  if (binding) {
    const head = await binding.head(storageKey)
    return Boolean(head)
  }

  const ctx = getCaricatureOriginalsS3Context(env)
  if (!ctx) return false

  try {
    await ctx.client.send(new HeadObjectCommand({ Bucket: ctx.bucket, Key: storageKey }))
    return true
  } catch (error: unknown) {
    if (isNotFoundError(error)) return false
    throw error
  }
}

export async function headCaricatureOriginalObject(
  env: Env,
  storageKey: string,
): Promise<CaricatureOriginalObjectHead | null> {
  const binding = env.MEDIA_CARICATURE_ORIGINALS_BUCKET
  if (binding) {
    const head = await binding.head(storageKey)
    if (!head) return null
    return {
      contentType: head.httpMetadata?.contentType ?? null,
      contentLength: head.size ?? null,
    }
  }

  const ctx = getCaricatureOriginalsS3Context(env)
  if (!ctx) return null

  try {
    const result = await ctx.client.send(new HeadObjectCommand({ Bucket: ctx.bucket, Key: storageKey }))
    return {
      contentType: result.ContentType ?? null,
      contentLength: result.ContentLength ?? null,
    }
  } catch (error: unknown) {
    if (isNotFoundError(error)) return null
    throw error
  }
}

export async function getCaricatureOriginalObjectBytes(env: Env, storageKey: string): Promise<Buffer | null> {
  const binding = env.MEDIA_CARICATURE_ORIGINALS_BUCKET
  if (binding) {
    const object = await binding.get(storageKey)
    if (!object) return null
    return Buffer.from(await object.arrayBuffer())
  }

  const ctx = getCaricatureOriginalsS3Context(env)
  if (!ctx) return null

  try {
    const result = await ctx.client.send(new GetObjectCommand({ Bucket: ctx.bucket, Key: storageKey }))
    const body = result.Body
    if (!body) return null
    const bytes = await body.transformToByteArray()
    return Buffer.from(bytes)
  } catch (error: unknown) {
    if (isNotFoundError(error)) return null
    throw error
  }
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const name = "name" in error ? String(error.name) : ""
  const code = "Code" in error ? String((error as { Code?: string }).Code) : ""
  const status = "$metadata" in error ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode : undefined
  return name === "NotFound" || code === "NotFound" || code === "NoSuchKey" || status === 404
}
