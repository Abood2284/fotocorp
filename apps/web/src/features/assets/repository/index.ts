import { createFixtureAssetRepository } from "@/features/assets/repository/fixture-asset-repository"
import { createApiAssetRepository } from "@/features/assets/repository/api-asset-repository"
import type { AssetRepository } from "@/features/assets/repository/types"

const fixtureRepository = createFixtureAssetRepository()
const DATA_SOURCE = process.env.NEXT_PUBLIC_ASSET_DATA_SOURCE ?? "auto"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

const apiRepository = API_BASE_URL
  ? createApiAssetRepository({
    baseUrl: API_BASE_URL,
    fallbackRepository: DATA_SOURCE === "api" ? undefined : fixtureRepository,
  })
  : null

export function getAssetRepository(): AssetRepository {
  if (DATA_SOURCE === "fixture") return fixtureRepository
  if (apiRepository) return apiRepository
  return fixtureRepository
}

export type { AssetRepository, AssetSearchParams, AssetSearchResult } from "@/features/assets/repository/types"
