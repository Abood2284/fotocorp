"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ImageOff, Loader2, Plus, Search, SlidersHorizontal } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { searchHomepageHeroCandidatesAction } from "@/app/(staff)/staff/(workspace)/homepage-hero/actions"
import { PreviewImage } from "@/components/assets/preview-image"
import {
  CATALOG_MONTH_OPTIONS,
  CatalogSearchActiveChips,
  CatalogSearchFilterPanel,
  CatalogSearchPagination,
  type CatalogSearchParams,
} from "@/components/search/catalog-search-filter-panel"
import { SearchFilterPanelSkeleton } from "@/components/search/search-filter-skeletons"
import { useSearchFilters } from "@/components/search/search-filters-context"
import type { HomepageHeroPoolCandidate } from "@/features/homepage-hero/types"
import { mapPublicAssetToHeroCandidate } from "@/features/homepage-hero/map-candidate"
import { getPublicCatalogTaxonomy, isTypesenseSearchEnabled, searchPublicAssets } from "@/lib/api/fotocorp-api"
import { getPreviewAspectRatio } from "@/lib/layout/justified-rows"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 24

interface StaffHomepageHeroCandidateSearchProps {
  selectedIds: Set<string>
  poolFull: boolean
  disabled?: boolean
  onAdd: (candidate: HomepageHeroPoolCandidate) => void
}

