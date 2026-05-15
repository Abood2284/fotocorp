import type { NextRequest } from "next/server"
import { buildAuthProxyRequestHeaders, buildAuthProxyResponseHeaders } from "@/app/api/auth/[...all]/route"

function appendForwardedSetCookies(source: Headers, target: Headers) {
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

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyPhotographerRequest(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyPhotographerRequest(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyPhotographerRequest(request, context)
}

interface RouteContext {
  params: Promise<{
    path?: string[]
  }>
}

async function proxyPhotographerRequest(request: NextRequest, context: RouteContext) {
  const apiBaseUrl = process.env.INTERNAL_API_BASE_URL?.trim()
  if (!apiBaseUrl) {
    return Response.json({ error: { code: "CONTRIBUTOR_API_NOT_CONFIGURED" } }, { status: 500 })
  }

  const params = await context.params
  const path = params.path?.join("/") ?? ""
  const upstreamUrl = new URL(`/api/v1/contributor/${path}${request.nextUrl.search}`, apiBaseUrl)

  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers: buildAuthProxyRequestHeaders(request.headers),
    body: request.body,
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
