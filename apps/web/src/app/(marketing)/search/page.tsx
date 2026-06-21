import { SearchExperience } from "@/components/search/search-experience"
import { SearchFiltersProvider } from "@/components/search/search-filters-context"
import { isTypesenseSearchEnabled } from "@/lib/api/fotocorp-api"
import type { PublicAssetSort } from "@/features/assets/types"
import { parseSearchSegment } from "@/lib/search/search-segment"

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
    segment?: string
    language?: string
    credit?: string
    hasVisibleText?: string
    depictedSubject?: string
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
  const mode: "images" | "events" =
    params.mode === "events" || params.sort?.trim().toLowerCase() === "latest" ? "events" : "images"
  const segment = parseSearchSegment(params.segment)
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
    mode: segment === "caricature" ? "images" as const : mode,
    segment,
    language: normalized(params.language),
    credit: normalized(params.credit),
    hasVisibleText: parseOptionalBoolean(params.hasVisibleText),
    depictedSubject: normalized(params.depictedSubject),
  }

  return (
    <SearchFiltersProvider>
      <SearchExperience
        key={JSON.stringify(initialParams)}
        initialParams={initialParams}
        initialResult={{ items: [], nextCursor: null }}
        paginationMode="page"
        typesenseSearchEnabled={isTypesenseSearchEnabled()}
      />
    </SearchFiltersProvider>
  )
}

function normalized(value: string | undefined) {
  const next = value?.trim()
  return next ? next : undefined
}

function parseSort(value: string | undefined, q: string | undefined): PublicAssetSort {
  if (value === "oldest") return "oldest"
  if (value === "latest") return "newest"
  if (value === "popular") return "popular"
  if (value === "relevance" && q) return "relevance"
  return "newest"
}

function parseOptionalBoolean(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "true") return true
  if (normalized === "false") return false
  return undefined
}

function parseOptionalNumber(value: string | undefined) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : undefined
}
