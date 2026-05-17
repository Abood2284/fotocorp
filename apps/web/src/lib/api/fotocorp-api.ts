import type {
  PublicAsset,
  PublicAssetCollectionsResponse,
  PublicAssetDetailResponse,
  PublicAssetFiltersResponse,
  PublicAssetListParams,
  PublicAssetListResponse,
  PublicEventListResponse,
  PublicHomepageFeed,
  PublicHomepageFeedResult,
  PublicLatestEventsResponse,
} from "@/features/assets/types"
import {
  createTimingTracker,
  FOTOCORP_REQUEST_ID_HEADER,
  logLatencyTrace,
  requestIdHeaders,
  resolveRequestId,
  serializeFetchError,
} from "@/lib/latency-trace"

function normalizePublicApiOrigin(value: string) {
  return value.trim().replace(/\/+$/, "")
}

function getPublicApiBaseUrl() {
  const fromPublic = process.env.PUBLIC_API_BASE_URL
  if (fromPublic?.trim()) return normalizePublicApiOrigin(fromPublic)
  const fromNextPublic = process.env.NEXT_PUBLIC_API_BASE_URL
  if (fromNextPublic?.trim()) return normalizePublicApiOrigin(fromNextPublic)
  return ""
}

export class FotocorpApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = "FotocorpApiError"
  }
}

export function hasFotocorpApiBaseUrl() {
  return getPublicApiBaseUrl().length > 0
}

