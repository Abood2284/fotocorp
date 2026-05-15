import { getOptionalStaffSession } from "@/lib/staff-session"
import { getAdminAssetPreview } from "@/lib/api/admin-assets-api"

interface AdminAssetPreviewRouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: AdminAssetPreviewRouteContext) {
  const staffSession = await getOptionalStaffSession()
  if (!staffSession) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "You are not allowed to view this image." } },
      { status: 401, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    )
  }

  const variant = new URL(request.url).searchParams.get("variant")
  if (!(variant === "thumb" || variant === "card" || variant === "detail")) {
    return Response.json(
      { error: { code: "INVALID_VARIANT", message: "Preview variant is invalid." } },
      { status: 400, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    )
  }

  const { id } = await context.params
  const upstream = await getAdminAssetPreview(id, variant).catch(() => null)
  if (!upstream) {
    return Response.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "Preview image service is unavailable." } },
      { status: 502, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    )
  }

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 400 || upstream.status === 404 || upstream.status === 409 ? upstream.status : 502
    const message = status === 502 ? "Preview image service is unavailable." : "Preview image is not available."
    return Response.json(
      { error: { code: "PREVIEW_UNAVAILABLE", message } },
      { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    )
  }

  const headers = new Headers()
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "image/webp")
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
