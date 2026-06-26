import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { Env } from "../appTypes"
import { HELP_CENTER_BUCKET_NAME } from "./help-center/help-media-storage-key"

export interface R2BucketContext {
  client: S3Client
  bucket: string
}

export interface HelpCenterObjectHead {
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

export function resolveHelpCenterBucketName(env: Env): string {
  return (
    trimEnv(env.R2_HELP_CENTER_BUCKET) ??
    trimEnv(env.CLOUDFLARE_R2_HELP_CENTER_BUCKET) ??
    HELP_CENTER_BUCKET_NAME
  )
}

export function listMissingHelpCenterS3ConfigKeys(env: Env): string[] {
  const missing: string[] = []
  if (!resolveR2AccountId(env)) missing.push("R2_ACCOUNT_ID (or CLOUDFLARE_R2_ACCOUNT_ID)")
  if (!resolveR2AccessKeyId(env)) missing.push("R2_ACCESS_KEY_ID (or CLOUDFLARE_R2_ACCESS_KEY_ID)")
  if (!resolveR2SecretAccessKey(env)) missing.push("R2_SECRET_ACCESS_KEY (or CLOUDFLARE_R2_SECRET_ACCESS_KEY)")
  if (!resolveHelpCenterBucketName(env)) missing.push("R2_HELP_CENTER_BUCKET (or CLOUDFLARE_R2_HELP_CENTER_BUCKET)")
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

export function getHelpCenterS3Context(env: Env): R2BucketContext | null {
  return getR2BaseClient(env, resolveHelpCenterBucketName(env))
}

export function hasHelpCenterS3Config(env: Env): boolean {
  return getHelpCenterS3Context(env) !== null
}

export function assertHelpCenterStorageConfigured(env: Env) {
  const missing = listMissingHelpCenterS3ConfigKeys(env)
  if (env.MEDIA_HELP_CENTER_BUCKET || missing.length === 0) return
  throw new Error(`Help center media storage is not configured: ${missing.join(", ")}`)
}

export async function verifyHelpCenterObjectExists(env: Env, storageKey: string): Promise<boolean> {
  const binding = env.MEDIA_HELP_CENTER_BUCKET
  if (binding) {
    const head = await binding.head(storageKey)
    return Boolean(head)
  }

  const ctx = getHelpCenterS3Context(env)
  if (!ctx) return false

  try {
    await ctx.client.send(new HeadObjectCommand({ Bucket: ctx.bucket, Key: storageKey }))
    return true
  } catch (error: unknown) {
    if (isNotFoundError(error)) return false
    throw error
  }
}

export async function headHelpCenterObject(env: Env, storageKey: string): Promise<HelpCenterObjectHead | null> {
  const binding = env.MEDIA_HELP_CENTER_BUCKET
  if (binding) {
    const head = await binding.head(storageKey)
    if (!head) return null
    return {
      contentType: head.httpMetadata?.contentType ?? null,
      contentLength: head.size ?? null,
    }
  }

  const ctx = getHelpCenterS3Context(env)
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

export async function deleteHelpCenterObject(env: Env, storageKey: string): Promise<void> {
  const binding = env.MEDIA_HELP_CENTER_BUCKET
  if (binding) {
    await binding.delete(storageKey)
    return
  }

  const ctx = getHelpCenterS3Context(env)
  if (!ctx) return

  try {
    await ctx.client.send(new DeleteObjectCommand({ Bucket: ctx.bucket, Key: storageKey }))
  } catch (error: unknown) {
    if (isNotFoundError(error)) return
    throw error
  }
}

export async function getHelpCenterObjectStream(
  env: Env,
  storageKey: string,
  rangeHeader: string | null,
): Promise<{
  body: ReadableStream
  contentType: string | null
  etag: string | null
  contentLength: number | null
  uploaded: Date | null
  status: 200 | 206
  contentRange: string | null
}> {
  const binding = env.MEDIA_HELP_CENTER_BUCKET
  if (binding) {
    const head = await binding.head(storageKey)
    if (!head) throw new HelpCenterObjectNotFoundError()

    const parsedRange = parseHttpRangeHeader(rangeHeader, head.size)
    const object = parsedRange
      ? await binding.get(storageKey, { range: parsedRange })
      : await binding.get(storageKey)
    if (!object?.body) throw new HelpCenterObjectNotFoundError()

    const totalSize = head.size
    if (parsedRange && totalSize != null) {
      const start = parsedRange.offset
      const end = parsedRange.length != null ? start + parsedRange.length - 1 : totalSize - 1
      return {
        body: object.body,
        contentType: object.httpMetadata?.contentType ?? head.httpMetadata?.contentType ?? null,
        etag: object.httpEtag ?? head.httpEtag ?? null,
        contentLength: object.size ?? parsedRange.length ?? null,
        uploaded: object.uploaded ?? head.uploaded ?? null,
        status: 206,
        contentRange: `bytes ${start}-${end}/${totalSize}`,
      }
    }

    return {
      body: object.body,
      contentType: object.httpMetadata?.contentType ?? head.httpMetadata?.contentType ?? null,
      etag: object.httpEtag ?? head.httpEtag ?? null,
      contentLength: object.size ?? head.size ?? null,
      uploaded: object.uploaded ?? head.uploaded ?? null,
      status: 200,
      contentRange: null,
    }
  }

  const ctx = getHelpCenterS3Context(env)
  if (!ctx) throw new Error("Help center media storage is not configured.")

  const head = await headHelpCenterObject(env, storageKey)
  if (!head?.contentLength) throw new HelpCenterObjectNotFoundError()

  const parsedRange = parseHttpRangeHeader(rangeHeader, head.contentLength)
  const command = new GetObjectCommand({
    Bucket: ctx.bucket,
    Key: storageKey,
    ...(parsedRange
      ? { Range: `bytes=${parsedRange.offset}-${parsedRange.length != null ? parsedRange.offset + parsedRange.length - 1 : ""}` }
      : {}),
  })

  try {
    const result = await ctx.client.send(command)
    const body = result.Body
    if (!body) throw new HelpCenterObjectNotFoundError()

    if (result.ContentRange) {
      return {
        body: body.transformToWebStream(),
        contentType: head.contentType ?? result.ContentType ?? null,
        etag: result.ETag ?? null,
        contentLength: result.ContentLength ?? null,
        uploaded: result.LastModified ?? null,
        status: 206,
        contentRange: result.ContentRange,
      }
    }

    return {
      body: body.transformToWebStream(),
      contentType: head.contentType ?? result.ContentType ?? null,
      etag: result.ETag ?? null,
      contentLength: head.contentLength ?? result.ContentLength ?? null,
      uploaded: result.LastModified ?? null,
      status: 200,
      contentRange: null,
    }
  } catch (error: unknown) {
    if (error instanceof HelpCenterObjectNotFoundError) throw error
    if (isNotFoundError(error)) throw new HelpCenterObjectNotFoundError()
    throw error
  }
}

export class HelpCenterObjectNotFoundError extends Error {
  constructor() {
    super("Help media object was not found.")
    this.name = "HelpCenterObjectNotFoundError"
  }
}

function parseHttpRangeHeader(rangeHeader: string | null, totalSize: number | null | undefined) {
  if (!rangeHeader || !totalSize || totalSize < 1) return null
  const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim())
  if (!match) return null

  const start = Number.parseInt(match[1]!, 10)
  if (!Number.isFinite(start) || start < 0 || start >= totalSize) return null

  const endRaw = match[2]
  const end = endRaw ? Number.parseInt(endRaw, 10) : totalSize - 1
  if (!Number.isFinite(end) || end < start || end >= totalSize) return null

  return { offset: start, length: end - start + 1 }
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const name = "name" in error ? String(error.name) : ""
  const code = "Code" in error ? String((error as { Code?: string }).Code) : ""
  const status = "$metadata" in error ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode : undefined
  return name === "NotFound" || code === "NotFound" || code === "NoSuchKey" || status === 404
}
