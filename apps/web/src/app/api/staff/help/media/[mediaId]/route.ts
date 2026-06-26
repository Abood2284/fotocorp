import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { FOTOCORP_STAFF_SESSION_COOKIE } from "@/lib/api/staff-api"

interface RouteContext {
  params: Promise<{ mediaId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const apiBaseUrl = process.env.INTERNAL_API_BASE_URL?.trim()
  if (!apiBaseUrl) {
    return Response.json({ error: { code: "STAFF_API_NOT_CONFIGURED" } }, { status: 500 })
  }

  const { mediaId } = await context.params
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(FOTOCORP_STAFF_SESSION_COOKIE)
  if (!sessionCookie?.value) {
    return Response.json({ error: { code: "STAFF_UNAUTHORIZED" } }, { status: 401 })
  }

  const upstreamUrl = new URL(`/api/v1/staff/help/media/${encodeURIComponent(mediaId)}`, apiBaseUrl)
  const headers = new Headers()
  headers.set("Cookie", `${FOTOCORP_STAFF_SESSION_COOKIE}=${sessionCookie.value}`)
  headers.set("Accept", "*/*")
  const range = request.headers.get("range")
  if (range) headers.set("Range", range)

  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers,
    redirect: "manual",
  }).catch(() => null)

  if (!upstream || !upstream.body) {
    return Response.json(
      { error: { code: "HELP_MEDIA_UNAVAILABLE", message: "Help media is temporarily unavailable." } },
      { status: 502 },
    )
  }

  if (!upstream.ok) {
    const status = upstream.status === 401 || upstream.status === 403 || upstream.status === 404 ? upstream.status : 502
    return Response.json(
      { error: { code: "HELP_MEDIA_UNAVAILABLE", message: "Help media is not available." } },
      { status },
    )
  }

  const responseHeaders = new Headers()
  responseHeaders.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream")
  responseHeaders.set("Cache-Control", "private, max-age=300")
  responseHeaders.set("X-Content-Type-Options", "nosniff")
  responseHeaders.set("X-Robots-Tag", "noindex, nofollow, noarchive")
  responseHeaders.set("Accept-Ranges", upstream.headers.get("accept-ranges") ?? "bytes")
  responseHeaders.set("Content-Disposition", upstream.headers.get("content-disposition") ?? "inline")

  const contentLength = upstream.headers.get("content-length")
  if (contentLength) responseHeaders.set("Content-Length", contentLength)
  const contentRange = upstream.headers.get("content-range")
  if (contentRange) responseHeaders.set("Content-Range", contentRange)
  const etag = upstream.headers.get("etag")
  if (etag) responseHeaders.set("ETag", etag)
  const lastModified = upstream.headers.get("last-modified")
  if (lastModified) responseHeaders.set("Last-Modified", lastModified)

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}
