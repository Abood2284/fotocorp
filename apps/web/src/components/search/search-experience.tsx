"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import type React from "react"
import { useEffect, useMemo, useState, useTransition } from "react"

import type {
  PublicAsset,
  PublicAssetFiltersResponse,
  PublicAssetListResponse,
  PublicAssetSort,
} from "@/features/assets/types"
import { PublicAssetCard } from "@/components/assets/public-asset-card"
import { PublicAssetGrid } from "@/components/assets/public-asset-grid"
import { EmptyState } from "@/components/shared/empty-state"
import {
  SearchCategoryTabsSkeleton,
  SearchFilterPanelSkeleton,
} from "@/components/search/search-filter-skeletons"
import { useSearchFilters } from "@/components/search/search-filters-context"
import { Button } from "@/components/ui/button"
import type { SearchSelectedEvent } from "@/components/search/search-experience-types"
import { searchPublicAssets } from "@/lib/api/fotocorp-api"
import { cn, formatInteger } from "@/lib/utils"
import {  Calendars, ChevronDown, ChevronLeft, ChevronRight, Images, Rows, SlidersHorizontal, X, Grid3x3, SearchIcon, ListFilterIcon  } from "lucide-react"

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
  }
  initialResult: PublicAssetListResponse
  selectedEvent?: SearchSelectedEvent | null
  hasLoadError?: boolean
  paginationMode?: "cursor" | "page"
}

type SearchViewMode = "grid" | "card"

const SORT_OPTIONS: Array<{ label: string; value: PublicAssetSort }> = [
  { label: "Best match", value: "relevance" },
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
]

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]

const PAGE_SIZE = 50

