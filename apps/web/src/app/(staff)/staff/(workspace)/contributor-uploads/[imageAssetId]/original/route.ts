import { fetchStaffContributorUploadOriginal } from "@/lib/api/staff-contributor-uploads-api"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"
import { getOptionalStaffSession } from "@/lib/staff-session"

interface AdminContributorUploadOriginalRouteContext {
  params: Promise<{ imageAssetId: string }>
}

const SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const

export async function GET(_request: Request, context: AdminContributorUploadOriginalRouteContext) {
  const staffSession = await getOptionalStaffSession()
  if (!staffSession) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "You are not allowed to view this image." } },
      { status: 401, headers: SAFE_HEADERS },
    )
  }

  const { imageAssetId } = await context.params
  const path = `/staff/contributor-uploads/${encodeURIComponent(imageAssetId)}/original`
  if (!staffRoleCanAccessPath(staffSession.staff.role, path)) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Your staff role cannot access contributor originals." } },
      { status: 403, headers: SAFE_HEADERS },
    )
  }

  const upstream = await fetchStaffContributorUploadOriginal(imageAssetId).catch(() => null)
  if (!upstream) {
    return Response.json(
      {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Original image service is unavailable.",
        },
      },
      { status: 502, headers: SAFE_HEADERS },
    )
  }

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 400 || upstream.status === 401 || upstream.status === 403 || upstream.status === 404 || upstream.status === 409
      ? upstream.status
      : 502
    const message = status === 502
      ? "Original image service is unavailable."
      : "Original image is not available."
    return Response.json(
      { error: { code: "ORIGINAL_UNAVAILABLE", message } },
      { status, headers: SAFE_HEADERS },
    )
  }

  const headers = new Headers()
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream")
  headers.set("Cache-Control", "private, no-store")
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
  const upstreamDisposition = upstream.headers.get("content-disposition")
  headers.set("Content-Disposition", upstreamDisposition ?? "inline")
  const etag = upstream.headers.get("etag")
  if (etag) headers.set("ETag", etag)
  const lastModified = upstream.headers.get("last-modified")
  if (lastModified) headers.set("Last-Modified", lastModified)
  const contentLength = upstream.headers.get("content-length")
  if (contentLength) headers.set("Content-Length", contentLength)

  return new Response(upstream.body, { status: 200, headers })
}
