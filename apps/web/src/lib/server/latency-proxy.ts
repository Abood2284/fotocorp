// apps/web/src/lib/server/latency-proxy.ts
import {
  createTimingTracker,
  formatServerTiming,
  FOTOCORP_REQUEST_ID_HEADER,
  logLatencyTrace,
  requestIdHeaders,
  resolveRequestId,
  serializeFetchError,
  upstreamPathOnly,
} from "@/lib/latency-trace"
import { buildAuthProxyRequestHeaders } from "@/lib/api/bff-proxy-headers"

interface TracedProxyOptions {
  request: Request
  route: string
  upstreamUrl: string
  upstreamFetch?: typeof fetch
  cacheMode?: string
  accept?: string
  upstreamRevalidateSeconds?: number
  passthroughCacheControl?: boolean
  responseCacheControl?: string
  responseBody?: boolean
}

export async function tracedUpstreamProxy(options: TracedProxyOptions): Promise<Response> {
  const startedAt = Date.now()
  const requestId = resolveRequestId(options.request)
  const tracker = createTimingTracker(startedAt)
  const upstreamPath = upstreamPathOnly(options.upstreamUrl)

  let upstream: Response | null = null
  let fetchError: ReturnType<typeof serializeFetchError> | null = null

  const incomingMethod = options.request.method
  const upstreamHeaders =
    incomingMethod === "GET" || incomingMethod === "HEAD"
      ? new Headers({
          Accept: options.accept ?? "application/json",
          ...requestIdHeaders(requestId),
        })
      : buildAuthProxyRequestHeaders(options.request.headers)

  for (const [key, value] of Object.entries(requestIdHeaders(requestId))) {
    upstreamHeaders.set(key, value)
  }
  if (!upstreamHeaders.has("Accept")) {
    upstreamHeaders.set("Accept", options.accept ?? "application/json")
  }

  const upstreamFetchInit: RequestInit & { next?: { revalidate: number }; duplex?: "half" } = {
    method: incomingMethod,
    headers: upstreamHeaders,
  }
  if (incomingMethod !== "GET" && incomingMethod !== "HEAD") {
    upstreamFetchInit.body = options.request.body
    upstreamFetchInit.duplex = "half"
  }
  if (options.upstreamRevalidateSeconds) {
    upstreamFetchInit.next = { revalidate: options.upstreamRevalidateSeconds }
  } else {
    upstreamFetchInit.cache = "no-store"
  }

  try {
    upstream = await (options.upstreamFetch ?? fetch)(options.upstreamUrl, upstreamFetchInit)
    tracker.mark("upstream_fetch")
  } catch (error) {
    fetchError = serializeFetchError(error)
    tracker.mark("upstream_fetch")
  }

  if (fetchError || !upstream) {
    const durationMs = tracker.total()
    const timings = tracker.timings()
    timings.total = durationMs

    logLatencyTrace({
      event: "latency_trace",
      requestId,
      layer: "web",
      route: options.route,
      status: "error",
      statusCode: 502,
      durationMs,
      timings,
      cache: {
        mode: options.cacheMode ?? "no-store",
        hit: false,
        cacheControl: "private, no-store",
      },
      error: {
        ...fetchError ?? { name: "FetchError", message: "Upstream fetch failed." },
        upstreamPath,
      },
    })

    return new Response(
      JSON.stringify({
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Upstream service is unavailable.",
        },
      }),
      {
        status: 502,
        headers: buildProxyResponseHeaders({
          requestId,
          serverTiming: formatServerTiming(timings, durationMs),
          cacheControl: "private, no-store",
          contentType: "application/json",
        }),
      },
    )
  }

  const bodyText = await upstream.text()
  tracker.mark("json_parse")

  const responseCacheControl = options.responseCacheControl
    ?? (options.passthroughCacheControl
      ? (upstream.headers.get("cache-control") ?? "private, no-store")
      : "private, no-store")

  const responseHeaders = buildProxyResponseHeaders({
    requestId,
    serverTiming: formatServerTiming(
      {
        ...tracker.timings(),
        response_build: 0,
      },
      tracker.total(),
    ),
    cacheControl: responseCacheControl,
    contentType: upstream.headers.get("content-type") ?? "application/json",
    upstreamRequestId: upstream.headers.get(FOTOCORP_REQUEST_ID_HEADER),
  })
  tracker.mark("response_build")

  const durationMs = tracker.total()
  const timings = {
    ...tracker.timings(),
    total: durationMs,
  }

  logLatencyTrace({
    event: "latency_trace",
    requestId,
    layer: "web",
    route: options.route,
    status: upstream.ok ? "ok" : "error",
    statusCode: upstream.status,
    durationMs,
    timings,
    cache: {
      mode: options.cacheMode ?? "no-store",
      hit: false,
      cacheControl: responseHeaders.get("Cache-Control"),
    },
    ...(!upstream.ok
      ? {
          error: {
            name: "UpstreamHttpError",
            message: `Upstream responded with ${upstream.status}.`,
            upstreamPath,
          },
        }
      : {}),
  })

  return new Response(options.responseBody === false ? null : bodyText, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

interface TracedBinaryProxyOptions {
  request: Request
  route: string
  upstreamUrl: string
  accept?: string
}

export async function tracedUpstreamBinaryProxy(options: TracedBinaryProxyOptions): Promise<Response> {
  const startedAt = Date.now()
  const requestId = resolveRequestId(options.request)
  const tracker = createTimingTracker(startedAt)
  const upstreamPath = upstreamPathOnly(options.upstreamUrl)

  let upstream: Response | null = null
  let fetchError: ReturnType<typeof serializeFetchError> | null = null

  try {
    upstream = await fetch(options.upstreamUrl, {
      method: "GET",
      headers: {
        Accept: options.accept ?? "image/*",
        ...requestIdHeaders(requestId),
      },
    })
    tracker.mark("upstream_fetch")
  } catch (error) {
    fetchError = serializeFetchError(error)
    tracker.mark("upstream_fetch")
  }

  if (fetchError || !upstream) {
    const durationMs = tracker.total()
    const timings = { ...tracker.timings(), total: durationMs }

    logLatencyTrace({
      event: "latency_trace",
      requestId,
      layer: "web",
      route: options.route,
      status: "error",
      statusCode: 502,
      durationMs,
      timings,
      cache: { mode: "proxy", hit: false, cacheControl: "private, no-store" },
      error: {
        ...fetchError ?? { name: "FetchError", message: "Upstream fetch failed." },
        upstreamPath,
      },
    })

    return new Response("Preview service is unavailable.", {
      status: 502,
      headers: buildProxyResponseHeaders({
        requestId,
        serverTiming: formatServerTiming(timings, durationMs),
        cacheControl: "private, no-store",
      }),
    })
  }

  const headers = buildProxyResponseHeaders({
    requestId,
    serverTiming: formatServerTiming({ ...tracker.timings(), response_build: 0 }, tracker.total()),
    cacheControl: upstream.headers.get("cache-control") ?? "private, no-store",
    contentType: upstream.headers.get("content-type") ?? undefined,
    upstreamRequestId: upstream.headers.get(FOTOCORP_REQUEST_ID_HEADER),
  })

  const contentType = upstream.headers.get("content-type")
  if (contentType) headers.set("Content-Type", contentType)
  const etag = upstream.headers.get("etag")
  if (etag) headers.set("ETag", etag)
  const lastModified = upstream.headers.get("last-modified")
  if (lastModified) headers.set("Last-Modified", lastModified)
  const contentLength = upstream.headers.get("content-length")
  if (contentLength) headers.set("Content-Length", contentLength)

  tracker.mark("response_build")
  const durationMs = tracker.total()

  logLatencyTrace({
    event: "latency_trace",
    requestId,
    layer: "web",
    route: options.route,
    status: upstream.ok ? "ok" : "error",
    statusCode: upstream.status,
    durationMs,
    timings: { ...tracker.timings(), total: durationMs },
    cache: {
      mode: "proxy",
      hit: false,
      cacheControl: headers.get("Cache-Control"),
    },
    ...(!upstream.ok
      ? {
          error: {
            name: "UpstreamHttpError",
            message: `Upstream responded with ${upstream.status}.`,
            upstreamPath,
          },
        }
      : {}),
  })

  if (!upstream.ok) {
    const body = await upstream.text()
    return new Response(body, { status: upstream.status, headers })
  }

  return new Response(upstream.body, { status: upstream.status, headers })
}

function buildProxyResponseHeaders(input: {
  requestId: string
  serverTiming: string
  cacheControl: string
  contentType?: string | null
  upstreamRequestId?: string | null
}): Headers {
  const headers = new Headers()
  headers.set(FOTOCORP_REQUEST_ID_HEADER, input.requestId)
  headers.set("Server-Timing", input.serverTiming)
  headers.set("Cache-Control", input.cacheControl)
  headers.set("X-Content-Type-Options", "nosniff")
  if (input.contentType) headers.set("Content-Type", input.contentType)
  if (input.upstreamRequestId) headers.set("x-upstream-request-id", input.upstreamRequestId)
  return headers
}
