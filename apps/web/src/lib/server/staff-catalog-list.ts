import "server-only"

import { listAdminAssets } from "@/lib/api/admin-assets-api"
import type { AdminCatalogAssetItem, AdminCatalogAssetsResponse } from "@/features/assets/admin-catalog-types"

const FILTERED_PAGE_SIZE = 100
export const FILTERED_CATALOG_MAX_ASSETS = 1000

export { hasActiveCatalogFilters } from "@/lib/staff-catalog-filters"

export async function listAllFilteredAdminCatalogAssets(
  query: URLSearchParams,
): Promise<AdminCatalogAssetsResponse> {
  const baseQuery = new URLSearchParams(query)
  baseQuery.delete("cursor")
  baseQuery.set("limit", String(FILTERED_PAGE_SIZE))

  const items: AdminCatalogAssetItem[] = []
  let cursor: string | null = null

  do {
    const pageQuery = new URLSearchParams(baseQuery)
    if (cursor) pageQuery.set("cursor", cursor)

    const page = await listAdminAssets(pageQuery)
    items.push(...page.items)
    cursor = page.nextCursor

    if (items.length > FILTERED_CATALOG_MAX_ASSETS) {
      throw new Error(
        `This filter matches more than ${FILTERED_CATALOG_MAX_ASSETS} assets. Narrow the filter and try again.`,
      )
    }
  } while (cursor)

  return { items, nextCursor: null }
}
