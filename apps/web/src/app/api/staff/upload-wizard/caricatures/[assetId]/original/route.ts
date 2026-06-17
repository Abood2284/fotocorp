import { internalApiFetch, internalApiRoutes } from "@/lib/server/internal-api"
import { requireStaffUploadWizardSession, STAFF_UPLOAD_WIZARD_SAFE_HEADERS } from "@/lib/server/staff-upload-wizard-guard"

interface RouteContext {
  params: Promise<{ assetId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireStaffUploadWizardSession()
  if (!gate.ok) return gate.response

  const { assetId } = await context.params
  const upstream = await internalApiFetch({
    path: internalApiRoutes.adminCaricatureOriginal(assetId),
    headers: gate.headers,
  }).catch(() => null)

  if (!upstream) {
    return Response.json(
      {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Original caricature service is unavailable.",
        },
      },
      { status: 502, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
    )
  }

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 400 || upstream.status === 401 || upstream.status === 403 || upstream.status === 404
      ? upstream.status
      : 502
    const message = status === 502
      ? "Original caricature service is unavailable."
      : "Original caricature is not available."
    return Response.json(
      { error: { code: "ORIGINAL_UNAVAILABLE", message } },
      { status, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
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
