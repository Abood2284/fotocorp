import { sql, type SQL } from "drizzle-orm"
import { z } from "zod"
import type { Env } from "../../../appTypes"
import { createHttpDb, type DrizzleClient } from "../../../db"
import { AppError } from "../../../lib/errors"
import { json } from "../../../lib/http"
import { getR2Object } from "../../../lib/r2"

const downloadRequestSchema = z.object({
  authUserId: z.string().trim().min(1),
  size: z.enum(["web", "medium", "large"]),
  userAgent: z.string().trim().max(1024).optional(),
  requestIp: z.string().trim().max(256).optional(),
})

type DownloadSize = z.infer<typeof downloadRequestSchema>["size"]
interface DownloadProfileRow { id: string; auth_user_id: string; status: string; is_subscriber: boolean; subscription_status: string; subscription_ends_at: Date | string | null; download_quota_limit: number | null; download_quota_used: number }
interface DownloadAssetRow { id: string; legacy_imagecode: string | null; r2_original_key: string | null; original_filename: string | null; original_ext: string | null; r2_exists: boolean; status: string; visibility: string; media_type: string }
interface QuotaUpdateRow { id: string; download_quota_limit: number | null; quota_before: number; quota_after: number }
interface ValidatedSubscriberDownload { db: DrizzleClient; profile: DownloadProfileRow; asset: DownloadAssetRow & { r2_original_key: string }; size: DownloadSize; userAgent?: string; ipHash: string | null; authUserId: string }

async function validateSubscriberDownloadRequest(env: Env, assetId: string, request: Request, options: { recordFailures: boolean }): Promise<ValidatedSubscriberDownload> {
  const parsed = downloadRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const hasInvalidSize = parsed.error.issues.some((issue) => issue.path[0] === "size")
    logInternalDownloadError("invalid_download_payload", { assetId, safeErrorCode: hasInvalidSize ? "INVALID_DOWNLOAD_SIZE" : "INVALID_DOWNLOAD_REQUEST", statusCode: 400 })
    throw new AppError(400, hasInvalidSize ? "INVALID_DOWNLOAD_SIZE" : "INVALID_DOWNLOAD_REQUEST", "Download request payload is invalid.")
  }
  const db = createHttpDb(env.DATABASE_URL!)
  const { authUserId, size, userAgent, requestIp } = parsed.data
  const ipHash = await hashIp(requestIp ?? null)
  const profile = await findProfile(db, authUserId)
  if (!profile) {
    logInternalDownloadError("profile_not_found", { assetId, authUserId, safeErrorCode: "PROFILE_NOT_FOUND", statusCode: 404 })
    throw new AppError(404, "PROFILE_NOT_FOUND", "Subscriber profile was not found.")
  }
  assertSubscriberProfile(profile, assetId)
  if (size !== "large") {
    if (options.recordFailures) await writeDownloadFailure(db, { assetId, profile, size, failureCode: "SIZE_NOT_AVAILABLE", userAgent, ipHash })
    logInternalDownloadError("size_not_available", { assetId, authUserId, safeErrorCode: "SIZE_NOT_AVAILABLE", statusCode: 409 })
    throw new AppError(409, "SIZE_NOT_AVAILABLE", "That download size is not available yet.")
  }
  const asset = await findAsset(db, assetId)
  if (!asset) {
    if (options.recordFailures) await writeDownloadFailure(db, { assetId, profile, size, failureCode: "ASSET_NOT_FOUND", userAgent, ipHash })
    logInternalDownloadError("asset_not_found", { assetId, authUserId, safeErrorCode: "ASSET_NOT_FOUND", statusCode: 404 })
    throw new AppError(404, "ASSET_NOT_FOUND", "Asset was not found.")
  }
  if (!isAssetDownloadable(asset)) {
    if (options.recordFailures) await writeDownloadFailure(db, { assetId: asset.id, profile, size, failureCode: "ASSET_NOT_DOWNLOADABLE", userAgent, ipHash })
    logInternalDownloadError("asset_not_downloadable", { assetId: asset.id, authUserId, safeErrorCode: "ASSET_NOT_DOWNLOADABLE", statusCode: 403 })
    throw new AppError(403, "ASSET_NOT_DOWNLOADABLE", "This asset is not available for clean download.")
  }
  return { db, profile, asset, size, userAgent, ipHash, authUserId }
}

export async function internalSubscriberAssetDownloadCheckService(request: Request, env: Env, assetIdRaw: string): Promise<Response> {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  if (!env.MEDIA_ORIGINALS_BUCKET) throw new AppError(500, "ORIGINAL_BUCKET_NOT_CONFIGURED", "Download service is unavailable.")
  const assetId = assetIdRaw.trim()
  if (!isUuid(assetId)) throw new AppError(400, "INVALID_ASSET_ID", "Asset id is invalid.")
  const validated = await validateSubscriberDownloadRequest(env, assetId, request, { recordFailures: false })
  await assertSourceObjectAvailable(env, validated.asset, validated.authUserId)
  return json({ ok: true as const })
}

