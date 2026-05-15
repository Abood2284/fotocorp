import { NextResponse } from "next/server"
import { getCurrentAuthUser, getOrCreateAppUser } from "@/lib/app-user"
import { fetchSubscriberAssetDownload, type SubscriberDownloadSize } from "@/lib/api/subscriber-downloads-api"

interface AssetDownloadRouteContext {
  params: Promise<{ assetId: string }>
}

const DOWNLOAD_SIZES = new Set<SubscriberDownloadSize>(["web", "medium", "large"])

export async function GET(request: Request, context: AssetDownloadRouteContext) {
  const { assetId } = await context.params
  const url = new URL(request.url)
  const assetHref = `/assets/${encodeURIComponent(assetId)}`
  const size = parseSize(url.searchParams.get("size"))

  if (!size) {
    return redirectToAsset(url, assetId, "size-not-available")
  }

  const authUser = await getCurrentAuthUser()
  if (!authUser) {
    logDownloadRouteError("session_missing", {
      assetId,
      size,
      statusCode: 401,
      safeErrorCode: "AUTH_REQUIRED",
    })
    const signInUrl = new URL("/sign-in", url.origin)
    signInUrl.searchParams.set("callbackUrl", `${assetHref}?downloadError=not-signed-in`)
    return NextResponse.redirect(signInUrl)
  }

  let appUser: Awaited<ReturnType<typeof getOrCreateAppUser>>
  try {
    appUser = await getOrCreateAppUser(authUser)
  } catch (error) {
    logDownloadRouteError("app_user_lookup_failed", {
      assetId,
      size,
      authUserId: authUser.id,
      safeErrorCode: "PROFILE_LOOKUP_FAILED",
      statusCode: 500,
      detail: error instanceof Error ? error.message : "unknown",
    })
    return redirectToAsset(url, assetId, "profile-lookup-failed")
  }

  if (appUser.status !== "ACTIVE") {
    logDownloadRouteError("profile_inactive", {
      assetId,
      size,
      authUserId: appUser.authUserId,
      safeErrorCode: "SUBSCRIPTION_REQUIRED",
      statusCode: 403,
    })
    return redirectToAsset(url, assetId, "subscription-required")
  }

  let upstream: Response | null = null
  try {
    upstream = await fetchSubscriberAssetDownload({
      assetId,
      authUserId: appUser.authUserId,
      size,
      userAgent: request.headers.get("user-agent"),
      requestIp: getClientIp(request),
    })
  } catch (error) {
    logDownloadRouteError("internal_api_fetch_failed", {
      assetId,
      size,
      authUserId: appUser.authUserId,
      safeErrorCode: "INTERNAL_API_FETCH_FAILED",
      statusCode: 502,
      detail: error instanceof Error ? error.message : "unknown",
    })
  }

  if (!upstream) {
    return redirectToAsset(url, assetId, "download-failed")
  }

  if (!upstream.ok || !upstream.body) {
    const upstreamErrorCode = await readUpstreamErrorCode(upstream)
    logDownloadRouteError("internal_api_non_ok", {
      assetId,
      size,
      authUserId: appUser.authUserId,
      statusCode: upstream.status,
      safeErrorCode: upstreamErrorCode ?? "UNKNOWN_INTERNAL_API_ERROR",
    })
    return redirectToAsset(url, assetId, mapDownloadError(upstreamErrorCode))
  }

  const headers = new Headers()
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream")
  headers.set("Content-Disposition", upstream.headers.get("content-disposition") ?? `attachment; filename="fotocorp-${assetId}-${size}"`)
  headers.set("Cache-Control", "private, no-store")
  headers.set("X-Content-Type-Options", "nosniff")
  const contentLength = upstream.headers.get("content-length")
  if (contentLength) headers.set("Content-Length", contentLength)
  const etag = upstream.headers.get("etag")
  if (etag) headers.set("ETag", etag)
  const lastModified = upstream.headers.get("last-modified")
  if (lastModified) headers.set("Last-Modified", lastModified)

  try {
    return new Response(upstream.body, { status: 200, headers })
  } catch (error) {
    logDownloadRouteError("stream_forwarding_failed", {
      assetId,
      size,
      authUserId: appUser.authUserId,
      safeErrorCode: "DOWNLOAD_STREAM_FAILED",
      statusCode: 500,
      detail: error instanceof Error ? error.message : "unknown",
    })
    return redirectToAsset(url, assetId, "download-failed")
  }
}

function parseSize(value: string | null): SubscriberDownloadSize | null {
  if (!value || !DOWNLOAD_SIZES.has(value as SubscriberDownloadSize)) return null
  return value as SubscriberDownloadSize
}

function redirectToAsset(currentUrl: URL, assetId: string, errorCode: string) {
  const redirectUrl = new URL(`/assets/${encodeURIComponent(assetId)}`, currentUrl.origin)
  redirectUrl.searchParams.set("downloadError", errorCode)
  return NextResponse.redirect(redirectUrl)
}

async function readUpstreamErrorCode(response: Response) {
  try {
    const body = await response.json() as { error?: { code?: string }; ok?: boolean }
    return body.error?.code ?? null
  } catch {
    return null
  }
}

function mapDownloadError(code: string | null) {
  switch (code) {
    case "SUBSCRIPTION_REQUIRED":
    case "PROFILE_NOT_FOUND":
      return "subscription-required"
    case "SUBSCRIPTION_EXPIRED":
      return "subscription-expired"
    case "DOWNLOAD_LIMIT_EXCEEDED":
    case "QUOTA_EXCEEDED":
      return "download-limit-exceeded"
    case "ENTITLEMENT_REQUIRED":
      return "entitlement-required"
    case "QUALITY_NOT_ALLOWED":
      return "quality-not-allowed"
    case "SIZE_NOT_AVAILABLE":
    case "INVALID_DOWNLOAD_SIZE":
    case "INVALID_DOWNLOAD_REQUEST":
      return "size-not-available"
    case "ASSET_NOT_FOUND":
    case "ASSET_NOT_DOWNLOADABLE":
    case "SOURCE_FILE_NOT_FOUND":
      return "asset-unavailable"
    case "INVALID_ASSET_ID":
      return "invalid-asset-id"
    default:
      return "download-failed"
  }
}

function getClientIp(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? null
}

function logDownloadRouteError(
  message: string,
  details: {
    assetId: string
    size: SubscriberDownloadSize
    statusCode: number
    safeErrorCode: string
    authUserId?: string
    detail?: string
  },
) {
  console.error("subscriber_download_web_route_error", {
    message,
    assetId: details.assetId,
    size: details.size,
    statusCode: details.statusCode,
    safeErrorCode: details.safeErrorCode,
    authUserId: details.authUserId,
    detail: details.detail,
  })
}
