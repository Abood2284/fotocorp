import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { buildAuthProxyRequestHeaders, buildAuthProxyResponseHeaders } from "@/lib/api/bff-proxy-headers"
import { FOTOCORP_STAFF_SESSION_COOKIE } from "@/lib/api/staff-api"

interface RouteContext {
  params: Promise<{ articleId: string; mediaId: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const apiBaseUrl = process.env.INTERNAL_API_BASE_URL?.trim()
  if (!apiBaseUrl) {
    return Response.json({ error: { code: "STAFF_API_NOT_CONFIGURED" } }, { status: 500 })
  }

  const { articleId, mediaId } = await context.params
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(FOTOCORP_STAFF_SESSION_COOKIE)
  if (!sessionCookie?.value) {
    return Response.json({ error: { code: "STAFF_UNAUTHORIZED" } }, { status: 401 })
  }

  const upstreamUrl = new URL(
    `/api/v1/staff/help/articles/${encodeURIComponent(articleId)}/media/${encodeURIComponent(mediaId)}/upload`,
    apiBaseUrl,
  )

  const headers = buildAuthProxyRequestHeaders(request.headers)
  headers.set("Cookie", `${FOTOCORP_STAFF_SESSION_COOKIE}=${sessionCookie.value}`)
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("Content-Type", contentType)
  const contentLength = request.headers.get("content-length")
  if (contentLength) headers.set("Content-Length", contentLength)

  const upstream = await fetch(upstreamUrl, {
    method: "PUT",
    headers,
    body: request.body,
    redirect: "manual",
    duplex: "half",
  } as RequestInit).catch(() => null)

  if (!upstream) {
    return Response.json(
      { error: { code: "HELP_MEDIA_UPLOAD_FAILED", message: "Could not reach the help media API." } },
      { status: 502 },
    )
  }

  const responseHeaders = buildAuthProxyResponseHeaders(upstream.headers)
  const responseBody = upstream.ok ? null : await upstream.text()

  return new Response(responseBody, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}
