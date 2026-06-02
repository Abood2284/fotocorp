import type { PublicAssetFiltersResponse } from "@/features/assets/types"
import { getPublicAssetFilters } from "@/lib/api/fotocorp-api"
import { SearchFiltersBridge } from "@/components/search/search-filters-bridge"

const EMPTY_FILTERS: PublicAssetFiltersResponse = { categories: [], events: [], cities: [], sources: [] }

export async function SearchFiltersLoader({ includeCounts = true }: { includeCounts?: boolean } = {}) {
  const startedAt = Date.now()

  try {
    const filters = await getPublicAssetFilters({
      cachePolicy: "public-filters-long",
      includeCounts,
    })
    const filtersFetchMs = Date.now() - startedAt
    console.info(
      JSON.stringify({
        route: "/search",
        event: "filters_deferred",
        timings: { filters_fetch: filtersFetchMs },
      }),
    )
    return <SearchFiltersBridge filters={filters} />
  } catch {
    const filtersFetchMs = Date.now() - startedAt
    console.info(
      JSON.stringify({
        route: "/search",
        event: "filters_deferred",
        status: "error",
        timings: { filters_fetch: filtersFetchMs },
      }),
    )
    return <SearchFiltersBridge filters={EMPTY_FILTERS} />
  }
}
