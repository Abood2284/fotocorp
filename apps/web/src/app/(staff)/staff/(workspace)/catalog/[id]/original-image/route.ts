import { getOptionalStaffSession } from "@/lib/staff-session"
import { getAdminAssetOriginal } from "@/lib/api/admin-assets-api"

interface AdminAssetOriginalRouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: AdminAssetOriginalRouteContext) {
  const staffSession = await getOptionalStaffSession()
  if (!staffSession) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "You are not allowed to view this image." } },
      { status: 401, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    )
  }

  const { id } = await context.params
  const upstream = await getAdminAssetOriginal(id).catch(() => null)
  if (!upstream) {
    return Response.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "Original image service is unavailable." } },
      { status: 502, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    )
  }

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 400 || upstream.status === 404 || upstream.status === 409 ? upstream.status : 502
    const message = status === 502
      ? "Original image service is unavailable."
      : "Original image is not available."
    return Response.json(
      { error: { code: "ORIGINAL_UNAVAILABLE", message } },
      { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    )
  }

  const headers = new Headers()
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "image/jpeg")
  headers.set("Cache-Control", "private, no-store")
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
  headers.set("Content-Disposition", "inline")
  const etag = upstream.headers.get("etag")
  if (etag) headers.set("ETag", etag)
  const lastModified = upstream.headers.get("last-modified")
  if (lastModified) headers.set("Last-Modified", lastModified)
  const contentLength = upstream.headers.get("content-length")
  if (contentLength) headers.set("Content-Length", contentLength)

  return new Response(upstream.body, { status: 200, headers })
}
