"use client"

import { Calendars, ChevronDown, ListFilterIcon, X } from "lucide-react"
import type React from "react"

import type { PublicAssetFiltersResponse, PublicAssetSort } from "@/features/assets/types"
import { filterVisibleCatalogCategories } from "@/lib/catalog/visible-categories"
import { PaginationPageInput } from "@/components/shared/pagination-page-input"
import { cn, formatInteger } from "@/lib/utils"

export interface CatalogSearchParams {
  q?: string
  categoryId?: string
  eventId?: string
  city?: string
  year?: number
  month?: number
  sort: PublicAssetSort
  page?: number
}

export const CATALOG_SORT_OPTIONS: Array<{ label: string; value: PublicAssetSort }> = [
  { label: "Best match", value: "relevance" },
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
]

export const CATALOG_MONTH_OPTIONS = [
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

export function catalogYearOptions() {
  const current = new Date().getFullYear()
  return Array.from({ length: 12 }, (_, index) => current - index)
}

export function formatCatalogShortDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date)
}

interface CatalogSearchFilterPanelProps {
  categories: PublicAssetFiltersResponse["categories"]
  events: PublicAssetFiltersResponse["events"]
  params: CatalogSearchParams
  disabled?: boolean
  onUpdate: (next: Partial<CatalogSearchParams>) => void
  onClearAll: () => void
}

export function CatalogSearchFilterPanel({
  categories,
  events,
  params,
  disabled,
  onUpdate,
  onClearAll,
}: CatalogSearchFilterPanelProps) {
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
          {CATALOG_SORT_OPTIONS.map((option) => (
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
          <CatalogLabeledSelect
            label="Year"
            value={params.year ? String(params.year) : ""}
            onChange={(value) => onUpdate({ year: value ? Number(value) : undefined, page: 1 })}
            disabled={disabled}
          >
            <option value="">Any year</option>
            {catalogYearOptions().map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </CatalogLabeledSelect>
          <CatalogLabeledSelect
            label="Month"
            value={params.month ? String(params.month) : ""}
            onChange={(value) => onUpdate({ month: value ? Number(value) : undefined, page: 1 })}
            disabled={disabled}
          >
            <option value="">Any month</option>
            {CATALOG_MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </CatalogLabeledSelect>
        </div>
      </section>

      <CatalogSearchFilterList
        title="Categories"
        emptyLabel="No categories available"
        showCounts={false}
        items={filterVisibleCatalogCategories(categories).map((category) => ({
          id: category.id,
          label: category.name,
          count: category.assetCount,
        }))}
        activeId={params.categoryId}
        onSelect={(id) => onUpdate({ categoryId: id === params.categoryId ? undefined : id, page: 1 })}
      />

      <CatalogSearchFilterList
        title="Events"
        emptyLabel="No events available"
        showCounts={false}
        items={events.slice(0, 24).map((event) => ({
          id: event.id,
          label: event.name ?? "Untitled event",
          count: event.assetCount,
          meta: formatCatalogShortDate(event.eventDate),
        }))}
        activeId={params.eventId}
        onSelect={(id) => onUpdate({ eventId: id === params.eventId ? undefined : id, page: 1 })}
      />
    </aside>
  )
}

export function CatalogSearchFilterList({
  title,
  items,
  activeId,
  emptyLabel,
  showCounts = true,
  onSelect,
}: {
  title: string
  items: Array<{ id: string; label: string; count: number; meta?: string | null }>
  activeId?: string
  emptyLabel: string
  showCounts?: boolean
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
                {item.meta ? <span className="block text-xs text-muted-foreground">{item.meta}</span> : null}
              </span>
              {showCounts ? (
                <span className="shrink-0 text-xs text-muted-foreground">{formatInteger(item.count)}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </section>
  )
}

export function CatalogSearchActiveChips({
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

export function CatalogSearchPagination({
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
  onGoToPage: (page: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-6 md:gap-4">
      {!isFirstPage ? (
        <button
          type="button"
          onClick={onPrev}
          disabled={disabled}
          className="inline-flex h-10 items-center justify-center gap-1.5 border border-border bg-background px-4 text-sm font-medium uppercase tracking-wide text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          Previous
        </button>
      ) : null}

      <div className="inline-flex items-center gap-3 px-2">
        <PaginationPageInput
          currentPage={currentPage}
          totalPages={totalPages}
          disabled={disabled}
          onGoToPage={onGoToPage}
        />
        <span className="text-base font-medium text-foreground">of {totalPages}</span>
      </div>

      {hasNextPage ? (
        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          className="inline-flex h-10 items-center justify-center gap-1.5 border border-primary bg-primary px-5 text-sm font-medium uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          Next
        </button>
      ) : null}
    </div>
  )
}

function CatalogLabeledSelect({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-11 w-full appearance-none border border-border-strong bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
      </div>
    </label>
  )
}
