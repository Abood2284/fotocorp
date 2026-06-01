import type { NextRequest } from "next/server"
import { buildAuthProxyRequestHeaders, buildAuthProxyResponseHeaders } from "@/lib/api/bff-proxy-headers"

interface AuthMeResponse {
  ok?: boolean
  user?: {
    id: string
    email: string
    name?: string | null
    username?: string | null
  }
}

export async function GET(request: NextRequest) {
  const apiBaseUrl = process.env.INTERNAL_API_BASE_URL?.trim()
  if (!apiBaseUrl) {
    return Response.json({ error: { code: "AUTH_API_NOT_CONFIGURED" } }, { status: 500 })
  }

  const cookieHeader = request.headers.get("cookie") ?? ""
  if (!cookieHeader.includes("fotocorp_session=")) {
    return new Response(null, { status: 401 })
  }

  const headers = buildAuthProxyRequestHeaders(request.headers)
  const upstreamUrl = new URL("/api/v1/auth/me", apiBaseUrl)

  let response: Response
  try {
    response = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    })
  } catch {
    return Response.json(
      { error: { code: "AUTH_UPSTREAM_UNAVAILABLE", message: "Auth API is unavailable." } },
      { status: 502 },
    )
  }

  if (response.status === 401) {
    return new Response(null, { status: 401 })
  }

  if (!response.ok) {
    const outHeaders = buildAuthProxyResponseHeaders(response.headers)
    return new Response(response.body, { status: response.status, headers: outHeaders })
  }

  const payload = (await response.json()) as AuthMeResponse
  if (!payload.user?.id) {
    return new Response(null, { status: 401 })
  }

  return Response.json({
    user: {
      id: payload.user.id,
      email: payload.user.email,
      name: payload.user.name ?? null,
      image: null,
    },
  })
}