export function SearchExperience({
  initialParams,
  initialResult,
  selectedEvent = null,
  hasLoadError = false,
  paginationMode = "cursor",
}: SearchExperienceProps) {
  const router = useRouter()
  const { filters, isLoading: filtersLoading, mergeFilters } = useSearchFilters()
  const [isPending, startTransition] = useTransition()
  const [showFilters, setShowFilters] = useState(false)
  const [queryDraft, setQueryDraft] = useState(initialParams.q ?? "")
  const searchQueryParams = useMemo(
    () => buildSearchQueryParams(initialParams, paginationMode),
    [initialParams, paginationMode],
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
    }),
    initialData: initialResult.items.length > 0 ? initialResult : undefined,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
  const items = displayResult.items
  const nextCursor = displayResult.nextCursor
  const hasMore = displayResult.hasMore ?? Boolean(nextCursor)
  const viewMode = initialParams.view ?? "grid"
  const eventFilterCount = filters.events.find((item) => item.id === initialParams.eventId)?.assetCount
  const totalCount = displayResult.totalCount ?? eventFilterCount ?? items.length
  const isPagePagination = paginationMode === "page"

  const [history, setHistory] = useState<(string | undefined)[]>([undefined])
  const baseParamsKey = JSON.stringify({ ...initialParams, cursor: undefined })

  useEffect(() => {
    setHistory([undefined])
  }, [baseParamsKey])

  useEffect(() => {
    setQueryDraft(initialParams.q ?? "")
  }, [initialParams.q])

  useEffect(() => {
    if (displayResult.filters) mergeFilters(displayResult.filters)
  }, [displayResult.filters, mergeFilters])

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
  const eventName = selectedEvent?.name
    ?? filters.events.find((item) => item.id === initialParams.eventId)?.name
    ?? undefined
  const cityName = filters.cities?.find((item) => item.id === initialParams.city)?.name ?? initialParams.city
  const activeEventCount = initialParams.eventId ? 1 : filtersLoading ? 0 : filters.events.length
  const topCategories = filters.categories.slice(0, 5)
  const eventChipLabel = eventName ?? (initialParams.eventId && (filtersLoading || isFetching) ? "Loading event…" : undefined)
  const effectiveHasLoadError = hasLoadError || Boolean(searchError)

  const filterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; remove: () => void }> = []
    if (initialParams.q) chips.push({ key: "q", label: initialParams.q, remove: () => updateParams({ q: undefined }) })
    if (categoryName) chips.push({ key: "category", label: categoryName, remove: () => updateParams({ categoryId: undefined }) })
    if (eventChipLabel) chips.push({ key: "event", label: eventChipLabel, remove: () => updateParams({ eventId: undefined }) })
    if (cityName) chips.push({ key: "city", label: cityName, remove: () => updateParams({ city: undefined }) })
    if (initialParams.year) chips.push({ key: "year", label: String(initialParams.year), remove: () => updateParams({ year: undefined }) })
    if (initialParams.month) {
      const monthLabel = MONTH_OPTIONS.find((item) => item.value === initialParams.month)?.label ?? String(initialParams.month)
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

    const effectiveSort = forceSort
      ? merged.q
        ? (merged.sort === "oldest" || merged.sort === "newest" ? merged.sort : "relevance")
        : merged.sort === "relevance"
          ? "newest"
          : (merged.sort ?? "newest")
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
      cursor: undefined,
      page: undefined,
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
    })
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
    ? (displayResult.page ?? initialParams.page ?? 1)
    : currentIndex !== -1 ? currentIndex + 1 : (initialParams.cursor ? 2 : 1)
  const exactTotalCount = displayResult.totalCount ?? eventFilterCount
  const totalPages = displayResult.totalPages ?? (exactTotalCount !== undefined
    ? Math.max(1, Math.ceil(exactTotalCount / PAGE_SIZE))
    : Math.max(displayPage, hasMore ? displayPage + 1 : displayPage))
  const currentPage = Math.min(displayPage, totalPages)
  const displayCount = exactTotalCount
    ?? Math.max(totalCount, (displayPage - 1) * PAGE_SIZE + items.length)
  const resultTitle = buildResultTitle(
    displayCount,
    initialParams.q,
    categoryName,
    eventName,
    exactTotalCount === undefined && hasMore,
  )
  const hasActiveFilters = filterChips.length > 0 || initialParams.sort !== "newest"

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section
        className="sticky top-0 z-50 border-b border-foreground/80 bg-background shadow-sm"
      >
        <form onSubmit={submitSearch} className="grid min-h-[72px] grid-cols-[1fr_auto] items-stretch border-b border-border bg-background focus-within:outline-none md:grid-cols-[1fr_260px_auto]">
          <label className="flex min-w-0 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <SearchIcon className="shrink-0 text-foreground" strokeWidth={2.1} size={24} />
            <span className="sr-only">Search the Fotocorp archive</span>
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Search images, events, categories, Fotokey"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-lg font-medium text-foreground shadow-none outline-none ring-0 placeholder:text-lg placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 md:text-xl md:placeholder:text-xl"
            />
          </label>

          <div className="hidden items-center justify-center border-l border-border px-6 text-base font-medium text-foreground md:flex">
            Editorial images
            <ChevronDown className="ml-3" size={16} />
          </div>

          <div className="flex items-center border-l border-border">
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
            onClick={() => setShowFilters((value) => !value)}
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
            <ChevronLeft className={cn(" transition-transform", !showFilters &&"rotate-180")} size={20} />
          </button>

          {filtersLoading ? (
            <SearchCategoryTabsSkeleton />
          ) : (
            <div className="flex min-w-0 items-center gap-3 overflow-x-auto px-4 py-3 sm:px-6">
              <FilterTab active={!initialParams.categoryId} onClick={() => updateParams({ categoryId: undefined })}>
                All
              </FilterTab>
              {topCategories.map((category) => (
                <FilterTab
                  key={category.id}
                  active={initialParams.categoryId === category.id}
                  onClick={() => updateParams({ categoryId: category.id })}
                >
                  {category.name}
                </FilterTab>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-surface-warm px-3 py-6 sm:px-5 lg:px-6">
        <div className="mb-6 grid gap-5 md:grid-cols-[1fr_auto_190px] md:items-end">
          <div>
            <h1 className="text-2xl font-medium tracking-normal text-foreground md:text-3xl">
              {resultTitle}
            </h1>
            <ActiveChips chips={filterChips} onClearAll={clearAll} className="mt-3" />
          </div>

          <div className="flex items-end gap-8">
            <ResultMetric active label="Images" value={displayCount} suffix={!exactTotalCount && hasMore ? "+" : undefined} />
            <ResultMetric label="Events" value={activeEventCount} />
          </div>

          <ViewToggle value={viewMode} onChange={(value) => updateParams({ view: value }, false)} />
        </div>

        <div className={cn("grid gap-5", showFilters && "lg:grid-cols-[300px_minmax(0,1fr)]")}>
          {showFilters && (
            filtersLoading ? (
              <SearchFilterPanelSkeleton />
            ) : (
              <FilterPanel
                categories={filters.categories}
                events={filters.events}
                cities={filters.cities ?? []}
                params={initialParams}
                disabled={isPending}
                onUpdate={updateParams}
                onClearAll={clearAll}
              />
            )
          )}

          <main className="relative min-w-0">
            {(isPending || (isFetching && items.length > 0)) && (
              <div
                className="pointer-events-none absolute inset-0 z-10 bg-background/35"
                aria-hidden="true"
              />
            )}
            {items.length > 0 ? (
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
            ) : isFetching ? (
              <SearchGridSkeleton />
            ) : (
              <div className="border border-border bg-background py-16">
                <EmptyState
                  icon={Images}
                  title="No matching images found."
                  description={effectiveHasLoadError
                    ? "Search is temporarily unavailable. Try again in a moment."
                    : hasActiveFilters ? "Try a broader search or remove a few filters." : "Try a different search term."}
                  action={{ label: "View latest", href: "/search" }}
                />
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  )
}

function SearchGridSkeleton() {
  return (
    <div className="grid grid-cols-2 border-l border-t border-border bg-background sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: 15 }).map((_, index) => (
        <div key={index} className="aspect-[4/5] animate-pulse border-b border-r border-border bg-muted" />
      ))}
    </div>
  )
}

function FilterPanel({
  categories,
  events,
  cities,
  params,
  disabled,
  onUpdate,
  onClearAll,
}: {
  categories: PublicAssetFiltersResponse["categories"]
  events: PublicAssetFiltersResponse["events"]
  cities: NonNullable<PublicAssetFiltersResponse["cities"]>
  params: SearchExperienceProps["initialParams"]
  disabled?: boolean
  onUpdate: (next: Partial<SearchExperienceProps["initialParams"]>, forceSort?: boolean) => void
  onClearAll: () => void
}) {
  return (
    <aside className="border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-4 text-primary-foreground">
        <span className="inline-flex items-center gap-3 text-base font-semibold uppercase tracking-wide">
          <ListFilterIcon className="h-5 w-5" />
          Filters
        </span>
        <button type="button" onClick={onClearAll} className="text-sm font-medium underline underline-offset-4">
          Reset
        </button>
      </div>

      <section className="border-b border-border p-4">
        <h2 className="mb-3 text-base font-semibold uppercase tracking-wide text-foreground">Sort by</h2>
        <div className="overflow-hidden border border-border">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled || (option.value === "relevance" && !params.q)}
              onClick={() => onUpdate({ sort: option.value })}
              className={cn(
                "flex h-12 w-full items-center gap-3 border-b border-border px-4 text-left text-sm transition-colors last:border-b-0 disabled:cursor-not-allowed disabled:opacity-45",
                params.sort === option.value ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted",
              )}
            >
              <span className={cn("h-4 w-4 rounded-full border-2", params.sort === option.value ? "border-primary-foreground bg-primary-foreground shadow-[inset_0_0_0_3px_var(--primary)]" : "border-border-strong")} />
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="border-b border-border p-4">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold uppercase tracking-wide text-foreground">
          <Calendars size={20} />
          Date range
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <LabeledSelect
            label="Year"
            value={params.year ? String(params.year) : ""}
            onChange={(value) => onUpdate({ year: value ? Number(value) : undefined })}
            disabled={disabled}
          >
            <option value="">Any year</option>
            {yearOptions().map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </LabeledSelect>
          <LabeledSelect
            label="Month"
            value={params.month ? String(params.month) : ""}
            onChange={(value) => onUpdate({ month: value ? Number(value) : undefined })}
            disabled={disabled}
          >
            <option value="">Any month</option>
            {MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </LabeledSelect>
        </div>
      </section>

      <FilterList
        title="Categories"
        emptyLabel="No categories available"
        items={categories.map((category) => ({ id: category.id, label: category.name, count: category.assetCount }))}
        activeId={params.categoryId}
        onSelect={(id) => onUpdate({ categoryId: id === params.categoryId ? undefined : id })}
      />

      <FilterList
        title="Events"
        emptyLabel="No events available"
        items={events.slice(0, 24).map((event) => ({
          id: event.id,
          label: event.name ?? "Untitled event",
          count: event.assetCount,
          meta: formatShortDate(event.eventDate),
        }))}
        activeId={params.eventId}
        onSelect={(id) => onUpdate({ eventId: id === params.eventId ? undefined : id })}
      />

      <FilterList
        title="Cities"
        emptyLabel="No cities available"
        items={cities.slice(0, 24).map((city) => ({
          id: city.id,
          label: city.name,
          count: city.assetCount,
        }))}
        activeId={params.city}
        onSelect={(id) => onUpdate({ city: id === params.city ? undefined : id })}
      />
    </aside>
  )
}

function FilterList({
  title,
  items,
  activeId,
  emptyLabel,
  onSelect,
}: {
  title: string
  items: Array<{ id: string; label: string; count: number; meta?: string | null }>
  activeId?: string
  emptyLabel: string
  onSelect: (id: string) => void
}) {
  return (
    <section className="border-b border-border p-4 last:border-b-0">
      <h2 className="mb-3 text-base font-semibold uppercase tracking-wide text-foreground">{title}</h2>
      {items.length > 0 ? (
        <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex w-full items-start justify-between gap-3 px-2 py-2 text-left text-sm transition-colors",
                activeId === item.id ? "bg-accent-wash text-foreground ring-1 ring-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.label}</span>
                {item.meta && <span className="block text-xs text-muted-foreground">{item.meta}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatInteger(item.count)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </section>
  )
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 shrink-0 px-4 text-sm font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

function ResultMetric({
  active = false,
  label,
  value,
  suffix,
}: {
  active?: boolean
  label: string
  value: number
  suffix?: string
}) {
  return (
    <div className={cn("border-b-4 pb-1", active ? "border-accent" : "border-transparent")}>
      <span className="text-2xl font-medium text-foreground">{formatInteger(value)}{suffix}</span>
      <span className="ml-2 text-2xl font-medium text-foreground">{label}</span>
    </div>
  )
}

function ViewToggle({
  value,
  onChange,
}: {
  value: SearchViewMode
  onChange: (value: SearchViewMode) => void
}) {
  return (
    <div className="ml-auto inline-flex h-12 overflow-hidden border border-border-strong bg-muted">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={cn("flex w-14 items-center justify-center border-r border-border-strong transition-colors", value === "grid" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground")}
        aria-label="Grid view"
      >
        <Grid3x3 className="h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={() => onChange("card")}
        className={cn("flex w-14 items-center justify-center transition-colors", value === "card" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground")}
        aria-label="Card view"
      >
        <Rows className="h-6 w-6" />
      </button>
    </div>
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

function LabeledSelect({
  label,
  value,
  onChange,
  children,
  disabled,
  compact = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <label className={cn("block text-sm", compact ? "flex items-center gap-2" : "space-y-1.5")}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={cn(
            "w-full appearance-none border border-border-strong bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50",
            compact ? "h-9 min-w-[150px] pl-3 pr-8" : "h-11 pl-3 pr-8",
          )}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2  -translate-y-1/2 text-muted-foreground" size={16} />
      </div>
    </label>
  )
}

function ActiveChips({
  chips,
  onClearAll,
  className,
}: {
  chips: Array<{ key: string; label: string; remove: () => void }>
  onClearAll: () => void
  className?: string
}) {
  if (chips.length === 0) return null
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          aria-label={`Remove filter ${chip.label}`}
          className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
        >
          <span>{chip.label}</span>
          <X size={14} />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-medium text-muted-foreground underline underline-offset-4"
      >
        Clear all
      </button>
    </div>
  )
}

function buildResultTitle(
  totalCount: number,
  query?: string,
  categoryName?: string,
  eventName?: string,
  approximate = false,
) {
  const total = `${formatInteger(totalCount)}${approximate ? "+" : ""}`
  if (query) return `${total} ${query} photos and high-res pictures`
  if (eventName) return `${total} photos from ${eventName}`
  if (categoryName) return `${total} ${categoryName} photos and high-res pictures`
  return `${total} latest editorial photos and high-res pictures`
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date)
}

function yearOptions() {
  const current = new Date().getFullYear()
  return Array.from({ length: 12 }, (_, index) => current - index)
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

function buildSearchScrollKey(searchCacheKey: string) {
  return `${searchCacheKey}:scrollY`
}