export async function internalSubscriberAssetDownloadService(request: Request, env: Env, assetIdRaw: string): Promise<Response> {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  if (!env.MEDIA_ORIGINALS_BUCKET) throw new AppError(500, "ORIGINAL_BUCKET_NOT_CONFIGURED", "Download service is unavailable.")
  const assetId = assetIdRaw.trim()
  if (!isUuid(assetId)) throw new AppError(400, "INVALID_ASSET_ID", "Asset id is invalid.")
  const validated = await validateSubscriberDownloadRequest(env, assetId, request, { recordFailures: true })
  const { profile, asset, size, userAgent, ipHash, authUserId } = validated
  const db = validated.db
  let object: Awaited<ReturnType<typeof getR2Object>> | null = null
  try { object = await getR2Object(env.MEDIA_ORIGINALS_BUCKET, asset.r2_original_key) } catch { throw new AppError(502, "DOWNLOAD_STREAM_FAILED", "Download service is unavailable.") }
  if (!object?.body) {
    await writeDownloadFailure(db, { assetId: asset.id, profile, size, failureCode: "SOURCE_FILE_NOT_FOUND", userAgent, ipHash })
    throw new AppError(409, "SOURCE_FILE_NOT_FOUND", "This asset is not available for clean download.")
  }
  const quota = await incrementQuota(db, authUserId)
  if (!quota) {
    await writeDownloadFailure(db, { assetId: asset.id, profile, size, failureCode: "QUOTA_EXCEEDED", userAgent, ipHash })
    throw new AppError(409, "QUOTA_EXCEEDED", "Download quota has been used for this plan.")
  }
  const logId = await writeDownloadStarted(db, { asset, profile, quota, size, object, userAgent, ipHash })
  await markDownloadCompleted(db, logId)
  return new Response(object.body, { status: 200, headers: downloadHeaders({ asset, object, size }) })
}

async function assertSourceObjectAvailable(env: Env, asset: DownloadAssetRow & { r2_original_key: string }, authUserId: string): Promise<void> {
  let object: Awaited<ReturnType<typeof getR2Object>> | null = null
  try { object = await getR2Object(env.MEDIA_ORIGINALS_BUCKET!, asset.r2_original_key) } catch { throw new AppError(502, "DOWNLOAD_STREAM_FAILED", "Download service is unavailable.") }
  if (!object?.body) {
    logInternalDownloadError("source_file_not_found", { assetId: asset.id, authUserId, safeErrorCode: "SOURCE_FILE_NOT_FOUND", statusCode: 409 })
    throw new AppError(409, "SOURCE_FILE_NOT_FOUND", "This asset is not available for clean download.")
  }
}
async function findProfile(db: DrizzleClient, authUserId: string): Promise<DownloadProfileRow | null> { const rows = await executeRows<DownloadProfileRow>(db, sql`select id,auth_user_id,status,is_subscriber,subscription_status,subscription_ends_at,download_quota_limit,download_quota_used from app_user_profiles where auth_user_id = ${authUserId} limit 1`); return rows[0] ?? null }
function assertSubscriberProfile(profile: DownloadProfileRow, assetId: string): void { if (profile.status !== "ACTIVE" || !profile.is_subscriber || profile.subscription_status !== "ACTIVE") throw new AppError(403, "SUBSCRIPTION_REQUIRED", "Active subscriber access is required."); if (profile.subscription_ends_at && new Date(profile.subscription_ends_at).getTime() <= Date.now()) throw new AppError(403, "SUBSCRIPTION_EXPIRED", "Subscriber access has expired."); if (profile.download_quota_limit !== null && profile.download_quota_used >= profile.download_quota_limit) throw new AppError(409, "QUOTA_EXCEEDED", "Download quota has been used for this plan.") }
async function findAsset(db: DrizzleClient, assetId: string): Promise<DownloadAssetRow | null> { const rows = await executeRows<DownloadAssetRow>(db, sql`select id,legacy_image_code as legacy_imagecode,original_storage_key as r2_original_key,original_file_name as original_filename,original_file_extension as original_ext,original_exists_in_storage as r2_exists,status,visibility,media_type from image_assets where id = ${assetId}::uuid limit 1`); return rows[0] ?? null }
function isAssetDownloadable(asset: DownloadAssetRow): asset is DownloadAssetRow & { r2_original_key: string } { return asset.status === "ACTIVE" && asset.visibility === "PUBLIC" && asset.media_type === "IMAGE" && asset.r2_exists && Boolean(asset.r2_original_key) }
async function incrementQuota(db: DrizzleClient, authUserId: string): Promise<QuotaUpdateRow | null> { const rows = await executeRows<QuotaUpdateRow>(db, sql`update app_user_profiles set download_quota_used = download_quota_used + 1, updated_at = now() where auth_user_id = ${authUserId} and status = 'ACTIVE' and is_subscriber = true and subscription_status = 'ACTIVE' and (subscription_ends_at is null or subscription_ends_at > now()) and (download_quota_limit is null or download_quota_used < download_quota_limit) returning id,download_quota_limit,download_quota_used - 1 as quota_before,download_quota_used as quota_after`); return rows[0] ?? null }
async function writeDownloadStarted(db: DrizzleClient, values: { asset: DownloadAssetRow; profile: DownloadProfileRow; quota: QuotaUpdateRow; size: DownloadSize; object: Awaited<ReturnType<typeof getR2Object>>; userAgent?: string; ipHash: string | null }): Promise<string | null> {
  try {
    const rows = await executeRows<{ id: string }>(
      db,
      sql`
        insert into image_download_logs (
          image_asset_id,
          auth_user_id,
          app_user_profile_id,
          download_size,
          download_status,
          quota_before,
          quota_after,
          bytes_served,
          content_type,
          user_agent,
          ip_hash,
          source
        )
        values (
          ${values.asset.id}::uuid,
          ${values.profile.auth_user_id},
          ${values.profile.id},
          ${values.size.toUpperCase()},
          'STARTED',
          ${values.quota.quota_before},
          ${values.quota.quota_after},
          ${values.object?.contentLength ?? null},
          ${values.object?.contentType ?? null},
          ${values.userAgent ?? null},
          ${values.ipHash},
          'APPLICATION'
        )
        returning id
      `,
    )
    return rows[0]?.id ?? null
  } catch {
    return null
  }
}

