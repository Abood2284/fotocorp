import type { AssetListItem } from "@/types"
import type { AssetFilterQuery } from "@/features/assets/filter-utils"
import type { AdminAssetRecord, IngestionRun } from "@/lib/fixtures/admin"

export type AssetSearchParams = AssetFilterQuery

export interface AssetSearchResult {
  items: AssetListItem[]
  total: number
  availableKeywords: string[]
}

export interface AssetRepository {
  getAssets(): Promise<AssetListItem[]>
  searchAssets(params: AssetSearchParams): Promise<AssetSearchResult>
  getAssetById(id: string): Promise<AssetListItem | null>
  getRelatedAssets(params: { assetId: string; limit?: number }): Promise<AssetListItem[]>
  listAdminAssets(): Promise<AdminAssetRecord[]>
  getAdminAssetById(id: string): Promise<AdminAssetRecord | null>
  listIngestionRuns(): Promise<IngestionRun[]>
}
