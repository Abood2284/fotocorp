import { collectTopKeywords, filterAssets, sortAssets } from "@/features/assets/filter-utils"
import type { AssetRepository, AssetSearchParams, AssetSearchResult } from "@/features/assets/repository/types"
import type { AdminAssetRecord, AdminAssetStatus, IngestionRun } from "@/lib/fixtures/admin"
import type { AssetListItem } from "@/types"

interface CreateApiAssetRepositoryOptions {
  baseUrl: string
  fallbackRepository?: AssetRepository
}

interface ApiListResponse<T> {
  items?: T[]
}

interface ApiItemResponse<T> {
  item?: T
}

interface ApiAssetListItem {
  id?: string
  title?: string
  filename?: string
  previewUrl?: string
  thumbnailUrl?: string
  tags?: string[]
}

interface ApiAssetDetail extends ApiAssetListItem {
  dimensions?: {
    width?: number
    height?: number
  }
}

interface ApiAdminAssetListItem extends ApiAssetListItem {
  ingestionStatus?: "indexed" | "processing" | "failed"
  ingestionRunId?: string
}

interface ApiAdminAssetDetail extends ApiAssetDetail {
  ingestionStatus?: "indexed" | "processing" | "failed"
  ingestionRunId?: string
  checksumSha256?: string
  metadata?: Record<string, string | number | boolean | null>
}

interface ApiIngestionRun {
  id?: string
  source?: string
  status?: "completed" | "running" | "failed"
  startedAt?: string
  completedAt?: string | null
  discoveredCount?: number
  importedCount?: number
  failedCount?: number
}

