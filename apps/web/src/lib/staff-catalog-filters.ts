const CATALOG_PAGINATION_QUERY_KEYS = new Set(["limit", "sort", "cursor"])

export function hasActiveCatalogFilters(query: URLSearchParams): boolean {
  for (const [key, value] of query.entries()) {
    if (CATALOG_PAGINATION_QUERY_KEYS.has(key)) continue
    if (value.trim()) return true
  }
  return false
}
