"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import type React from "react"
import { useEffect, useMemo, useState, useTransition } from "react"

import type {
  PublicAsset,
  PublicAssetListResponse,
  PublicAssetSort,
  PublicSearchEventsResponse,
} from "@/features/assets/types"
import { PublicAssetCard } from "@/components/assets/public-asset-card"
import { PublicAssetGrid } from "@/components/assets/public-asset-grid"
import { EmptyState } from "@/components/shared/empty-state"
import {
  CATALOG_MONTH_OPTIONS,
  CatalogSearchActiveChips,
  CatalogSearchFilterPanel,
} from "@/components/search/catalog-search-filter-panel"
import { SearchFilterPanelSkeleton } from "@/components/search/search-filter-skeletons"
import { SearchEventResultsGrid } from "@/components/search/search-event-results-grid"
import { useSearchFilters, hasPopulatedAssetFilters } from "@/components/search/search-filters-context"
import { Button } from "@/components/ui/button"
import type { SearchSelectedEvent } from "@/components/search/search-experience-types"
import { getPublicCatalogTaxonomy, isTypesenseSearchEnabled, searchPublicAssets, searchPublicEvents } from "@/lib/api/fotocorp-api"
import { hasSearchIntent } from "@/lib/search/search-intent"
import { cn, formatInteger } from "@/lib/utils"
import { ChevronDown, ChevronLeft, ChevronRight, Images, SlidersHorizontal, X, SearchIcon } from "lucide-react"

export type { SearchSelectedEvent } from "@/components/search/search-experience-types"

interface SearchExperienceProps {
  initialParams: {
    q?: string
    categoryId?: string
    eventId?: string
    city?: string
    contributorId?: string
    year?: number
    month?: number
    sort: PublicAssetSort
    cursor?: string
    page?: number
    view?: SearchViewMode
    mode?: SearchResultMode
  }
  initialEventResult?: PublicSearchEventsResponse | null
  initialImageCount?: number
  initialEventCount?: number
  initialResult: PublicAssetListResponse
  selectedEvent?: SearchSelectedEvent | null
  hasLoadError?: boolean
  paginationMode?: "cursor" | "page"
  typesenseSearchEnabled?: boolean
}

type SearchViewMode = "grid" | "card"
type SearchResultMode = "images" | "events"

const PAGE_SIZE = 50
const EVENT_PAGE_SIZE = 25

