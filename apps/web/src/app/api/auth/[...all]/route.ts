import { NextRequest } from "next/server"
import {
  createTimingTracker,
  formatServerTiming,
  FOTOCORP_REQUEST_ID_HEADER,
  logLatencyTrace,
  requestIdHeaders,
  resolveRequestId,
} from "@/lib/latency-trace"

const UPSTREAM_UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
])

/** Walks `cause` / `errors` chains from undici/Node `fetch` failures (e.g. AggregateError + ECONNREFUSED). */
export function isUpstreamUnreachableFetchError(error: unknown): boolean {
  const stack: unknown[] = [error]
  const seen = new Set<unknown>()
  while (stack.length) {
    const current = stack.pop()
    if (current === undefined || current === null) continue
    if (typeof current !== "object") continue
    if (seen.has(current)) continue
    seen.add(current)
    const rec = current as { code?: unknown; cause?: unknown; errors?: unknown }
    if (typeof rec.code === "string" && UPSTREAM_UNREACHABLE_CODES.has(rec.code)) return true
    if (rec.cause !== undefined) stack.push(rec.cause)
    if (Array.isArray(rec.errors)) for (const sub of rec.errors) stack.push(sub)
  }
  return false
}

export function GET(request: NextRequest) {
  return proxyAuthRequest(request)
}

export function POST(request: NextRequest) {
  return proxyAuthRequest(request)
}

async function proxyAuthRequest(request: NextRequest) {
  const apiBaseUrl = process.env.INTERNAL_API_BASE_URL?.trim()

  if (!apiBaseUrl) {
    return Response.json({ error: { code: "AUTH_API_NOT_CONFIGURED" } }, { status: 500 })
  }

  const upstreamUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, apiBaseUrl)
  const requestId = resolveRequestId(request)
  const traceGetSession = request.nextUrl.pathname.endsWith("/get-session")
  const tracker = traceGetSession ? createTimingTracker() : null
  const headers = buildAuthProxyRequestHeaders(request.headers)
  for (const [key, value] of Object.entries(requestIdHeaders(requestId))) headers.set(key, value)

  let response: Response
  try {
    response = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
      duplex: "half",
    } as RequestInit)
    tracker?.mark("upstream_fetch")
  } catch (error) {
    if (!isUpstreamUnreachableFetchError(error)) throw error
    if (traceGetSession && tracker) {
      const durationMs = tracker.total()
      const timings = { ...tracker.timings(), total: durationMs }
      logLatencyTrace({
        event: "latency_trace",
        requestId,
        layer: "web",
        route: "/api/auth/get-session",
        status: "error",
        statusCode: 502,
        durationMs,
        timings,
        error: {
          name: error instanceof Error ? error.name : "AuthUpstreamUnavailable",
          message: error instanceof Error ? error.message : "Auth upstream unavailable.",
          upstreamPath: upstreamUrl.pathname + upstreamUrl.search,
        },
      })
    }
    return Response.json(
      {
        error: {
          code: "AUTH_UPSTREAM_UNAVAILABLE",
          message:
            "Cannot reach the auth API. Start the Worker (e.g. repo root `pnpm dev` or `pnpm dev:api`) and ensure INTERNAL_API_BASE_URL matches its listen URL.",
        },
      },
      { status: 502 },
    )
  }

  const outHeaders = buildAuthProxyResponseHeaders(response.headers)
  outHeaders.set(FOTOCORP_REQUEST_ID_HEADER, response.headers.get(FOTOCORP_REQUEST_ID_HEADER) ?? requestId)

  if (traceGetSession && tracker) {
    tracker.mark("response_build")
    const durationMs = tracker.total()
    const timings = { ...tracker.timings(), total: durationMs }
    logLatencyTrace({
      event: "latency_trace",
      requestId: outHeaders.get(FOTOCORP_REQUEST_ID_HEADER) ?? requestId,
      layer: "web",
      route: "/api/auth/get-session",
      status: response.ok ? "ok" : "error",
      statusCode: response.status,
      durationMs,
      timings,
      cache: { mode: "auth-proxy", hit: false, cacheControl: outHeaders.get("cache-control") },
    })
    outHeaders.set("Server-Timing", formatServerTiming(timings, durationMs))
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  })
}

export function buildAuthProxyRequestHeaders(sourceHeaders: Headers) {
  const headers = new Headers(sourceHeaders)
  headers.delete("host")
  headers.delete("content-length")
  headers.delete("accept-encoding")
  headers.delete("connection")
  headers.delete("transfer-encoding")
  return headers
}

export function buildAuthProxyResponseHeaders(sourceHeaders: Headers) {
  const headers = new Headers(sourceHeaders)
  headers.delete("content-encoding")
  headers.delete("content-length")
  headers.delete("transfer-encoding")
  headers.delete("connection")
  headers.delete("keep-alive")
  return headers
}
