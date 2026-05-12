import type { Env } from "../../../appTypes"
import { createHttpDb } from "../../../db"
import {
  getInternalAdminAssetById,
  getInternalAdminAssetOriginal,
  getInternalAdminAssetPreview,
  getInternalAdminCatalogStats,
  getInternalAdminFilters,
  getInternalAdminPublishEligibility,
  listInternalAdminAssets,
  updateInternalAdminAssetEditorial,
  updateInternalAdminAssetPublish,
} from "../../../lib/assets/admin-catalog"
import { AppError } from "../../../lib/errors"
import { json } from "../../../lib/http"
import { parsePreviewTtl } from "../../../lib/assets/public-assets"
import { listInternalAdminUsers, updateInternalAdminUserSubscription } from "../../../lib/users/internal-admin-users"

interface AdminActor { authUserId: string | null; email: string | null }

export async function listAdminAssetsService(env: Env, request: Request) { return json(await listInternalAdminAssets(db(env), request, env.MEDIA_PREVIEW_TOKEN_SECRET, ttl(env))) }
export async function adminAssetDetailService(env: Env, assetId: string) { return json(await getInternalAdminAssetById(db(env), assetId, env.MEDIA_PREVIEW_TOKEN_SECRET, ttl(env))) }
export async function adminAssetOriginalService(env: Env, assetId: string, actor: AdminActor): Promise<Response> {
  if (!env.MEDIA_ORIGINALS_BUCKET) throw new AppError(500, "ORIGINAL_BUCKET_NOT_CONFIGURED", "Original image service is unavailable.")
  const object = await getInternalAdminAssetOriginal(db(env), env.MEDIA_ORIGINALS_BUCKET, assetId, actor)
  const headers = new Headers()
  headers.set("Content-Type", object.contentType ?? "image/jpeg")
  headers.set("Cache-Control", "private, no-store")
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
  headers.set("Content-Disposition", "inline")
  if (object.etag) headers.set("ETag", object.etag)
  if (object.contentLength !== null && object.contentLength !== undefined) headers.set("Content-Length", String(object.contentLength))
  if (object.uploaded) headers.set("Last-Modified", object.uploaded.toUTCString())
  return new Response(object.body, { status: 200, headers })
}
export async function adminAssetPreviewService(env: Env, assetId: string, variant: "thumb" | "card" | "detail") {
  const object = await getInternalAdminAssetPreview(db(env), env.MEDIA_PREVIEWS_BUCKET, assetId, variant)
  const headers = new Headers()
  headers.set("Content-Type", object.mimeType ?? "image/webp")
  headers.set("Cache-Control", "private, no-store")
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("Content-Disposition", "inline")
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
  if (object.object.etag) headers.set("ETag", object.object.etag)
  if (object.object.contentLength !== null && object.object.contentLength !== undefined) headers.set("Content-Length", String(object.object.contentLength))
  if (object.object.uploaded) headers.set("Last-Modified", object.object.uploaded.toUTCString())
  return new Response(object.object.body, { status: 200, headers })
}
export async function adminAssetUpdateService(env: Env, assetId: string, payload: { caption: string | null; headline: string | null; description: string | null; keywords: string[] | null; categoryId: string | null; eventId: string | null; contributorId: string | null }, actor: AdminActor) {
  return json(await updateInternalAdminAssetEditorial(db(env), assetId, payload, actor, env.MEDIA_PREVIEW_TOKEN_SECRET, ttl(env)))
}
export async function adminAssetPublishStateService(env: Env, assetId: string, payload: { status: "APPROVED" | "REVIEW" | "REJECTED"; visibility: "PUBLIC" | "PRIVATE" }, actor: AdminActor) {
  if (payload.status === "APPROVED" && payload.visibility === "PUBLIC") {
    const check = await getInternalAdminPublishEligibility(db(env), assetId)
    if (!check.assetExists) throw new AppError(404, "ASSET_NOT_FOUND", "Asset was not found.")
    if (!check.eligible) {
      return Response.json({ error: { code: "PREVIEW_NOT_READY", message: "This asset cannot be published until all required watermarked previews are ready.", details: { missingVariants: check.missingVariants } } }, { status: 409 })
    }
  }
  return json(await updateInternalAdminAssetPublish(db(env), assetId, payload, actor, env.MEDIA_PREVIEW_TOKEN_SECRET, ttl(env)))
}
export async function adminStatsService(env: Env) { return json(await getInternalAdminCatalogStats(db(env))) }
export async function adminFiltersService(env: Env) { return json(await getInternalAdminFilters(db(env))) }
export async function adminUsersService(env: Env, request: Request) { return json(await listInternalAdminUsers(db(env), request)) }
export async function adminUserSubscriptionService(env: Env, authUserId: string, isSubscriber: boolean, actor: AdminActor) { return json(await updateInternalAdminUserSubscription(db(env), authUserId, isSubscriber, actor)) }
export function normalizeKeywords(input: string[] | null | undefined): string[] | null { if (!input) return null; const dedup = new Map<string, string>(); for (const keyword of input) { const normalized = keyword.trim(); if (!normalized) continue; const token = normalized.toLowerCase(); if (!dedup.has(token)) { dedup.set(token, normalized); if (dedup.size >= 50) break } } return dedup.size > 0 ? [...dedup.values()] : null }
export function nullable(value: string | null | undefined) { if (value === null || value === undefined) return null; const trimmed = value.trim(); return trimmed ? trimmed : null }
export function actorFromRequest(request: Request): AdminActor { return { authUserId: request.headers.get("x-admin-auth-user-id")?.trim() || null, email: request.headers.get("x-admin-email")?.trim() || null } }
function db(env: Env) { if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured."); return createHttpDb(env.DATABASE_URL) }
function ttl(env: Env) { return parsePreviewTtl(env.MEDIA_PREVIEW_TOKEN_TTL_SECONDS) }
