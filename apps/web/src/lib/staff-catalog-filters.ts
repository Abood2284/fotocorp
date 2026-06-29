const CATALOG_PAGINATION_QUERY_KEYS = new Set(["limit", "sort", "cursor"])

const CATALOG_STATUS_FILTER_LABELS: Record<string, string> = {
  MISSING_CAPTION: "Missing Caption",
  MISSING_WHO_IS_IN_PICTURE: "Missing Who is in picture",
}

export function formatCatalogStatusFilterLabel(status: string): string {
  return CATALOG_STATUS_FILTER_LABELS[status] ?? status
}

export function isMissingWhoIsInPicture(value: string | null | undefined): boolean {
  if (!value) return true
  const trimmed = value.trim()
  return trimmed.length === 0 || trimmed === "."
}

export function hasActiveCatalogFilters(query: URLSearchParams): boolean {
  for (const [key, value] of query.entries()) {
    if (CATALOG_PAGINATION_QUERY_KEYS.has(key)) continue
    if (value.trim()) return true
  }
  return false
}

export function buildCaptionQueueHrefFromCatalogQuery(query: URLSearchParams): string {
  const captionQuery = new URLSearchParams()

  if (query.get("status") === "MISSING_WHO_IS_IN_PICTURE" || query.has("missingWhoIsInPicture")) {
    captionQuery.set("missingWhoIsInPicture", "true")
  }
  if (query.get("status") === "MISSING_CAPTION" || query.has("missingCaption")) {
    captionQuery.set("missingCaption", "true")
  }

  for (const key of ["eventId", "categoryId", "sort"] as const) {
    const value = query.get(key)
    if (value?.trim()) captionQuery.set(key, value)
  }

  const suffix = captionQuery.toString()
  return suffix ? `/staff/captions?${suffix}` : "/staff/captions"
}

export function catalogQueryHasMetadataGapFilter(query: URLSearchParams): boolean {
  return (
    query.get("status") === "MISSING_CAPTION"
    || query.get("status") === "MISSING_WHO_IS_IN_PICTURE"
    || query.has("missingCaption")
    || query.has("missingWhoIsInPicture")
  )
}
