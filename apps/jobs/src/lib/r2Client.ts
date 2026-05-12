/**
 * Minimal S3-compatible signing for Cloudflare R2 (GET / HEAD / PUT).
 * Kept in apps/jobs so the VPS worker does not depend on apps/api runtime code.
 */
import { createHash, createHmac } from "node:crypto"

export interface R2ClientConfig {
  accountId: string
  originalsBucket: string
  previewsBucket: string
  stagingBucket: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  region: string
}

export function buildR2ClientConfig(input: {
  accountId: string
  originalsBucket: string
  previewsBucket: string
  stagingBucket: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
  region?: string
}): R2ClientConfig {
  const endpoint =
    input.endpoint?.trim() || `https://${input.accountId}.r2.cloudflarestorage.com`
  const region = input.region?.trim() || "auto"
  return {
    accountId: input.accountId,
    originalsBucket: input.originalsBucket,
    previewsBucket: input.previewsBucket,
    stagingBucket: input.stagingBucket,
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
    endpoint,
    region
  }
}

function hashHex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest()
}

function getSignatureKey(secret: string, dateStamp: string, region: string, service: string) {
  const dateKey = hmac(`AWS4${secret}`, dateStamp)
  const regionKey = hmac(dateKey, region)
  const serviceKey = hmac(regionKey, service)
  return hmac(serviceKey, "aws4_request")
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

async function signedR2Request(
  config: R2ClientConfig,
  bucket: string,
  method: "GET" | "PUT" | "HEAD",
  key: string,
  body?: Buffer,
  extraHeaders: Record<string, string> = {}
) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/")
  const url = new URL(`/${bucket}/${encodedKey}`, config.endpoint)
  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = hashHex(body ?? "")
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders
  }
  const canonicalHeaderNames = Object.keys(headers).sort()
  const canonicalHeaders = canonicalHeaderNames.map((name) => `${name}:${headers[name]}`).join("\n") + "\n"
  const signedHeaders = canonicalHeaderNames.join(";")
  const canonicalRequest = [method, url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n")
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashHex(canonicalRequest)].join("\n")
  const signingKey = getSignatureKey(config.secretAccessKey, dateStamp, config.region, "s3")
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const requestHeaders = new Headers(headers)
  requestHeaders.delete("host")
  requestHeaders.set("Authorization", authorization)
  const requestBody =
    method === "PUT" && body
      ? (body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer)
      : undefined

  return fetch(url, { method, headers: requestHeaders, body: requestBody })
}

const PREVIEW_KEY_PREFIX = "previews/watermarked"

export async function r2GetObject(config: R2ClientConfig, bucket: string, key: string): Promise<Buffer> {
  const response = await signedR2Request(config, bucket, "GET", key)
  if (!response.ok)
    throw new Error(`R2 GET failed with status ${response.status} for bucket object (key redacted)`)
  return Buffer.from(await response.arrayBuffer())
}

export async function r2HeadObject(config: R2ClientConfig, bucket: string, key: string): Promise<boolean> {
  const response = await signedR2Request(config, bucket, "HEAD", key)
  if (response.status === 404) return false
  if (!response.ok)
    throw new Error(`R2 HEAD failed with status ${response.status} for bucket object (key redacted)`)
  return true
}

export async function r2PutPreviewObject(
  config: R2ClientConfig,
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  if (!key.startsWith(`${PREVIEW_KEY_PREFIX}/`))
    throw new Error("Refusing to write previews outside previews/watermarked/.")

  const response = await signedR2Request(config, config.previewsBucket, "PUT", key, body, {
    "content-type": contentType
  })
  if (!response.ok)
    throw new Error(`R2 PUT failed with status ${response.status} for previews bucket (key redacted)`)
}

export async function r2PutCanonicalOriginal(
  config: R2ClientConfig,
  canonicalKey: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  if (canonicalKey !== canonicalKey.trim() || canonicalKey.includes("/") || canonicalKey.includes(".."))
    throw new Error("Invalid canonical original key shape.")

  const response = await signedR2Request(config, config.originalsBucket, "PUT", canonicalKey, body, {
    "content-type": contentType
  })
  if (!response.ok)
    throw new Error(`R2 PUT failed with status ${response.status} for originals bucket (key redacted)`)
}

export { PREVIEW_KEY_PREFIX }
