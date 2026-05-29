import { SearchExperience } from "@/components/search/search-experience"
import { SearchFiltersProvider } from "@/components/search/search-filters-context"
import type { PublicAssetListResponse, PublicAssetSort } from "@/features/assets/types"
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
  }

  const initialResult: PublicAssetListResponse = { items: [], nextCursor: null }

  const selectedEvent = deriveSelectedEvent(initialParams.eventId, initialResult.items)

  return (
    <SearchFiltersProvider initialFilters={initialResult.filters}>
      <SearchExperience
        key={JSON.stringify(initialParams)}
        initialParams={initialParams}
        initialResult={initialResult}
        selectedEvent={selectedEvent}
        paginationMode="page"
      />
    </SearchFiltersProvider>
  )
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