export function SearchExperience({
  initialParams,
  initialResult,
  initialEventResult = null,
  initialImageCount,
  initialEventCount,
  selectedEvent = null,
  hasLoadError = false,
  paginationMode = "cursor",
  typesenseSearchEnabled: typesenseSearchEnabledProp,
}: SearchExperienceProps) {
  const router = useRouter()
  const { filters, mergeFilters } = useSearchFilters()
  const searchActive = hasSearchIntent(initialParams)
  const isBrowseLatest = !searchActive && (initialParams.mode ?? "images") === "images"
  const [filtersRequested, setFiltersRequested] = useState(searchActive)
  const [isPending, startTransition] = useTransition()
  const [showFilters, setShowFilters] = useState(false)
  const [queryDraft, setQueryDraft] = useState(initialParams.q ?? "")
  const resultMode = initialParams.mode ?? "images"
  const typesenseSearchEnabled = resolveTypesenseSearchEnabled(typesenseSearchEnabledProp)
  const searchQueryParams = useMemo(
    () => buildSearchQueryParams(initialParams, paginationMode),
    [initialParams, paginationMode],
  )
  const searchScopeQueryParams = useMemo(
    () => buildSearchScopeQueryParams(initialParams),
    [
      initialParams.q,
      initialParams.categoryId,
      initialParams.eventId,
      initialParams.city,
      initialParams.contributorId,
      initialParams.year,
      initialParams.month,
      initialParams.sort,
    ],
  )
  const searchCacheKey = useMemo(
    () => `fotocorp:search:v2:${JSON.stringify(searchQueryParams)}`,
    [searchQueryParams],
  )
  const {
    data: displayResult = initialResult,
    error: searchError,
    isFetching,
  } = useQuery({
    queryKey: ["public-search-assets", searchQueryParams],
    queryFn: () => searchPublicAssets({
      q: searchQueryParams.q,
      categoryId: searchQueryParams.categoryId,
      eventId: searchQueryParams.eventId,
      city: searchQueryParams.city,
      contributorId: searchQueryParams.contributorId,
      year: searchQueryParams.year,
      month: searchQueryParams.month,
      cursor: searchQueryParams.cursor,
      sort: searchQueryParams.sort,
      page: searchQueryParams.page,
      limit: PAGE_SIZE,
      includeFacets: false,
    }),
    initialData: initialResult.items.length > 0 ? initialResult : undefined,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: (searchActive || isBrowseLatest) && resultMode === "images",
  })
  const {
    data: filterSnapshot,
    isFetching: isFiltersFetching,
  } = useQuery({
    queryKey: ["public-search-filters"],
    queryFn: () => getPublicCatalogTaxonomy(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    enabled: filtersRequested,
  })
  const eventSearchQueryParams = useMemo(
    () => buildEventSearchQueryParams(initialParams, paginationMode),
    [initialParams, paginationMode],
  )
  const {
    data: imageCountSnapshot,
  } = useQuery({
    queryKey: ["public-search-images-count", searchScopeQueryParams],
    queryFn: () => searchPublicAssets({
      q: searchScopeQueryParams.q,
      categoryId: searchScopeQueryParams.categoryId,
      eventId: searchScopeQueryParams.eventId,
      city: searchScopeQueryParams.city,
      contributorId: searchScopeQueryParams.contributorId,
      year: searchScopeQueryParams.year,
      month: searchScopeQueryParams.month,
      sort: searchScopeQueryParams.sort,
      page: 1,
      limit: 1,
      includeFacets: false,
    }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: searchActive && typesenseSearchEnabled && resultMode === "events",
  })
  const {
    data: eventCountSnapshot,
  } = useQuery({
    queryKey: ["public-search-events-count", searchScopeQueryParams],
    queryFn: () => searchPublicEvents({
      q: searchScopeQueryParams.q,
      categoryId: searchScopeQueryParams.categoryId,
      eventId: searchScopeQueryParams.eventId,
      city: searchScopeQueryParams.city,
      contributorId: searchScopeQueryParams.contributorId,
      year: searchScopeQueryParams.year,
      month: searchScopeQueryParams.month,
      sort: searchScopeQueryParams.sort,
      page: 1,
      limit: 1,
    }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: searchActive && typesenseSearchEnabled && resultMode === "images",
  })
  const {
    data: displayEventResult = initialEventResult ?? undefined,
    error: eventSearchError,
    isFetching: isEventFetching,
  } = useQuery({
    queryKey: ["public-search-events", eventSearchQueryParams],
    queryFn: () => searchPublicEvents({
      q: eventSearchQueryParams.q,
      categoryId: eventSearchQueryParams.categoryId,
      eventId: eventSearchQueryParams.eventId,
      city: eventSearchQueryParams.city,
      contributorId: eventSearchQueryParams.contributorId,
      year: eventSearchQueryParams.year,
      month: eventSearchQueryParams.month,
      sort: eventSearchQueryParams.sort,
      page: eventSearchQueryParams.page,
      limit: EVENT_PAGE_SIZE,
    }),
    initialData: initialEventResult?.items.length ? initialEventResult : undefined,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    enabled: searchActive && typesenseSearchEnabled && resultMode === "events",
  })
  const items = displayResult?.items ?? initialResult.items
  const nextCursor = displayResult?.nextCursor ?? initialResult.nextCursor
  const hasMore = displayResult?.hasMore ?? initialResult.hasMore ?? Boolean(nextCursor)
  const viewMode = initialParams.view ?? "grid"
  const resultEvent = deriveSelectedEventFromItems(initialParams.eventId, items)
  const eventFilterCount = filters.events.find((item) => item.id === initialParams.eventId)?.assetCount
  const totalCount = displayResult?.totalCount ?? initialResult.totalCount ?? eventFilterCount ?? items.length
  const eventItems = displayEventResult?.items ?? []
  const eventCount = initialParams.eventId
    ? 1
    : resultMode === "events"
      ? (displayEventResult?.foundEvents ?? 0)
      : (eventCountSnapshot?.foundEvents ?? initialEventCount ?? 0)
  const isPagePagination = paginationMode === "page"
  const isEventsMode = resultMode === "events"
  const activePageSize = isEventsMode ? EVENT_PAGE_SIZE : PAGE_SIZE
  const filtersReady = hasPopulatedAssetFilters(filters)
  const showFiltersLoading = filtersRequested && !filtersReady && isFiltersFetching

  function requestFilters() {
    setFiltersRequested(true)
  }

  function toggleFiltersPanel() {
    setShowFilters((value) => {
      if (!value) requestFilters()
      return !value
    })
  }

  const [history, setHistory] = useState<(string | undefined)[]>([undefined])
  const baseParamsKey = JSON.stringify({ ...initialParams, cursor: undefined })

  useEffect(() => {
    setHistory([undefined])
  }, [baseParamsKey])

  useEffect(() => {
    setQueryDraft(initialParams.q ?? "")
  }, [initialParams.q])

  useEffect(() => {
    if (filterSnapshot) mergeFilters(filterSnapshot)
  }, [filterSnapshot, mergeFilters])

  useEffect(() => {
    const scrollKey = buildSearchScrollKey(searchCacheKey)
    const raw = window.sessionStorage.getItem(scrollKey)
    if (!raw) return
    const y = Number(raw)
    if (!Number.isFinite(y) || y <= 0) return
    requestAnimationFrame(() => window.scrollTo({ top: y }))
  }, [searchCacheKey])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href^='/assets/']")
      if (!link) return
      window.sessionStorage.setItem(buildSearchScrollKey(searchCacheKey), String(window.scrollY))
    }

    document.addEventListener("click", handleClick, { capture: true })
    return () => document.removeEventListener("click", handleClick, { capture: true })
  }, [searchCacheKey])

  const categoryName = filters.categories.find((item) => item.id === initialParams.categoryId)?.name
  const eventName = resultEvent?.name
    ?? selectedEvent?.name
    ?? filters.events.find((item) => item.id === initialParams.eventId)?.name
    ?? undefined
  const cityName = filters.cities?.find((item) => item.id === initialParams.city)?.name ?? initialParams.city
  const activeEventCount = eventCount
  const inactiveImageCount = imageCountSnapshot?.totalCount ?? initialImageCount ?? 0
  const eventChipLabel = eventName
    ?? (initialParams.eventId
      ? showFiltersLoading || isFetching
        ? "Loading event…"
        : "Selected event"
      : undefined)
  const effectiveHasLoadError = hasLoadError || Boolean(searchError) || (isEventsMode && Boolean(eventSearchError))

  const filterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; remove: () => void }> = []
    if (initialParams.q) chips.push({ key: "q", label: initialParams.q, remove: () => updateParams({ q: undefined }) })
    if (categoryName) chips.push({ key: "category", label: categoryName, remove: () => updateParams({ categoryId: undefined }) })
    if (eventChipLabel) chips.push({ key: "event", label: eventChipLabel, remove: () => updateParams({ eventId: undefined }) })
    if (cityName) chips.push({ key: "city", label: cityName, remove: () => updateParams({ city: undefined }) })
    if (initialParams.year) chips.push({ key: "year", label: String(initialParams.year), remove: () => updateParams({ year: undefined }) })
    if (initialParams.month) {
      const monthLabel = CATALOG_MONTH_OPTIONS.find((item) => item.value === initialParams.month)?.label ?? String(initialParams.month)
      chips.push({ key: "month", label: monthLabel, remove: () => updateParams({ month: undefined }) })
    }
    return chips
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialParams.q, initialParams.categoryId, initialParams.eventId, initialParams.city, initialParams.year, initialParams.month, categoryName, eventChipLabel, cityName])

  function updateParams(next: Partial<SearchExperienceProps["initialParams"]>, forceSort = true) {
    const params = new URLSearchParams()
    const merged = { ...initialParams, ...next }

    if (merged.q) params.set("q", merged.q)
    if (merged.categoryId) params.set("categoryId", merged.categoryId)
    if (merged.eventId) params.set("eventId", merged.eventId)
    if (merged.city) params.set("city", merged.city)
    if (merged.contributorId) params.set("contributorId", merged.contributorId)
    if (merged.year) params.set("year", String(merged.year))
    if (merged.month) params.set("month", String(merged.month))
    if (!isPagePagination && merged.cursor) params.set("cursor", merged.cursor)
    if (isPagePagination && merged.page && merged.page > 1) params.set("page", String(merged.page))
    if (merged.view === "card") params.set("view", "card")
    if (merged.mode === "events") params.set("mode", "events")

    const effectiveSort = forceSort
      ? merged.sort === "relevance" && merged.q
        ? "relevance"
        : merged.sort === "oldest"
          ? "oldest"
          : "newest"
      : merged.sort

    if (effectiveSort && effectiveSort !== "newest") params.set("sort", effectiveSort)
    if (!("cursor" in next)) params.delete("cursor")
    if (isPagePagination && !("page" in next)) params.delete("page")

    startTransition(() => {
      router.replace(params.toString() ? `/search?${params.toString()}` : "/search")
    })
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = queryDraft.trim()
    updateParams({
      q: q || undefined,
      sort: "newest",
      ...(q
        ? {
            eventId: undefined,
            categoryId: undefined,
            city: undefined,
            year: undefined,
            month: undefined,
          }
        : {}),
      cursor: undefined,
      page: undefined,
      mode: "images",
    })
  }

  function clearAll() {
    setQueryDraft("")
    updateParams({
      q: undefined,
      categoryId: undefined,
      eventId: undefined,
      city: undefined,
      contributorId: undefined,
      year: undefined,
      month: undefined,
      sort: "newest",
      cursor: undefined,
      page: undefined,
      mode: "images",
    })
  }

  function setResultMode(mode: SearchResultMode) {
    if (mode === resultMode) return
    updateParams({
      mode,
      page: undefined,
      cursor: undefined,
    }, false)
  }

  function goToNext() {
    if (isPagePagination) {
      updateParams({ page: currentPage + 1 }, false)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    if (!nextCursor) return
    setHistory((prev) => {
      const nextHistory = [...prev]
      const currentIndex = prev.indexOf(initialParams.cursor)
      if (currentIndex !== -1) {
        nextHistory[currentIndex + 1] = nextCursor
      } else {
        nextHistory.push(nextCursor)
      }
      return nextHistory
    })
    updateParams({ cursor: nextCursor }, false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function goToPrev() {
    if (isPagePagination) {
      updateParams({ page: currentPage > 2 ? currentPage - 1 : undefined }, false)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    const currentIndex = history.indexOf(initialParams.cursor)
    updateParams({ cursor: currentIndex > 0 ? history[currentIndex - 1] : undefined }, false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const currentIndex = history.indexOf(initialParams.cursor)
  const displayPage = isPagePagination
    ? (isEventsMode
      ? (displayEventResult?.page ?? initialParams.page ?? 1)
      : (displayResult?.page ?? initialParams.page ?? 1))
    : currentIndex !== -1 ? currentIndex + 1 : (initialParams.cursor ? 2 : 1)
  const exactTotalCount = isEventsMode
    ? displayEventResult?.foundEvents
    : (displayResult?.totalCount ?? eventFilterCount)
  const totalPages = isEventsMode
    ? (displayEventResult?.totalPages ?? Math.max(1, Math.ceil((displayEventResult?.foundEvents ?? eventItems.length) / activePageSize)))
    : (displayResult?.totalPages ?? (exactTotalCount !== undefined
      ? Math.max(1, Math.ceil(exactTotalCount / PAGE_SIZE))
      : Math.max(displayPage, hasMore ? displayPage + 1 : displayPage)))
  const currentPage = Math.min(displayPage, totalPages)
  const displayCount = isEventsMode
    ? (displayEventResult?.foundEvents ?? eventItems.length)
    : (exactTotalCount ?? Math.max(totalCount, (displayPage - 1) * PAGE_SIZE + items.length))
  const hasActiveFilters = filterChips.length > 0 || initialParams.sort !== "newest"
  const isResultsFetching = isEventsMode ? isEventFetching : isFetching
  const hasEventResults = eventItems.length > 0
  const hasImageResults = items.length > 0

  return (
    <>
      <div className="order-1 bg-background text-foreground">
        <section className="sticky top-0 z-50 border-b border-foreground/80 bg-background shadow-sm">
          <form
            onSubmit={submitSearch}
            className="grid min-h-[72px] grid-cols-[1fr_auto] items-stretch divide-x divide-border border-b border-border bg-background md:grid-cols-[1fr_260px_auto]"
          >
            <label className="flex min-w-0 items-center gap-3 bg-background px-4 transition-colors focus-within:bg-surface-warm focus-within:outline-none sm:px-6 lg:px-8">
              <SearchIcon className="shrink-0 text-foreground" strokeWidth={2.1} size={24} />
              <span className="sr-only">Search the Fotocorp archive</span>
              <input
                value={queryDraft}
                onChange={(event) => setQueryDraft(event.target.value)}
                onFocus={requestFilters}
                placeholder="AI-enabled search for images, events, categories, Fotokey"
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-lg font-medium text-foreground shadow-none outline-none ring-0 placeholder:text-lg placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0 md:text-xl md:placeholder:text-xl"
              />
            </label>

            <div className="hidden items-center justify-center bg-background px-6 text-base font-medium text-foreground md:flex">
              Editorial images
              <ChevronDown className="ml-3" size={16} />
            </div>

            <div className="flex items-center bg-background">
              {queryDraft && (
                <button
                  type="button"
                  onClick={() => setQueryDraft("")}
                  className="flex h-full w-14 items-center justify-center text-foreground hover:bg-muted"
                  aria-label="Clear search text"
                >
                  <X size={24} />
                </button>
              )}
              <Button type="submit" className="m-3 h-12 rounded-none px-5" disabled={isPending} aria-busy={isPending || isFetching}>
                {isPending ? "Searching…" : "Search"}
              </Button>
            </div>
          </form>

          <div className="grid border-b border-border bg-background md:grid-cols-[250px_1fr]">
            <button
              type="button"
              onClick={toggleFiltersPanel}
              className={cn(
                "flex h-16 items-center justify-between border-b border-border px-5 text-left text-base font-semibold uppercase tracking-wide transition-colors md:border-b-0 md:border-r",
                showFilters ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted",
              )}
              aria-expanded={showFilters}
            >
              <span className="inline-flex items-center gap-3">
                <SlidersHorizontal size={20} />
                Filters
              </span>
              <ChevronLeft className={cn("transition-transform", !showFilters && "rotate-180")} size={20} />
            </button>

            <div className="flex min-h-16 min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-x-auto">
                <CatalogSearchActiveChips chips={filterChips} onClearAll={clearAll} />
              </div>

              {(searchActive || isBrowseLatest) && (
                <div className="flex shrink-0 items-center gap-6 sm:border-l sm:border-border sm:pl-4">
                  <ResultMetric
                    compact
                    active={!isEventsMode}
                    label="Images"
                    value={isEventsMode ? inactiveImageCount : displayCount}
                    suffix={!isEventsMode && exactTotalCount === undefined && hasMore ? "+" : undefined}
                    onClick={() => setResultMode("images")}
                  />
                  <ResultMetric
                    compact
                    active={isEventsMode}
                    label="Events"
                    value={activeEventCount}
                    onClick={typesenseSearchEnabled ? () => setResultMode("events") : undefined}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="order-2 bg-surface-warm px-3 py-6 sm:px-5 lg:px-6">
        <div className={cn("grid gap-5", showFilters && "lg:grid-cols-[300px_minmax(0,1fr)]")}>
          {showFilters && (
            showFiltersLoading ? (
              <SearchFilterPanelSkeleton />
            ) : (
              <CatalogSearchFilterPanel
                categories={filters.categories}
                events={filters.events}
                params={initialParams}
                disabled={isPending}
                onUpdate={(next) => updateParams(next)}
                onClearAll={clearAll}
              />
            )
          )}

          <main className="relative min-w-0">
            {(isPending || (isResultsFetching && (isEventsMode ? hasEventResults : hasImageResults))) && (
              <div
                className="pointer-events-none absolute inset-0 z-10 bg-background/35"
                aria-hidden="true"
              />
            )}
            {isEventsMode ? (
              hasEventResults ? (
                <>
                  <SearchEventResultsGrid events={eventItems} />
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    isFirstPage={currentPage === 1}
                    hasNextPage={isPagePagination ? currentPage < totalPages : Boolean(displayEventResult?.hasMore)}
                    disabled={isPending}
                    onPrev={goToPrev}
                    onNext={goToNext}
                  />
                </>
              ) : isResultsFetching ? (
                <SearchGridSkeleton />
              ) : (
                <div className="border border-border bg-background py-16">
                  <EmptyState
                    icon={Images}
                    title="No matching events found."
                    description={effectiveHasLoadError
                      ? "Search is temporarily unavailable. Try again in a moment."
                      : hasActiveFilters ? "Try a broader search or remove a few filters." : "Try a different search term."}
                    action={{ label: "View latest", href: "/search?mode=events" }}
                  />
                </div>
              )
            ) : hasImageResults ? (
              <>
                {viewMode === "grid" ? (
                  <PublicAssetGrid
                    assets={items}
                    limit={items.length}
                    priorityCount={8}
                    detailHrefForAsset={(asset) => buildSearchAssetHref(asset, initialParams)}
                  />
                ) : (
                  <div className="grid grid-cols-1 border-l border-t border-border bg-background sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {items.map((asset, index) => (
                      <PublicAssetCard
                        key={asset.id}
                        asset={asset}
                        variant="card"
                        priority={index < 8}
                        detailHref={buildSearchAssetHref(asset, initialParams)}
                      />
                    ))}
                  </div>
                )}

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  isFirstPage={currentPage === 1}
                  hasNextPage={isPagePagination ? currentPage < totalPages : !!nextCursor}
                  disabled={isPending}
                  onPrev={goToPrev}
                  onNext={goToNext}
                />
              </>
            ) : isResultsFetching ? (
              <SearchGridSkeleton />
            ) : (
              <div className="border border-border bg-background py-16">
                <EmptyState
                  icon={Images}
                  title="No images found."
                  description={effectiveHasLoadError
                    ? "Search is temporarily unavailable. Try again in a moment."
                    : hasActiveFilters ? "Try a broader search or remove a few filters." : "Try a different search term."}
                  action={{ label: "View latest", href: "/search?mode=events" }}
                />
              </div>
            )}
          </main>
        </div>
      </section>
    </>
  )
}

function SearchGridSkeleton() {
  return (
    <div className="grid grid-cols-2 border-l border-t border-border bg-background sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: 15 }).map((_, index) => (
        <div key={index} className="aspect-4/5 animate-pulse border-b border-r border-border bg-muted" />
      ))}
    </div>
  )
}

function ResultMetric({
  active = false,
  compact = false,
  label,
  value,
  suffix,
  onClick,
}: {
  active?: boolean
  compact?: boolean
  label: string
  value: number
  suffix?: string
  onClick?: () => void
}) {
  const valueClass = compact ? "text-lg font-semibold" : "text-2xl font-medium"
  const labelClass = compact ? "text-sm font-medium" : "text-2xl font-medium"
  const content = (
    <>
      <span className={cn(valueClass, "text-foreground")}>{formatInteger(value)}{suffix}</span>
      <span className={cn(labelClass, "ml-1.5 text-foreground")}>{label}</span>
    </>
  )

  if (!onClick) {
    return (
      <div className={cn(compact ? "border-b-2 pb-0.5" : "border-b-4 pb-1", active ? "border-accent" : "border-transparent")}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-sm text-left transition-colors",
        compact ? "-mx-1 border-b-2 px-1 pb-0.5" : "-mx-2 border-b-4 px-2 pb-1",
        active
          ? "border-accent text-foreground hover:bg-muted/50"
          : "border-transparent text-muted-foreground hover:border-border-strong hover:bg-muted/70 hover:text-foreground",
      )}
      aria-pressed={active}
    >
      {content}
    </button>
  )
}

