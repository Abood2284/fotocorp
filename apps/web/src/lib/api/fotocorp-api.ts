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
import { isUuid } from "@/lib/utils"

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
    { cachePolicy: "public-short" },
  )
  const responseItems = Array.isArray(response.items)
    ? response.items
    : Array.isArray(response.assets)
      ? response.assets
      : []

  return {
    items: responseItems.map(normalizeAssetPreviewUrls),
    nextCursor: response.nextCursor ?? null,
    hasMore: response.hasMore === true || Boolean(response.nextCursor),
    totalCount: typeof response.totalCount === "number" ? response.totalCount : undefined,
  }
}

export async function searchAssets(params: PublicAssetListParams = {}): Promise<PublicAssetListResponse> {
  if (!isTypesenseSearchEnabled()) return listPublicAssets(params)

  const searchParams = new URLSearchParams()
  appendParam(searchParams, "q", params.q)
  appendTypesenseScopeParam(searchParams, "categoryId", "category", params.categoryId, params.category)
  appendTypesenseScopeParam(searchParams, "eventId", "event", params.eventId, params.event)
  appendParam(searchParams, "city", params.city)
  appendParam(searchParams, "year", params.year)
  appendParam(searchParams, "month", params.month)
  appendParam(searchParams, "page", params.page)
  appendParam(searchParams, "limit", params.limit)
  appendParam(searchParams, "sort", params.sort)

  const query = searchParams.toString()
  const startedAt = Date.now()
  const response = await getJson<TypesenseSearchResponse>(
    `${resolveSearchAssetsPath()}${query ? `?${query}` : ""}`,
    {
      cachePolicy: "default",
      traceRoute: "/api/public/search/assets",
      layer: typeof window === "undefined" ? "web" : "browser",
    },
  )
  const clientTtfbMs = Date.now() - startedAt

  logTypesenseSearchDebug(params, response, clientTtfbMs)

  return normalizeTypesenseSearchResponse(response)
}

export function isTypesenseSearchEnabled() {
  return process.env.NEXT_PUBLIC_USE_TYPESENSE_SEARCH === "true"
}

export async function getPublicAsset(assetId: string): Promise<PublicAssetDetailResponse> {
  const response = await getJson<PublicAssetDetailResponse>(`/api/v1/assets/${encodeURIComponent(assetId)}`)

  return {
    asset: normalizeAssetPreviewUrls(response.asset),
  }
}