export function createApiAssetRepository({
  baseUrl,
  fallbackRepository,
}: CreateApiAssetRepositoryOptions): AssetRepository {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "")

  async function withFallback<T>({
    primary,
    fallback,
  }: {
    primary: () => Promise<T>
    fallback: () => Promise<T>
  }): Promise<T> {
    try {
      return await primary()
    } catch {
      return fallback()
    }
  }

  async function getJsonOrThrow<T>(path: string): Promise<T> {
    const response = await fetch(`${normalizedBaseUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) throw new Error(`Request failed (${response.status})`)
    return response.json() as Promise<T>
  }

  function mapApiAssetToListItem(asset: ApiAssetListItem): AssetListItem | null {
    if (!asset.id || !asset.filename) return null
    const title = asset.title ?? null
    const keywords = asset.tags?.filter(Boolean) ?? []
    return {
      id: asset.id,
      filename: asset.filename,
      title,
      previewUrl: asset.previewUrl ?? "",
      thumbnailUrl: asset.thumbnailUrl ?? asset.previewUrl ?? "",
      keywords,
    }
  }

  function mapApiAssetDetailToListItem(asset: ApiAssetDetail): AssetListItem | null {
    const mapped = mapApiAssetToListItem(asset)
    if (!mapped) return null

    const width = asset.dimensions?.width
    const height = asset.dimensions?.height
    const orientation = getOrientation({ width, height })
    return {
      ...mapped,
      width: isPositiveNumber(width) ? width : undefined,
      height: isPositiveNumber(height) ? height : undefined,
      orientation,
    }
  }

  function mapIngestionStatusToAssetStatus(status?: string): AdminAssetStatus {
    if (status === "failed") return "ingestion-error"
    if (status === "processing") return "preview-ready"
    return "mapped"
  }

  function mapAdminListItemToRecord(item: ApiAdminAssetListItem, index: number): AdminAssetRecord | null {
    const asset = mapApiAssetToListItem(item)
    if (!asset) return null

    const status = mapIngestionStatusToAssetStatus(item.ingestionStatus)
    const missingFields = status === "ingestion-error" ? ["previewChecksum"] : []

    return {
      asset,
      status,
      mappedFields: missingFields.length > 0 ? 8 : 12,
      missingFields,
      bucketKey: "redacted",
      checksum: `sha256:${(3000 + index).toString(16)}fd${(5000 + index).toString(16)}`,
      fileSizeMb: Number((4 + index * 0.25).toFixed(2)),
      lastIngestedAt: new Date().toISOString(),
    }
  }

  function mapAdminDetailToRecord(item: ApiAdminAssetDetail): AdminAssetRecord | null {
    const asset = mapApiAssetDetailToListItem(item)
    if (!asset) return null

    const status = mapIngestionStatusToAssetStatus(item.ingestionStatus)
    const metadata = item.metadata ?? {}
    const requiredMetadataKeys = ["title", "collection", "location"]
    const missingFields = requiredMetadataKeys.filter((key) => metadata[key] == null)

    return {
      asset,
      status,
      mappedFields: Math.max(12 - missingFields.length, 0),
      missingFields,
      bucketKey: "redacted",
      checksum: item.checksumSha256 ?? "sha256:pending",
      fileSizeMb: 0,
      lastIngestedAt: new Date().toISOString(),
    }
  }

  function mapRunSummary(run: ApiIngestionRun): IngestionRun | null {
    if (!run.id || !run.source || !run.status || !run.startedAt) return null
    const discoveredCount = isPositiveNumber(run.discoveredCount) ? run.discoveredCount : 0
    const successCount = isPositiveNumber(run.importedCount) ? run.importedCount : 0
    const failureCount = isPositiveNumber(run.failedCount) ? run.failedCount : 0
    const pendingCount = Math.max(discoveredCount - successCount - failureCount, 0)

    return {
      id: run.id,
      source: run.source,
      status: run.status,
      startedAt: run.startedAt,
      endedAt: run.completedAt ?? undefined,
      successCount,
      failureCount,
      pendingCount,
      errors: [],
    }
  }

  async function listApiAssets(): Promise<AssetListItem[]> {
    const response = await getJsonOrThrow<ApiListResponse<ApiAssetListItem>>("/assets")
    const items = response.items ?? []
    return items
      .map((item) => mapApiAssetToListItem(item))
      .filter((item): item is AssetListItem => item !== null)
  }

  async function searchApiAssets(query: string): Promise<AssetListItem[]> {
    const encodedQuery = encodeURIComponent(query)
    const response = await getJsonOrThrow<ApiListResponse<ApiAssetListItem>>(`/search?q=${encodedQuery}`)
    const items = response.items ?? []
    return items
      .map((item) => mapApiAssetToListItem(item))
      .filter((item): item is AssetListItem => item !== null)
  }

  async function listAssetsWithFallback() {
    if (!fallbackRepository) return listApiAssets()
    return withFallback({
      primary: listApiAssets,
      fallback: () => fallbackRepository.getAssets(),
    })
  }

  async function searchAssetsWithFallback(query: string) {
    if (!fallbackRepository) return searchApiAssets(query)
    return withFallback({
      primary: () => searchApiAssets(query),
      fallback: () => fallbackRepository.searchAssets({ query }).then((result) => result.items),
    })
  }

  async function getAssetByIdWithFallback(id: string) {
    const getPrimary = async () => {
      const response = await getJsonOrThrow<ApiItemResponse<ApiAssetDetail>>(`/assets/${encodeURIComponent(id)}`)
      if (!response.item) return null
      return mapApiAssetDetailToListItem(response.item)
    }

    if (!fallbackRepository) return getPrimary()

    return withFallback({
      primary: getPrimary,
      fallback: () => fallbackRepository.getAssetById(id),
    })
  }

  return {
    async getAssets() {
      return listAssetsWithFallback()
    },
    async searchAssets(params: AssetSearchParams): Promise<AssetSearchResult> {
      const query = (params.query ?? "").trim()
      const baseItems = query.length > 0
        ? await searchAssetsWithFallback(query)
        : await listAssetsWithFallback()

      const filtered = filterAssets({
        assets: baseItems,
        filter: params,
      })

      const sorted = sortAssets({
        assets: filtered,
        sort: params.sort ?? "relevance",
      })

      return {
        items: sorted,
        total: sorted.length,
        availableKeywords: collectTopKeywords({
          assets: params.category && params.category !== "all"
            ? baseItems.filter((asset) => asset.category === params.category)
            : baseItems,
        }),
      }
    },
    async getAssetById(id: string) {
      return getAssetByIdWithFallback(id)
    },
    async getRelatedAssets({ assetId, limit = 6 }) {
      const current = await getAssetByIdWithFallback(assetId)
      if (!current) return []

      const assets = await listAssetsWithFallback()
      const sameCategory = assets.filter(
        (asset) => asset.id !== assetId && asset.category === current.category,
      )
      if (sameCategory.length >= limit) return sameCategory.slice(0, limit)

      const fill = assets.filter(
        (asset) => asset.id !== assetId && asset.category !== current.category,
      )
      return [...sameCategory, ...fill].slice(0, limit)
    },
    async listAdminAssets() {
      const getPrimary = async () => {
        const response = await getJsonOrThrow<ApiListResponse<ApiAdminAssetListItem>>("/staff/assets")
        const items = response.items ?? []
        return items
          .map((item, index) => mapAdminListItemToRecord(item, index))
          .filter((item): item is AdminAssetRecord => item !== null)
      }

      if (!fallbackRepository) return getPrimary()

      return withFallback({
        primary: getPrimary,
        fallback: () => fallbackRepository.listAdminAssets(),
      })
    },
    async getAdminAssetById(id: string) {
      const getPrimary = async () => {
        const response = await getJsonOrThrow<ApiItemResponse<ApiAdminAssetDetail>>(
          `/staff/assets/${encodeURIComponent(id)}`,
        )
        if (!response.item) return null
        return mapAdminDetailToRecord(response.item)
      }

      if (!fallbackRepository) return getPrimary()

      return withFallback({
        primary: getPrimary,
        fallback: () => fallbackRepository.getAdminAssetById(id),
      })
    },
    async listIngestionRuns() {
      const getPrimary = async () => {
        const response = await getJsonOrThrow<ApiListResponse<ApiIngestionRun>>("/staff/ingestion/runs")
        const items = response.items ?? []
        return items
          .map((run) => mapRunSummary(run))
          .filter((run): run is IngestionRun => run !== null)
      }

      if (!fallbackRepository) return getPrimary()

      return withFallback({
        primary: getPrimary,
        fallback: () => fallbackRepository.listIngestionRuns(),
      })
    },
  }
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function getOrientation({
  width,
  height,
}: {
  width: number | undefined
  height: number | undefined
}): "landscape" | "portrait" | "square" | undefined {
  if (!isPositiveNumber(width) || !isPositiveNumber(height)) return undefined
  if (width === height) return "square"
  if (width > height) return "landscape"
  return "portrait"
}