function Pagination({
  currentPage,
  totalPages,
  isFirstPage,
  hasNextPage,
  disabled,
  onPrev,
  onNext,
}: {
  currentPage: number
  totalPages: number
  isFirstPage: boolean
  hasNextPage: boolean
  disabled?: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-8 md:gap-4 md:py-10">
      {!isFirstPage && (
        <button
          type="button"
          onClick={onPrev}
          disabled={disabled}
          className="inline-flex h-10 items-center justify-center gap-1.5 border border-border bg-background px-4 text-sm font-medium uppercase tracking-wide text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <ChevronLeft  strokeWidth={2} size={16} />
          Previous
        </button>
      )}

      <div className="inline-flex items-center gap-3 px-2">
        <div className="inline-flex h-10 w-10 items-center justify-center border border-border bg-background text-base font-medium text-foreground">
          {currentPage}
        </div>
        <span className="text-base font-medium text-foreground">of {totalPages}</span>
      </div>

      {hasNextPage && (
        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          className="inline-flex h-10 items-center justify-center gap-1.5 border border-primary bg-primary px-5 text-sm font-medium uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          Next
          <ChevronRight  strokeWidth={2} size={16} />
        </button>
      )}
    </div>
  )
}

function buildSearchAssetHref(asset: PublicAsset, params: SearchExperienceProps["initialParams"]) {
  const searchParams = new URLSearchParams()
  if (params.q) searchParams.set("q", params.q)
  if (params.categoryId) searchParams.set("categoryId", params.categoryId)
  if (params.eventId) searchParams.set("eventId", params.eventId)
  if (params.city) searchParams.set("city", params.city)
  if (params.contributorId) searchParams.set("contributorId", params.contributorId)
  if (params.year) searchParams.set("year", String(params.year))
  if (params.month) searchParams.set("month", String(params.month))
  if (params.sort && params.sort !== "newest") searchParams.set("sort", params.sort)
  if (params.page && params.page > 1) searchParams.set("page", String(params.page))
  if (params.cursor) searchParams.set("cursor", params.cursor)
  if (params.view === "card") searchParams.set("view", "card")

  const query = searchParams.toString()
  return query ? `/assets/${asset.id}?${query}` : `/assets/${asset.id}`
}

