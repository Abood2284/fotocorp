import type {
  PublicAsset,
  PublicAssetCollectionsResponse,
  PublicAssetDetailResponse,
  PublicAssetFiltersResponse,
  PublicAssetListParams,
  PublicAssetListResponse,
  PublicEventListResponse,
} from "@/features/assets/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? ""

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
  return API_BASE_URL.length > 0
}

export function buildApiAssetUrl(path: string) {
  if (!API_BASE_URL) {
    throw new FotocorpApiError("Fotocorp API base URL is not configured.", 500, "API_BASE_URL_MISSING")
  }

  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
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

async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  const requestUrl = path.startsWith("/api/public/")
    ? path
    : buildApiAssetUrl(path)
  const response = await fetch(requestUrl, {
    method: "GET",
    cache: "no-store",
    signal: controller.signal,
    headers: {
      Accept: "application/json",
    },
  }).finally(() => clearTimeout(timeout))

  if (!response.ok) {
    const error = await readApiError(response)
    throw new FotocorpApiError(error.message, response.status, error.code)
  }

  return response.json() as Promise<T>
}

function resolveAssetsPath() {
  return typeof window === "undefined" ? "/api/v1/assets" : "/api/public/assets"
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
