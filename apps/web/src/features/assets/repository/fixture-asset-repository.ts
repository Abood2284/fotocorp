import { FIXTURE_ASSETS } from "@/lib/fixtures/assets"
import { collectTopKeywords, filterAssets, sortAssets } from "@/features/assets/filter-utils"
import type { AssetRepository, AssetSearchParams, AssetSearchResult } from "@/features/assets/repository/types"
import { ADMIN_ASSET_RECORDS, INGESTION_RUNS } from "@/lib/fixtures/admin"

export function createFixtureAssetRepository(): AssetRepository {
  return {
    async getAssets() {
      return FIXTURE_ASSETS
    },
    async searchAssets(params: AssetSearchParams): Promise<AssetSearchResult> {
      const filtered = filterAssets({
        assets: FIXTURE_ASSETS,
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
            ? FIXTURE_ASSETS.filter((asset) => asset.category === params.category)
            : FIXTURE_ASSETS,
        }),
      }
    },
    async getAssetById(id: string) {
      return FIXTURE_ASSETS.find((asset) => asset.id === id) ?? null
    },
    async getRelatedAssets({ assetId, limit = 6 }) {
      const current = FIXTURE_ASSETS.find((asset) => asset.id === assetId)
      if (!current) return []

      const sameCategory = FIXTURE_ASSETS.filter(
        (asset) => asset.id !== assetId && asset.category === current.category,
      )
      if (sameCategory.length >= limit) return sameCategory.slice(0, limit)

      const fill = FIXTURE_ASSETS.filter(
        (asset) => asset.id !== assetId && asset.category !== current.category,
      )
      return [...sameCategory, ...fill].slice(0, limit)
    },
    async listAdminAssets() {
      return ADMIN_ASSET_RECORDS
    },
    async getAdminAssetById(id: string) {
      return ADMIN_ASSET_RECORDS.find((item) => item.asset.id === id) ?? null
    },
    async listIngestionRuns() {
      return INGESTION_RUNS
    },
  }
}