function buildSearchScopeQueryParams(params: SearchExperienceProps["initialParams"]) {
  return {
    q: params.q,
    categoryId: params.categoryId,
    eventId: params.eventId,
    city: params.city,
    contributorId: params.contributorId,
    year: params.year,
    month: params.month,
    sort: params.sort,
  }
}

function buildEventSearchQueryParams(
  params: SearchExperienceProps["initialParams"],
  paginationMode: SearchExperienceProps["paginationMode"],
) {
  return {
    q: params.q,
    categoryId: params.categoryId,
    eventId: params.eventId,
    city: params.city,
    contributorId: params.contributorId,
    year: params.year,
    month: params.month,
    sort: params.sort,
    page: paginationMode === "page" ? params.page ?? 1 : 1,
    mode: params.mode ?? "events",
  }
}

function buildSearchQueryParams(
  params: SearchExperienceProps["initialParams"],
  paginationMode: SearchExperienceProps["paginationMode"],
) {
  return {
    q: params.q,
    categoryId: params.categoryId,
    eventId: params.eventId,
    city: params.city,
    contributorId: params.contributorId,
    year: params.year,
    month: params.month,
    sort: params.sort,
    cursor: paginationMode === "cursor" ? params.cursor : undefined,
    page: paginationMode === "page" ? params.page ?? 1 : undefined,
    view: params.view ?? "grid",
    paginationMode: paginationMode ?? "cursor",
  }
}

function deriveSelectedEventFromItems(
  eventId: string | undefined,
  items: PublicAsset[],
): SearchSelectedEvent | null {
  if (!eventId) return null

  const event = items.find((item) => item.event?.id === eventId)?.event
  if (!event) return null

  return {
    id: event.id,
    name: event.name,
    eventDate: event.eventDate,
  }
}

function buildSearchScrollKey(searchCacheKey: string) {
  return `${searchCacheKey}:scrollY`
}

function resolveTypesenseSearchEnabled(serverFlag?: boolean) {
  if (serverFlag !== undefined) return serverFlag
  return isTypesenseSearchEnabled()
}