export function buildApiAssetUrl(path: string) {
  const apiBaseUrl = getPublicApiBaseUrl()
  if (!apiBaseUrl) {
    throw new FotocorpApiError("Fotocorp API base URL is not configured.", 500, "API_BASE_URL_MISSING")
  }

  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${apiBaseUrl}${normalizedPath}`
}

export async function listPublicAssets(params: PublicAssetListParams = {}): Promise<PublicAssetListResponse> {
  const searchParams = new URLSearchParams()
  appendParam(searchParams, "q", params.q)
  appendParam(searchParams, "categoryId", params.categoryId)
  appendParam(searchParams, "eventId", params.eventId)
  appendParam(searchParams, "contributorId", params.contributorId)
  appendParam(searchParams, "year", params.year)
  appendParam(searchParams, "month", params.month)
  appendParam(searchParams, "cursor", params.cursor)
  appendParam(searchParams, "limit", params.limit)
  appendParam(searchParams, "sort", params.sort)

  const query = searchParams.toString()
  const response = await getJson<PublicAssetListResponse & { assets?: PublicAsset[] }>(
    `${resolveAssetsPath()}${query ? `?${query}` : ""}`,
  )
  const responseItems = Array.isArray(response.items)
    ? response.items
    : Array.isArray(response.assets)
      ? response.assets
      : []

  return {
    items: responseItems.map(normalizeAssetPreviewUrls),
    nextCursor: response.nextCursor ?? null,
    totalCount: typeof response.totalCount === "number" ? response.totalCount : undefined,
  }
}

export async function getPublicAsset(assetId: string): Promise<PublicAssetDetailResponse> {
  const response = await getJson<PublicAssetDetailResponse>(`/api/v1/assets/${encodeURIComponent(assetId)}`)

  return {
    asset: normalizeAssetPreviewUrls(response.asset),
  }
}

export async function getPublicAssetFilters(): Promise<PublicAssetFiltersResponse> {
  return getJson<PublicAssetFiltersResponse>("/api/v1/assets/filters")
}

export async function getPublicAssetCollections(): Promise<PublicAssetCollectionsResponse> {
  const response = await getJson<PublicAssetCollectionsResponse>("/api/v1/assets/collections")
  return {
    items: response.items.map((item) => ({
      ...item,
      preview: normalizePreview(item.preview),
    })),
  }
}

export async function listPublicEvents(): Promise<PublicEventListResponse> {
  const response = await getJson<PublicEventListResponse>("/api/v1/assets/events")
  return {
    items: response.items.map((item) => ({
      ...item,
      preview: normalizePreview(item.preview),
    })),
  }
}

const HOMEPAGE_FEED_ENDPOINT = "GET /api/v1/public/homepage"
const LATEST_EVENTS_ENDPOINT = "GET /api/v1/public/events/latest"

export async function fetchPublicHomepageFeed(): Promise<PublicHomepageFeedResult> {
  const startedAt = Date.now()

  try {
    const feed = await getJson<PublicHomepageFeed>("/api/v1/public/homepage")
    const durationMs = Date.now() - startedAt

    console.info(
      JSON.stringify({
        endpoint: HOMEPAGE_FEED_ENDPOINT,
        durationMs,
        latestEventsPreviewCount: feed.latestEventsPreview.items.length,
        status: "ok",
      }),
    )

    return { ok: true, feed, durationMs }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const details = error instanceof FotocorpApiError
      ? { message: error.message, code: error.code, status: error.status }
      : { message: error instanceof Error ? error.message : "Unknown homepage feed error" }

    console.error(
      JSON.stringify({
        endpoint: HOMEPAGE_FEED_ENDPOINT,
        durationMs,
        latestEventsPreviewCount: 0,
        status: "error",
        errorMessage: details.message,
        errorCode: "code" in details ? details.code : undefined,
        errorStatus: "status" in details ? details.status : undefined,
      }),
    )

    return {
      ok: false,
      error: details.message,
      code: "code" in details ? details.code : undefined,
      status: "status" in details ? details.status : undefined,
      durationMs,
    }
  }
}

export async function fetchPublicLatestEvents(params: {
  windowDays?: number
  limit?: number
  cursor?: string | null
} = {}): Promise<PublicLatestEventsResponse> {
  const searchParams = new URLSearchParams()
  appendParam(searchParams, "windowDays", params.windowDays)
  appendParam(searchParams, "limit", params.limit)
  appendParam(searchParams, "cursor", params.cursor ?? undefined)
  const query = searchParams.toString()
  const path = `${resolveLatestEventsPath()}${query ? `?${query}` : ""}`

  return getJson<PublicLatestEventsResponse>(path, {
    traceRoute: "/api/public/events/latest",
    layer: "browser",
  })
}

async function getJson<T>(
  path: string,
  options: { traceRoute?: string; layer?: "browser" | "web" } = {},
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort("client_timeout_15s"), 15_000)
  const requestUrl = path.startsWith("/api/public/")
    ? path
    : buildApiAssetUrl(path)
  const requestId = resolveRequestId()
  const tracker = createTimingTracker()

  try {
    let response: Response
    try {
      response = await fetch(requestUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...requestIdHeaders(requestId),
        },
      })
      tracker.mark("upstream_fetch")
    } catch (error) {
      if (options.traceRoute) {
        const serialized = serializeFetchError(error)
        logLatencyTrace({
          event: "latency_trace",
          requestId,
          layer: options.layer ?? "browser",
          route: options.traceRoute,
          status: "error",
          statusCode: 0,
          durationMs: tracker.total(),
          timings: { ...tracker.timings(), total: tracker.total() },
          error: {
            ...serialized,
            upstreamPath: requestUrl.startsWith("http")
              ? new URL(requestUrl).pathname + new URL(requestUrl).search
              : requestUrl,
          },
        })
      }
      throw error
    }

    if (!response.ok) {
      const error = await readApiError(response)
      if (options.traceRoute) {
        logLatencyTrace({
          event: "latency_trace",
          requestId: response.headers.get(FOTOCORP_REQUEST_ID_HEADER) ?? requestId,
          layer: options.layer ?? "browser",
          route: options.traceRoute,
          status: "error",
          statusCode: response.status,
          durationMs: tracker.total(),
          timings: { ...tracker.timings(), total: tracker.total() },
          error: {
            name: "UpstreamHttpError",
            message: error.message,
            upstreamPath: requestUrl.startsWith("http")
              ? new URL(requestUrl).pathname + new URL(requestUrl).search
              : requestUrl,
          },
        })
      }
      throw new FotocorpApiError(error.message, response.status, error.code)
    }

    const payload = (await response.json()) as T
    tracker.mark("json_parse")

    if (options.traceRoute) {
      logLatencyTrace({
        event: "latency_trace",
        requestId: response.headers.get(FOTOCORP_REQUEST_ID_HEADER) ?? requestId,
        layer: options.layer ?? "browser",
        route: options.traceRoute,
        status: "ok",
        statusCode: response.status,
        durationMs: tracker.total(),
        timings: { ...tracker.timings(), total: tracker.total() },
        cache: {
          mode: "no-store",
          hit: false,
          cacheControl: response.headers.get("cache-control"),
        },
      })
    }

    return payload
  } finally {
    clearTimeout(timeout)
  }
}

function resolveAssetsPath() {
  return typeof window === "undefined" ? "/api/v1/assets" : "/api/public/assets"
}

function resolveLatestEventsPath() {
  return typeof window === "undefined" ? "/api/v1/public/events/latest" : "/api/public/events/latest"
}

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } }
    return {
      code: body.error?.code,
      message: body.error?.message ?? `Fotocorp API request failed with ${response.status}.`,
    }
  } catch {
    return {
      code: undefined,
      message: `Fotocorp API request failed with ${response.status}.`,
    }
  }
}

function normalizeAssetPreviewUrls(asset: PublicAsset): PublicAsset {
  return {
    ...asset,
    previews: {
      thumb: normalizePreview(asset.previews.thumb),
      card: normalizePreview(asset.previews.card),
      detail: normalizePreview(asset.previews.detail ?? null),
    },
  }
}

function normalizePreview<T extends { url: string } | null>(preview: T): T {
  if (!preview) return preview
  return {
    ...preview,
    url: buildApiAssetUrl(preview.url),
  }
}

function appendParam(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined || value === "") return
  params.set(key, String(value))
}