/** Marks a successful subscriber download after the server has prepared the authorized attachment response. Does not reflect client-side save completion. */
async function markDownloadCompleted(db: DrizzleClient, logId: string | null): Promise<void> {
  if (!logId) return
  try {
    await db.execute(sql`
      update image_download_logs
      set download_status = 'COMPLETED'
      where id = ${logId}::uuid
        and download_status = 'STARTED'
    `)
  } catch {}
}
async function writeDownloadFailure(db: DrizzleClient, values: { assetId?: string; profile: DownloadProfileRow; size: DownloadSize; failureCode: string; userAgent?: string; ipHash: string | null }): Promise<void> { try { await db.execute(sql`insert into image_download_logs (image_asset_id,auth_user_id,app_user_profile_id,download_size,download_status,failure_code,user_agent,ip_hash,source) values (${values.assetId ?? null}::uuid,${values.profile.auth_user_id},${values.profile.id},${values.size.toUpperCase()},'FAILED',${values.failureCode},${values.userAgent ?? null},${values.ipHash},'APPLICATION')`) } catch {} }
function downloadHeaders(values: { asset: DownloadAssetRow; object: Awaited<ReturnType<typeof getR2Object>>; size: DownloadSize }): Headers { const headers = new Headers(); headers.set("Content-Type", values.object?.contentType ?? "application/octet-stream"); headers.set("Content-Disposition", `attachment; filename="${downloadFilename(values.asset, values.size, values.object?.contentType)}"`); headers.set("Cache-Control", "private, no-store"); headers.set("X-Content-Type-Options", "nosniff"); headers.set("X-Robots-Tag", "noindex, nofollow, noarchive"); if (values.object?.etag) headers.set("ETag", values.object.etag); if (values.object?.contentLength !== null && values.object?.contentLength !== undefined) headers.set("Content-Length", String(values.object.contentLength)); if (values.object?.uploaded) headers.set("Last-Modified", values.object.uploaded.toUTCString()); return headers }
function downloadFilename(asset: DownloadAssetRow, size: DownloadSize, contentType: string | null | undefined): string { const base = sanitizeFilenamePart(asset.legacy_imagecode ?? asset.id); const extension = sanitizeExtension(asset.original_ext) ?? extensionFromFilename(asset.original_filename) ?? extensionFromContentType(contentType); return `fotocorp-${base}-${size}${extension ? `.${extension}` : ""}` }
function extensionFromFilename(filename: string | null): string | null { if (!filename) return null; const match = filename.match(/\.([A-Za-z0-9]{1,8})$/); return match ? sanitizeExtension(match[1]) : null }
function extensionFromContentType(contentType: string | null | undefined): string | null { if (!contentType) return null; if (contentType.includes("jpeg")) return "jpg"; if (contentType.includes("png")) return "png"; if (contentType.includes("webp")) return "webp"; if (contentType.includes("tiff")) return "tif"; return null }
function sanitizeFilenamePart(value: string): string { return value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "asset" }
function sanitizeExtension(value: string | null | undefined): string | null { if (!value) return null; const normalized = value.trim().replace(/^\./, "").toLowerCase(); return /^[a-z0-9]{1,8}$/.test(normalized) ? normalized : null }
async function hashIp(ip: string | null): Promise<string | null> { if (!ip) return null; const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)); return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("") }
async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> { const result = await db.execute(query); if (Array.isArray(result)) return result as T[]; if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[]; return [] }
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) }
function logInternalDownloadError(message: string, details: { assetId: string; safeErrorCode: string; statusCode: number; authUserId?: string }) { console.error("subscriber_download_internal_error", { message, assetId: details.assetId, safeErrorCode: details.safeErrorCode, statusCode: details.statusCode, authUserId: details.authUserId }) }
