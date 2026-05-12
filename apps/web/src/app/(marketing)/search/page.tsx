// apps/web/src/app/(marketing)/search/page.tsx
import { SearchExperience } from "@/components/search/search-experience"
import { getPublicAssetFilters, listPublicAssets } from "@/lib/api/fotocorp-api"
import type { PublicAssetSort } from "@/features/assets/types"

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    categoryId?: string
    category?: string
    eventId?: string
    contributorId?: string
    year?: string
    month?: string
    sort?: string
    cursor?: string
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
  const cursor = normalized(params.cursor)
  const view: "grid" | "card" = params.view === "card" ? "card" : "grid"
  const initialParams = {
    q,
    categoryId: normalized(params.categoryId ?? params.category),
    eventId: normalized(params.eventId),
    contributorId: normalized(params.contributorId),
    year,
    month,
    sort,
    cursor,
    view,
  }

  const [initialResultState, filtersState] = await Promise.allSettled([
    listPublicAssets({ ...initialParams, limit: 50 }),
    getPublicAssetFilters(),
  ])

  const initialResult = initialResultState.status === "fulfilled"
    ? initialResultState.value
    : { items: [], nextCursor: null, totalCount: 0 }
  const filters = filtersState.status === "fulfilled"
    ? filtersState.value
    : { categories: [], events: [] }
  const hasLoadError = initialResultState.status === "rejected"

  return (
    <SearchExperience
      key={JSON.stringify(initialParams)}
      initialParams={initialParams}
      initialResult={initialResult}
      filters={filters}
      hasLoadError={hasLoadError}
    />
  )
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
