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
import { PaginationPageInput } from "@/components/shared/pagination-page-input"
import {
  CATALOG_MONTH_OPTIONS,
  CatalogSearchActiveChips,
  CatalogSearchFilterPanel,
} from "@/components/search/catalog-search-filter-panel"
import { CaricatureSearchFilterPanel } from "@/components/search/caricature-search-filter-panel"
import { CaricatureSearchResultGrid } from "@/components/search/caricature-search-result-grid"
import { SearchFilterPanelSkeleton } from "@/components/search/search-filter-skeletons"
import { SearchEventResultsGrid } from "@/components/search/search-event-results-grid"
import { SearchSegmentSelect } from "@/components/search/search-segment-select"
import { useSearchFilters, hasPopulatedAssetFilters } from "@/components/search/search-filters-context"
import { Button } from "@/components/ui/button"
import type { SearchSelectedEvent } from "@/components/search/search-experience-types"
import { getPublicCatalogTaxonomy, isTypesenseSearchEnabled, searchPublicAssets, searchPublicCaricatures, searchPublicEvents } from "@/lib/api/fotocorp-api"
import {
  buildCaricatureFilterChips,
  buildCaricatureSearchQueryParams,
  hasCaricatureSearchIntent,
  mapCaricatureSearchItemToGridItem,
  resolveCaricatureCategoryLabel,
  resolveCaricatureFilterUpdates,
  resolveCaricatureSubmitSort,
} from "@/lib/search/caricature-search"
import { hasSearchIntent } from "@/lib/search/search-intent"
import {
  applySearchSegmentChange,
  buildSearchPageHref,
  DEFAULT_SEARCH_SEGMENT,
  isEditorialSearchSegment,
  type SearchSegment,
} from "@/lib/search/search-segment"
import { cn, formatInteger } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Images, SlidersHorizontal, X, SearchIcon } from "lucide-react"

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
    segment?: SearchSegment
    language?: string
    credit?: string
    hasVisibleText?: boolean
    depictedSubject?: string
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
  const searchSegment = initialParams.segment ?? DEFAULT_SEARCH_SEGMENT
  const isCaricatureSegment = !isEditorialSearchSegment(searchSegment)
  const searchActive = isCaricatureSegment
    ? hasCaricatureSearchIntent(initialParams)
    : hasSearchIntent(initialParams)
  const isBrowseLatest = !searchActive && (initialParams.mode ?? "images") === "images" && !isCaricatureSegment
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
      initialParams.language,
      initialParams.credit,
      initialParams.hasVisibleText,
      initialParams.depictedSubject,
    ],
  )
  const caricatureSearchQueryParams = useMemo(
    () => buildCaricatureSearchQueryParams({
      q: initialParams.q,
      categoryId: initialParams.categoryId,
      language: initialParams.language,
      credit: initialParams.credit,
      hasVisibleText: initialParams.hasVisibleText,
      depictedSubject: initialParams.depictedSubject,
      page: paginationMode === "page" ? initialParams.page ?? 1 : 1,
      limit: PAGE_SIZE,
      sort: initialParams.sort,
      includeFacets: showFilters || filtersRequested,
    }),
    [
      initialParams.q,
      initialParams.categoryId,
      initialParams.language,
      initialParams.credit,
      initialParams.hasVisibleText,
      initialParams.depictedSubject,
      initialParams.page,
      initialParams.sort,
      paginationMode,
      showFilters,
      filtersRequested,
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
    enabled: (searchActive || isBrowseLatest) && resultMode === "images" && !isCaricatureSegment,
  })
  const {
    data: caricatureResult,
    error: caricatureSearchError,
    isFetching: isCaricatureFetching,
  } = useQuery({
    queryKey: ["public-search-caricatures", caricatureSearchQueryParams],
    queryFn: () => searchPublicCaricatures(caricatureSearchQueryParams),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: keepPreviousData,
    enabled: isCaricatureSegment,
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
    enabled: filtersRequested && !isCaricatureSegment,
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
    enabled: searchActive && typesenseSearchEnabled && resultMode === "events" && !isCaricatureSegment,
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
    enabled: searchActive && typesenseSearchEnabled && resultMode === "images" && !isCaricatureSegment,
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
    enabled: searchActive && typesenseSearchEnabled && resultMode === "events" && !isCaricatureSegment,
  })
  const items = displayResult?.items ?? initialResult.items
  const caricatureItems = useMemo(
    () => (caricatureResult?.items ?? []).map(mapCaricatureSearchItemToGridItem),
    [caricatureResult?.items],
  )
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
  const showFiltersLoading = filtersRequested && !filtersReady && isFiltersFetching && !isCaricatureSegment
  const showCaricatureFiltersLoading = showFilters && isCaricatureSegment && isCaricatureFetching && !caricatureResult
  const caricatureFacets = caricatureResult?.facets ?? {
    categories: [],
    languages: [],
    credits: [],
    hasVisibleText: [],
    depictedSubjects: [],
  }
  const caricaturePopularSortAvailable = caricatureResult?.meta?.popularSortAvailable === true
  const caricatureCategoryLabel = resolveCaricatureCategoryLabel(
    initialParams.categoryId,
    caricatureFacets,
    caricatureResult?.items,
  )
  const caricatureActiveCategoryId = (() => {
    if (!initialParams.categoryId) return undefined
    const facetMatch = caricatureFacets.categories.find(
      (category) => category.value === initialParams.categoryId || category.name === initialParams.categoryId,
    )
    if (facetMatch) return facetMatch.value
    if (caricatureCategoryLabel) {
      const labelMatch = caricatureFacets.categories.find(
        (category) => category.name === caricatureCategoryLabel || category.value === caricatureCategoryLabel,
      )
      if (labelMatch) return labelMatch.value
      return caricatureCategoryLabel
    }
    return initialParams.categoryId
  })()

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
  const effectiveHasLoadError = hasLoadError
    || Boolean(searchError)
    || (isCaricatureSegment && Boolean(caricatureSearchError))
    || (isEventsMode && Boolean(eventSearchError))

  const filterChips = useMemo(() => {
    if (isCaricatureSegment) {
      return buildCaricatureFilterChips(
        initialParams,
        { categoryName: caricatureCategoryLabel },
        (next) => updateParams({ ...next, page: 1 }),
      )
    }

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
  }, [
    isCaricatureSegment,
    initialParams.q,
    initialParams.categoryId,
    initialParams.eventId,
    initialParams.city,
    initialParams.year,
    initialParams.month,
    initialParams.language,
    initialParams.credit,
    initialParams.hasVisibleText,
    initialParams.depictedSubject,
    categoryName,
    eventChipLabel,
    cityName,
    caricatureCategoryLabel,
  ])

  function updateParams(next: Partial<SearchExperienceProps["initialParams"]>, forceSort = true) {
    const merged = { ...initialParams, ...next }

    const effectiveSort = forceSort
      ? merged.sort === "relevance" && merged.q
        ? "relevance"
        : merged.sort === "oldest"
          ? "oldest"
          : merged.sort === "popular" && merged.segment === "caricature"
            ? "popular"
          : "newest"
      : merged.sort

    const nextParams: SearchExperienceProps["initialParams"] = {
      ...merged,
      sort: effectiveSort,
      cursor: "cursor" in next ? merged.cursor : isPagePagination ? undefined : merged.cursor,
      page: isPagePagination && !("page" in next) ? undefined : merged.page,
    }

    startTransition(() => {
      router.replace(buildSearchPageHref(nextParams))
    })
  }

  function setSearchSegment(nextSegment: SearchSegment) {
    updateParams(applySearchSegmentChange(initialParams, nextSegment), false)
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = queryDraft.trim()
    updateParams({
      q: q || undefined,
      sort: isCaricatureSegment ? resolveCaricatureSubmitSort(q) : "newest",
      ...(q && !isCaricatureSegment
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
      language: undefined,
      credit: undefined,
      hasVisibleText: undefined,
      depictedSubject: undefined,
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

  function goToPage(page: number) {
    if (!isPagePagination) return

    updateParams({ page: page > 1 ? page : undefined }, false)
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
  const isResultsFetching = isCaricatureSegment ? isCaricatureFetching : (isEventsMode ? isEventFetching : isFetching)
  const hasEventResults = eventItems.length > 0
  const hasImageResults = items.length > 0
  const hasCaricatureResults = caricatureItems.length > 0
  const caricatureTotalCount = caricatureResult?.totalCount ?? caricatureItems.length
  const caricatureTotalPages = caricatureResult?.totalPages
    ?? Math.max(1, Math.ceil(caricatureTotalCount / PAGE_SIZE))
  const caricatureCurrentPage = Math.min(caricatureResult?.page ?? initialParams.page ?? 1, caricatureTotalPages)

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
                placeholder={isCaricatureSegment
                  ? "Search caricatures by headline, subject, or visible text"
                  : "AI-enabled search for images, events, categories, Fotokey"}
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-lg font-medium text-foreground shadow-none outline-none ring-0 placeholder:text-lg placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0 md:text-xl md:placeholder:text-xl"
              />
            </label>

            <SearchSegmentSelect
              value={searchSegment}
              onChange={setSearchSegment}
              disabled={isPending}
              className="hidden md:flex"
            />

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

          <div className="border-b border-border bg-background md:hidden">
            <SearchSegmentSelect
              value={searchSegment}
              onChange={setSearchSegment}
              disabled={isPending}
            />
          </div>

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

              {(searchActive || isBrowseLatest) && !isCaricatureSegment && (
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
          {showFilters && isCaricatureSegment && (
            showCaricatureFiltersLoading ? (
              <SearchFilterPanelSkeleton />
            ) : (
              <CaricatureSearchFilterPanel
                facets={caricatureFacets}
                params={initialParams}
                activeCategoryId={caricatureActiveCategoryId}
                popularSortAvailable={caricaturePopularSortAvailable}
                disabled={isPending}
                onUpdate={(next) => updateParams(resolveCaricatureFilterUpdates(initialParams, next))}
                onClearAll={clearAll}
              />
            )
          )}
          {showFilters && !isCaricatureSegment && (
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
            {isCaricatureSegment ? (
              caricatureSearchError && !isCaricatureFetching ? (
                <div className="border border-border bg-background py-16">
                  <EmptyState
                    icon={Images}
                    title="Caricature search is temporarily unavailable."
                    description="Caricature search is temporarily unavailable. If this persists, confirm published caricatures have blurred previews and run `pnpm --dir apps/api typesense:index-caricatures` to rebuild the search index."
                    action={{ label: "Search editorial images", href: buildSearchPageHref({ q: initialParams.q, segment: "editorial" }) }}
                  />
                </div>
              ) : hasCaricatureResults ? (
                <>
                  <CaricatureSearchResultGrid items={caricatureItems} priorityCount={8} />
                  <Pagination
                    currentPage={caricatureCurrentPage}
                    totalPages={caricatureTotalPages}
                    isFirstPage={caricatureCurrentPage === 1}
                    hasNextPage={caricatureResult?.hasMore === true || caricatureCurrentPage < caricatureTotalPages}
                    disabled={isPending}
                    onPrev={goToPrev}
                    onNext={goToNext}
                    onGoToPage={isPagePagination ? goToPage : undefined}
                  />
                </>
              ) : isCaricatureFetching ? (
                <SearchGridSkeleton />
              ) : (
                <div className="border border-border bg-background py-16">
                  <EmptyState
                    icon={Images}
                    title={searchActive ? "No caricatures matched your search." : "No caricatures published yet."}
                    description={effectiveHasLoadError
                      ? "Caricature search is temporarily unavailable. Try again in a moment."
                      : searchActive
                        ? "Try a broader search term or remove filters."
                        : "Published caricatures appear here once staff approval finishes and blurred previews are ready. If items were published recently, refresh in a moment or run `pnpm --dir apps/api typesense:index-caricatures` to backfill search."}
                    action={{ label: "Search editorial images", href: buildSearchPageHref({ q: initialParams.q, segment: "editorial" }) }}
                  />
                </div>
              )
            ) : (
              <>
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
                    onGoToPage={isPagePagination ? goToPage : undefined}
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
                  onGoToPage={isPagePagination ? goToPage : undefined}
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
              </>
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
  onGoToPage,
}: {
  currentPage: number
  totalPages: number
  isFirstPage: boolean
  hasNextPage: boolean
  disabled?: boolean
  onPrev: () => void
  onNext: () => void
  onGoToPage?: (page: number) => void
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
        {onGoToPage ? (
          <PaginationPageInput
            currentPage={currentPage}
            totalPages={totalPages}
            disabled={disabled}
            onGoToPage={onGoToPage}
          />
        ) : (
          <div className="inline-flex h-10 w-10 items-center justify-center border border-border bg-background text-base font-medium text-foreground">
            {currentPage}
          </div>
        )}
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
  if (params.segment && params.segment !== "editorial") searchParams.set("segment", params.segment)

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
    language: params.language,
    credit: params.credit,
    hasVisibleText: params.hasVisibleText,
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
