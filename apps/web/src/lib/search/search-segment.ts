export const SEARCH_SEGMENTS = ["editorial", "caricature"] as const

export type SearchSegment = (typeof SEARCH_SEGMENTS)[number]

export const DEFAULT_SEARCH_SEGMENT: SearchSegment = "editorial"

export interface SearchSegmentParams {
  q?: string
  categoryId?: string
  eventId?: string
  city?: string
  contributorId?: string
  year?: number
  month?: number
  sort?: string
  cursor?: string
  page?: number
  mode?: string
  view?: string
  segment?: SearchSegment
  language?: string
  credit?: string
  hasVisibleText?: boolean
}

export function parseSearchSegment(value: string | undefined): SearchSegment {
  if (value === "caricature") return "caricature"
  return DEFAULT_SEARCH_SEGMENT
}

export function searchSegmentLabel(segment: SearchSegment) {
  switch (segment) {
    case "editorial":
      return "Editorial images"
    case "caricature":
      return "Caricatures"
    default: {
      const unreachable: never = segment
      return unreachable
    }
  }
}

export function isEditorialSearchSegment(segment: SearchSegment) {
  return segment === "editorial"
}

export function stripEditorialOnlySearchParams<T extends SearchSegmentParams>(params: T): T {
  return {
    ...params,
    eventId: undefined,
    categoryId: undefined,
    city: undefined,
    contributorId: undefined,
    year: undefined,
    month: undefined,
    mode: "images",
  }
}

export function applySearchSegmentChange<T extends SearchSegmentParams>(
  params: T,
  nextSegment: SearchSegment,
): T {
  if (nextSegment === "editorial") {
    return { ...params, segment: nextSegment }
  }

  return stripEditorialOnlySearchParams({ ...params, segment: nextSegment })
}

export function buildSearchPageHref(params: SearchSegmentParams) {
  const searchParams = new URLSearchParams()
  const segment = params.segment ?? DEFAULT_SEARCH_SEGMENT

  if (params.q) searchParams.set("q", params.q)
  if (params.categoryId) searchParams.set("categoryId", params.categoryId)
  if (params.eventId) searchParams.set("eventId", params.eventId)
  if (params.city) searchParams.set("city", params.city)
  if (params.contributorId) searchParams.set("contributorId", params.contributorId)
  if (params.year != null) searchParams.set("year", String(params.year))
  if (params.month != null) searchParams.set("month", String(params.month))
  if (params.cursor) searchParams.set("cursor", params.cursor)
  if (params.page != null && params.page > 1) searchParams.set("page", String(params.page))
  if (params.view === "card") searchParams.set("view", "card")
  if (params.mode === "events") searchParams.set("mode", "events")
  if (params.sort && params.sort !== "newest") searchParams.set("sort", params.sort)
  if (segment !== DEFAULT_SEARCH_SEGMENT) searchParams.set("segment", segment)
  if (params.language) searchParams.set("language", params.language)
  if (params.credit) searchParams.set("credit", params.credit)
  if (params.hasVisibleText === true) searchParams.set("hasVisibleText", "true")
  if (params.hasVisibleText === false) searchParams.set("hasVisibleText", "false")

  const query = searchParams.toString()
  return query ? `/search?${query}` : "/search"
}

export function buildHomeHeroSearchHref(query: string) {
  const trimmed = query.trim()
  if (!trimmed) return `/search?segment=${DEFAULT_SEARCH_SEGMENT}`
  return `/search?q=${encodeURIComponent(trimmed)}&segment=${DEFAULT_SEARCH_SEGMENT}`
}
