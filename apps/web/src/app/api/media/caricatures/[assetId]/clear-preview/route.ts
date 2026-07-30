import { getCurrentAuthUser } from "@/lib/app-user"
import { resolveSubscriberHasCaricatureClearAccess } from "@/lib/caricatures/caricature-clear-access"
import { internalApiFetch, internalApiRoutes } from "@/lib/server/internal-api"
import {
  getOptionalStaffSession,
  getStaffInternalAdminActorHeaders,
} from "@/lib/staff-session"

interface RouteContext {
  params: Promise<{ assetId: string }>
}

const SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const

export async function GET(_request: Request, context: RouteContext) {
  const { assetId } = await context.params
  if (!assetId?.trim()) {
    return Response.json(
      { error: { code: "INVALID_CARICATURE_ID", message: "Caricature id is invalid." } },
      { status: 400, headers: SAFE_HEADERS },
    )
  }

  const staff = await getOptionalStaffSession()
  const authUser = staff ? null : await getCurrentAuthUser()

  if (!staff && !authUser) {
    return Response.json(
      { error: { code: "AUTH_REQUIRED", message: "Authentication is required." } },
      { status: 401, headers: SAFE_HEADERS },
    )
  }

  if (authUser) {
    const hasAccess = await resolveSubscriberHasCaricatureClearAccess(authUser.id)
    if (!hasAccess) {
      return Response.json(
        { error: { code: "ENTITLEMENT_REQUIRED", message: "Caricature access is required." } },
        { status: 403, headers: SAFE_HEADERS },
      )
    }
  }

  const actorHeaders = staff
    ? await getStaffInternalAdminActorHeaders()
    : { "x-auth-user-id": authUser!.id }

  const upstream = await internalApiFetch({
    path: internalApiRoutes.caricatureClearPreview(assetId),
    accept: "image/*",
    headers: actorHeaders,
    timeoutMs: 30_000,
  }).catch(() => null)

  if (!upstream) {
    return Response.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "Clear preview is temporarily unavailable." } },
      { status: 502, headers: SAFE_HEADERS },
    )
  }

  if (!upstream.ok || !upstream.body) {
    const status =
      upstream.status === 400 ||
      upstream.status === 401 ||
      upstream.status === 403 ||
      upstream.status === 404
        ? upstream.status
        : 502
    return Response.json(
      {
        error: {
          code: status === 403 ? "ENTITLEMENT_REQUIRED" : "CLEAR_PREVIEW_UNAVAILABLE",
          message:
            status === 403
              ? "Caricature access is required."
              : status === 404
                ? "Caricature was not found."
                : "Clear preview is temporarily unavailable.",
        },
      },
      { status, headers: SAFE_HEADERS },
    )
  }

  const headers = new Headers()
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream")
  headers.set("Cache-Control", SAFE_HEADERS["Cache-Control"])
  headers.set("X-Content-Type-Options", SAFE_HEADERS["X-Content-Type-Options"])
  headers.set("X-Robots-Tag", SAFE_HEADERS["X-Robots-Tag"])
  headers.set("Content-Disposition", upstream.headers.get("content-disposition") ?? "inline")
  const etag = upstream.headers.get("etag")
  if (etag) headers.set("ETag", etag)
  const lastModified = upstream.headers.get("last-modified")
  if (lastModified) headers.set("Last-Modified", lastModified)
  const contentLength = upstream.headers.get("content-length")
  if (contentLength) headers.set("Content-Length", contentLength)

  return new Response(upstream.body, { status: 200, headers })
}
