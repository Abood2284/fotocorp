import { SearchExperience } from "@/components/search/search-experience"
import { SearchFiltersProvider } from "@/components/search/search-filters-context"
import { isTypesenseSearchEnabled, searchPublicAssets, searchPublicEvents } from "@/lib/api/fotocorp-api"
import type { PublicAssetListResponse, PublicAssetSort, PublicSearchEventsResponse } from "@/features/assets/types"
import type { SearchSelectedEvent } from "@/components/search/search-experience-types"

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    categoryId?: string
    category?: string
    eventId?: string
    event?: string
    city?: string
    contributorId?: string
    year?: string
    month?: string
    sort?: string
    cursor?: string
    page?: string
    view?: string
    mode?: string
  }>
}

export function generateMetadata() {
  return {
    title: "Search — Fotocorp",
    description: "Search millions of royalty-free stock photos, vectors, and illustrations.",
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const q = normalized(params.q)
  const sort = parseSort(params.sort, q)
  const year = parseOptionalNumber(params.year)
  const month = parseOptionalNumber(params.month)
  const page = parseOptionalNumber(params.page) ?? 1
  const view: "grid" | "card" = params.view === "card" ? "card" : "grid"
  const mode: "images" | "events" = params.mode === "events" ? "events" : "images"
  const initialParams = {
    q,
    categoryId: normalized(params.categoryId ?? params.category),
    eventId: normalized(params.eventId ?? params.event),
    city: normalized(params.city),
    contributorId: normalized(params.contributorId),
    year,
    month,
    sort,
    cursor: undefined,
    page,
    view,
    mode,
  }

  const typesenseSearchEnabled = isTypesenseSearchEnabled()
  const isEventsMode = mode === "events" && typesenseSearchEnabled
  const [{ result: initialResult, hasLoadError }, initialEventResult, initialImageCount, initialEventCount] = await Promise.all([
    isEventsMode
      ? Promise.resolve({ result: emptySearchResult(), hasLoadError: false })
      : loadInitialSearchResult(initialParams),
    isEventsMode ? loadInitialEventSearchResult(initialParams) : Promise.resolve(null),
    isEventsMode ? loadInitialImageCount(initialParams) : Promise.resolve(undefined),
    !isEventsMode && typesenseSearchEnabled ? loadInitialEventCount(initialParams) : Promise.resolve(undefined),
  ])

  const selectedEvent = deriveSelectedEvent(initialParams.eventId, initialResult.items)

  return (
    <SearchFiltersProvider initialFilters={initialResult.filters}>
      <SearchExperience
        key={JSON.stringify(initialParams)}
        initialParams={initialParams}
        initialResult={initialResult}
        initialEventResult={initialEventResult}
        initialImageCount={initialImageCount}
        initialEventCount={initialEventCount}
        selectedEvent={selectedEvent}
        hasLoadError={hasLoadError}
        paginationMode="page"
        typesenseSearchEnabled={typesenseSearchEnabled}
      />
    </SearchFiltersProvider>
  )
}

async function loadInitialSearchResult(
  params: {
    q?: string
    categoryId?: string
    eventId?: string
    city?: string
    contributorId?: string
    year?: number
    month?: number
    sort: PublicAssetSort
    page?: number
  },
): Promise<{ result: PublicAssetListResponse; hasLoadError: boolean }> {
  try {
    return {
      result: await searchPublicAssets({
        q: params.q,
        categoryId: params.categoryId,
        eventId: params.eventId,
        city: params.city,
        contributorId: params.contributorId,
        year: params.year,
        month: params.month,
        sort: params.sort,
        page: params.page,
        limit: 50,
        includeFacets: false,
      }),
      hasLoadError: false,
    }
  } catch {
    return {
      result: { items: [], nextCursor: null },
      hasLoadError: true,
    }
  }
}

function emptySearchResult(): PublicAssetListResponse {
  return { items: [], nextCursor: null }
}

async function loadInitialImageCount(
  params: {
    q?: string
    categoryId?: string
    eventId?: string
    city?: string
    contributorId?: string
    year?: number
    month?: number
    sort: PublicAssetSort
  },
): Promise<number | undefined> {
  try {
    const result = await searchPublicAssets({
      q: params.q,
      categoryId: params.categoryId,
      eventId: params.eventId,
      city: params.city,
      contributorId: params.contributorId,
      year: params.year,
      month: params.month,
      sort: params.sort,
      page: 1,
      limit: 1,
      includeFacets: false,
    })
    return result.totalCount
  } catch {
    return undefined
  }
}

async function loadInitialEventCount(
  params: {
    q?: string
    categoryId?: string
    eventId?: string
    city?: string
    contributorId?: string
    year?: number
    month?: number
    sort: PublicAssetSort
  },
): Promise<number | undefined> {
  try {
    const result = await searchPublicEvents({
      q: params.q,
      categoryId: params.categoryId,
      eventId: params.eventId,
      city: params.city,
      contributorId: params.contributorId,
      year: params.year,
      month: params.month,
      sort: params.sort,
      page: 1,
      limit: 1,
    })
    return result.foundEvents
  } catch {
    return undefined
  }
}

async function loadInitialEventSearchResult(
  params: {
    q?: string
    categoryId?: string
    eventId?: string
    city?: string
    contributorId?: string
    year?: number
    month?: number
    sort: PublicAssetSort
    page?: number
  },
): Promise<PublicSearchEventsResponse | null> {
  try {
    return await searchPublicEvents({
      q: params.q,
      categoryId: params.categoryId,
      eventId: params.eventId,
      city: params.city,
      contributorId: params.contributorId,
      year: params.year,
      month: params.month,
      sort: params.sort,
      page: params.page,
      limit: 25,
    })
  } catch {
    return null
  }
}

function deriveSelectedEvent(
  eventId: string | undefined,
  items: PublicAssetListResponse["items"],
): SearchSelectedEvent | null {
  if (!eventId) return null

  const event = items[0]?.event
  if (event?.id === eventId) {
    return {
      id: event.id,
      name: event.name,
      eventDate: event.eventDate,
    }
  }

  return { id: eventId, name: null, eventDate: null }
}

function normalized(value: string | undefined) {
  const next = value?.trim()
  return next ? next : undefined
}

function parseSort(value: string | undefined, q: string | undefined): PublicAssetSort {
  if (value === "oldest") return "oldest"
  if (value === "latest") return "newest"
  if (value === "relevance" && q) return "relevance"
  return q ? "relevance" : "newest"
}

function parseOptionalNumber(value: string | undefined) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : undefined
}