export function StaffHomepageHeroCandidateSearch({
  selectedIds,
  poolFull,
  disabled = false,
  onAdd,
}: StaffHomepageHeroCandidateSearchProps) {
  const typesenseEnabled = isTypesenseSearchEnabled()
  const { filters, mergeFilters } = useSearchFilters()
  const [showFilters, setShowFilters] = useState(true)
  const [queryDraft, setQueryDraft] = useState("")
  const [params, setParams] = useState<CatalogSearchParams>({ sort: "newest", page: 1 })
  const [fallbackCursor, setFallbackCursor] = useState<string | null>(null)
  const [fallbackItems, setFallbackItems] = useState<HomepageHeroPoolCandidate[]>([])

  const { data: filterSnapshot, isFetching: isFiltersFetching } = useQuery({
    queryKey: ["public-search-filters"],
    queryFn: () => getPublicCatalogTaxonomy(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (filterSnapshot) mergeFilters(filterSnapshot)
  }, [filterSnapshot, mergeFilters])

  const typesenseQuery = useQuery({
    queryKey: ["staff-homepage-hero-candidates", params],
    queryFn: () => searchPublicAssets({
      q: params.q,
      categoryId: params.categoryId,
      eventId: params.eventId,
      city: params.city,
      year: params.year,
      month: params.month,
      sort: params.sort,
      page: params.page ?? 1,
      limit: PAGE_SIZE,
      includeFacets: false,
    }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: typesenseEnabled,
  })

  const fallbackQuery = useQuery({
    queryKey: ["staff-homepage-hero-candidates-fallback", params.q, fallbackCursor],
    queryFn: () => searchHomepageHeroCandidatesAction({
      q: params.q,
      cursor: fallbackCursor ?? undefined,
      limit: PAGE_SIZE,
    }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: !typesenseEnabled,
  })

  useEffect(() => {
    if (typesenseEnabled) return
    setFallbackCursor(null)
    setFallbackItems([])
  }, [params.q, typesenseEnabled])

  useEffect(() => {
    if (typesenseEnabled || !fallbackQuery.data) return
    if (!fallbackCursor) {
      setFallbackItems(fallbackQuery.data.items)
      return
    }
    setFallbackItems((current) => {
      const seen = new Set(current.map((item) => item.assetId))
      const appended = fallbackQuery.data!.items.filter((item) => !seen.has(item.assetId))
      return [...current, ...appended]
    })
  }, [fallbackQuery.data, fallbackCursor, typesenseEnabled])

  const candidates = useMemo(() => {
    if (typesenseEnabled) {
      return (typesenseQuery.data?.items ?? [])
        .map(mapPublicAssetToHeroCandidate)
        .filter((item) => item.cardPreviewReady)
    }
    return fallbackItems
  }, [typesenseEnabled, typesenseQuery.data?.items, fallbackItems])

  const isFetching = typesenseEnabled ? typesenseQuery.isFetching : fallbackQuery.isFetching
  const currentPage = typesenseEnabled ? (typesenseQuery.data?.page ?? params.page ?? 1) : 1
  const totalPages = typesenseEnabled ? Math.max(typesenseQuery.data?.totalPages ?? 1, 1) : 1
  const hasNextPage = typesenseEnabled
    ? currentPage < totalPages
    : Boolean(fallbackQuery.data?.nextCursor)

  const categoryName = filters.categories.find((item) => item.id === params.categoryId)?.name
  const eventName = filters.events.find((item) => item.id === params.eventId)?.name

  const filterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; remove: () => void }> = []
    if (params.q) chips.push({ key: "q", label: params.q, remove: () => updateParams({ q: undefined }) })
    if (!typesenseEnabled) return chips
    if (categoryName) chips.push({ key: "category", label: categoryName, remove: () => updateParams({ categoryId: undefined }) })
    if (eventName) chips.push({ key: "event", label: eventName, remove: () => updateParams({ eventId: undefined }) })
    if (params.city) chips.push({ key: "city", label: params.city, remove: () => updateParams({ city: undefined }) })
    if (params.year) chips.push({ key: "year", label: String(params.year), remove: () => updateParams({ year: undefined }) })
    if (params.month) {
      const monthLabel = CATALOG_MONTH_OPTIONS.find((item) => item.value === params.month)?.label ?? String(params.month)
      chips.push({ key: "month", label: monthLabel, remove: () => updateParams({ month: undefined }) })
    }
    return chips
  }, [params.q, params.categoryId, params.eventId, params.city, params.year, params.month, categoryName, eventName, typesenseEnabled])

  function updateParams(next: Partial<CatalogSearchParams>) {
    setParams((current) => ({ ...current, ...next, page: next.page ?? 1 }))
    if (!typesenseEnabled) setFallbackCursor(null)
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const q = queryDraft.trim()
    updateParams({
      q: q || undefined,
      sort: q ? "relevance" : "newest",
      ...(q
        ? {
            eventId: undefined,
            categoryId: undefined,
            city: undefined,
            year: undefined,
            month: undefined,
          }
        : {}),
    })
  }

  function clearAll() {
    setQueryDraft("")
    setFallbackCursor(null)
    setFallbackItems([])
    setParams({ sort: "newest", page: 1 })
  }

  const showFiltersLoading = isFiltersFetching && filters.categories.length === 0 && filters.events.length === 0

  return (
    <div className="space-y-4">
      {!typesenseEnabled ? (
        <p className="rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Typesense search is disabled. Text search uses the internal catalog fallback — enable `NEXT_PUBLIC_USE_TYPESENSE_SEARCH` for full filters and faster results.
        </p>
      ) : null}

      <form onSubmit={submitSearch} className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="Search by fotokey, headline, caption, event…"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>
        <button
          type="submit"
          disabled={isFetching}
          className="inline-flex h-10 items-center rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          {isFetching ? "Searching…" : "Search"}
        </button>
        {typesenseEnabled ? (
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
          </button>
        ) : null}
      </form>

      <CatalogSearchActiveChips chips={filterChips} onClearAll={clearAll} />

      <div className={cn("grid gap-4", showFilters && typesenseEnabled && "lg:grid-cols-[280px_minmax(0,1fr)]")}>
        {showFilters && typesenseEnabled ? (
          showFiltersLoading ? (
            <SearchFilterPanelSkeleton />
          ) : (
            <CatalogSearchFilterPanel
              categories={filters.categories}
              events={filters.events}
              params={params}
              disabled={isFetching || disabled}
              onUpdate={updateParams}
              onClearAll={clearAll}
            />
          )
        ) : null}

        <div className="relative min-w-0 space-y-4">
          {isFetching ? (
            <div className="absolute inset-0 z-10 flex items-start justify-center bg-background/40 pt-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : null}

          {candidates.length === 0 && !isFetching ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
              No eligible homepage hero candidates found. Try a broader search or adjust filters.
            </p>
          ) : (
            <div className="columns-2 gap-3 xl:columns-3">
              {candidates.map((candidate) => {
                const alreadySelected = selectedIds.has(candidate.assetId)
                return (
                  <div key={candidate.assetId} className="mb-3 break-inside-avoid">
                    <CandidateCard
                      candidate={candidate}
                      disabled={poolFull || alreadySelected || disabled || isFetching}
                      alreadySelected={alreadySelected}
                      onAdd={() => onAdd(candidate)}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {typesenseEnabled && totalPages > 1 ? (
            <CatalogSearchPagination
              currentPage={currentPage}
              totalPages={totalPages}
              isFirstPage={currentPage === 1}
              hasNextPage={hasNextPage}
              disabled={isFetching || disabled}
              onPrev={() => updateParams({ page: Math.max((params.page ?? 1) - 1, 1) })}
              onNext={() => updateParams({ page: (params.page ?? 1) + 1 })}
            />
          ) : null}

          {!typesenseEnabled && hasNextPage ? (
            <button
              type="button"
              disabled={isFetching || disabled}
              onClick={() => fallbackQuery.data?.nextCursor && setFallbackCursor(fallbackQuery.data.nextCursor)}
              className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
            >
              Load more candidates
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CandidateCard({
  candidate,
  disabled,
  alreadySelected,
  onAdd,
}: {
  candidate: HomepageHeroPoolCandidate
  disabled: boolean
  alreadySelected: boolean
  onAdd: () => void
}) {
  const previewSrc = candidate.previewUrl ?? `/staff/catalog/${candidate.assetId}/preview-image?variant=card`
  const aspectRatio = getPreviewAspectRatio(candidate.previewWidth, candidate.previewHeight)

  return (
    <article className={cn("overflow-hidden rounded-lg border border-border bg-background", alreadySelected && "opacity-60")}>
      <div
        className="relative flex items-center justify-center bg-muted"
        style={{ aspectRatio }}
      >
        <PreviewImage
          src={previewSrc}
          alt={candidate.title}
          width={candidate.previewWidth ?? undefined}
          height={candidate.previewHeight ?? undefined}
          className="block h-full w-full object-contain"
        />
        {!candidate.cardPreviewReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
            <ImageOff className="h-5 w-5" aria-hidden />
          </div>
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        <div>
          <p className="truncate text-sm font-medium" title={candidate.title}>{candidate.title}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{candidate.fotokey ?? candidate.assetId.slice(0, 8)}</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {alreadySelected ? "Added" : "Add to pool"}
        </button>
      </div>
    </article>
  )
}
