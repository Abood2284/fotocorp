import type { NextRequest } from "next/server"
import { buildAuthProxyRequestHeaders, buildAuthProxyResponseHeaders } from "@/lib/api/bff-proxy-headers"

export function appendForwardedSetCookies(source: Headers, target: Headers) {
  target.delete("set-cookie")
  const withGetSetCookie = source as Headers & { getSetCookie?: () => string[] }
  if (typeof withGetSetCookie.getSetCookie === "function") {
    for (const value of withGetSetCookie.getSetCookie()) {
      if (value) target.append("set-cookie", value)
    }
    return
  }
  const single = source.get("set-cookie")
  if (single) target.append("set-cookie", single)
}

export async function proxyPlatformAuthRequest(request: NextRequest, upstreamPath: string) {
  const apiBaseUrl = process.env.INTERNAL_API_BASE_URL?.trim()
  if (!apiBaseUrl) {
    return Response.json({ error: { code: "AUTH_API_NOT_CONFIGURED" } }, { status: 500 })
  }

  const upstreamUrl = new URL(upstreamPath + request.nextUrl.search, apiBaseUrl)
  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers: buildAuthProxyRequestHeaders(request.headers),
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
    duplex: "half",
  } as RequestInit)

  const headers = buildAuthProxyResponseHeaders(response.headers)
  appendForwardedSetCookies(response.headers, headers)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