export async function getPublicAssetFilters(
  options: { cachePolicy?: PublicJsonCachePolicy } = {},
): Promise<PublicAssetFiltersResponse> {
  return getJson<PublicAssetFiltersResponse>(resolveFiltersPath(), {
    cachePolicy: options.cachePolicy ?? "public-filters-long",
  })
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

type PublicJsonCachePolicy = "default" | "public-short" | "public-filters-long"

async function getJson<T>(
  path: string,
  options: {
    traceRoute?: string
    layer?: "browser" | "web"
    cachePolicy?: PublicJsonCachePolicy
  } = {},
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort("client_timeout_15s"), 15_000)
  const requestUrl = path.startsWith("/api/public/")
    ? path
    : buildApiAssetUrl(path)
  const requestId = resolveRequestId()
  const tracker = createTimingTracker()

  const revalidateSeconds = typeof window === "undefined"
    ? options.cachePolicy === "public-short"
      ? 30
      : options.cachePolicy === "public-filters-long"
        ? 300
        : null
    : null
  const usePublicRevalidate = revalidateSeconds !== null

  try {
    let response: Response
    try {
      response = await fetch(requestUrl, {
        method: "GET",
        ...(usePublicRevalidate ? { next: { revalidate: revalidateSeconds! } } : { cache: "no-store" as RequestCache }),
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
          mode: usePublicRevalidate ? `revalidate-${revalidateSeconds}` : "no-store",
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

function resolveFiltersPath() {
  return typeof window === "undefined" ? "/api/v1/assets/filters" : "/api/public/assets/filters"
}

function resolveSearchAssetsPath() {
  return typeof window === "undefined" ? "/api/v1/search/assets" : "/api/public/search/assets"
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

function appendTypesenseScopeParam(
  params: URLSearchParams,
  idKey: string,
  nameKey: string,
  idValue: string | undefined,
  nameValue: string | undefined,
) {
  const resolvedId = idValue?.trim()
  const resolvedName = nameValue?.trim()
  if (resolvedId && isUuid(resolvedId)) {
    appendParam(params, idKey, resolvedId)
    return
  }
  if (resolvedName && isUuid(resolvedName)) {
    appendParam(params, idKey, resolvedName)
    return
  }
  appendParam(params, nameKey, resolvedName ?? resolvedId)
}

interface TypesenseFacetItem {
  value?: string
  count?: number
  name?: string
  assetCount?: number
}

type TypesenseSearchAsset = PublicAsset & {
  assetId?: string | null
  eventTitle?: string | null
  categoryName?: string | null
  city?: string | null
  previewUrl?: string | null
  width?: number | null
  height?: number | null
}

interface TypesenseSearchResponse {
  items?: TypesenseSearchAsset[]
  total?: number
  totalCount?: number
  page?: number
  perPage?: number
  limit?: number
  totalPages?: number
  hasMore?: boolean
  facets?: {
    categories?: TypesenseFacetItem[]
    events?: TypesenseFacetItem[]
    cities?: TypesenseFacetItem[]
    sources?: TypesenseFacetItem[]
  }
  timing?: {
    backend?: "typesense"
    tookMs?: number
  }
}

function normalizeTypesenseSearchResponse(response: TypesenseSearchResponse): PublicAssetListResponse {
  const items = Array.isArray(response.items) ? response.items.map(normalizeTypesenseAsset) : []
  const perPage = response.perPage ?? response.limit
  const totalCount = typeof response.total === "number"
    ? response.total
    : typeof response.totalCount === "number"
      ? response.totalCount
      : undefined

  return {
    items,
    nextCursor: null,
    hasMore: response.hasMore === true,
    totalCount,
    page: response.page,
    perPage,
    totalPages: response.totalPages,
    filters: {
      categories: normalizeFacetList(response.facets?.categories),
      events: normalizeFacetList(response.facets?.events).map((event) => ({
        ...event,
        eventDate: null,
      })),
      cities: normalizeFacetList(response.facets?.cities),
      sources: normalizeFacetList(response.facets?.sources),
    },
    timing: {
      backend: "typesense",
      tookMs: response.timing?.tookMs ?? 0,
    },
  }
}

function normalizeTypesenseAsset(asset: TypesenseSearchAsset): PublicAsset {
  const id = asset.id ?? asset.assetId ?? ""
  const cardPreview = asset.previews?.card
    ?? (asset.previewUrl && asset.width && asset.height
      ? { url: asset.previewUrl, width: asset.width, height: asset.height }
      : null)

  return normalizeAssetPreviewUrls({
    ...asset,
    id,
    category: asset.category ?? (asset.categoryName ? { id: asset.categoryName, name: asset.categoryName } : null),
    event: asset.event ?? (asset.eventTitle
      ? { id: asset.eventTitle, name: asset.eventTitle, eventDate: null, location: asset.city ?? null }
      : null),
    previews: {
      thumb: asset.previews?.thumb ?? cardPreview,
      card: cardPreview,
      detail: asset.previews?.detail ?? null,
    },
  })
}

function normalizeFacetList(items: TypesenseFacetItem[] | undefined) {
  return (items ?? [])
    .map((item) => {
      const value = item.value ?? item.name ?? ""
      return {
        id: value,
        name: value,
        assetCount: item.count ?? item.assetCount ?? 0,
      }
    })
    .filter((item) => item.id.length > 0)
}

function logTypesenseSearchDebug(
  params: PublicAssetListParams,
  response: TypesenseSearchResponse,
  clientTtfbMs: number,
) {
  if (process.env.NODE_ENV === "production") return
  console.info(
    JSON.stringify({
      event: "frontend_typesense_search",
      backend: "typesense",
      query: params.q ?? "",
      page: response.page ?? params.page ?? 1,
      filters: {
        category: params.category ?? params.categoryId ?? null,
        event: params.event ?? params.eventId ?? null,
        city: params.city ?? null,
      },
      tookMs: response.timing?.tookMs ?? null,
      clientTtfbMs,
    }),
  )
}
