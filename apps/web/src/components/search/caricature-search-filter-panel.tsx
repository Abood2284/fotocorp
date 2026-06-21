"use client"

import { ChevronDown, ListFilterIcon } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

import type { PublicAssetSort, PublicCaricatureSearchResponse } from "@/features/assets/types"
import {
  buildCaricatureCategoryFilterItems,
  buildCaricatureCreditFilterItems,
  buildCaricatureDepictedSubjectFilterItems,
  buildCaricatureLanguageFilterItems,
  type CaricatureFilterListItem,
  type CaricatureSearchFilterParams,
} from "@/lib/search/caricature-search"
import { cn, formatInteger } from "@/lib/utils"

export type { CaricatureSearchFilterParams }

export const CARICATURE_SORT_OPTIONS: Array<{ label: string; value: PublicAssetSort }> = [
  { label: "Best match", value: "relevance" },
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Popular", value: "popular" },
]

const VISIBLE_TEXT_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "true", label: "Has visible text" },
  { value: "false", label: "No visible text" },
] as const

const SEARCH_LIST_PREVIEW_COUNT = 10

interface CaricatureSearchFilterPanelProps {
  facets: PublicCaricatureSearchResponse["facets"]
  params: CaricatureSearchFilterParams
  activeCategoryId?: string
  popularSortAvailable?: boolean
  disabled?: boolean
  onUpdate: (next: Partial<CaricatureSearchFilterParams>) => void
  onClearAll: () => void
}

export function CaricatureSearchFilterPanel({
  facets,
  params,
  activeCategoryId,
  popularSortAvailable = false,
  disabled,
  onUpdate,
  onClearAll,
}: CaricatureSearchFilterPanelProps) {
  const visibleTextValue = params.hasVisibleText === true
    ? "true"
    : params.hasVisibleText === false
      ? "false"
      : "any"

  const categoryItems = useMemo(() => buildCaricatureCategoryFilterItems(facets), [facets])
  const languageItems = useMemo(() => buildCaricatureLanguageFilterItems(facets), [facets])
  const creditItems = useMemo(() => buildCaricatureCreditFilterItems(facets), [facets])
  const depictedSubjectItems = useMemo(() => buildCaricatureDepictedSubjectFilterItems(facets), [facets])

  const sortOptions = popularSortAvailable
    ? CARICATURE_SORT_OPTIONS
    : CARICATURE_SORT_OPTIONS.filter((option) => option.value !== "popular")

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

      <CaricatureFilterSection title="Sort by" defaultOpen>
        <div className="overflow-hidden border border-border">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled || (option.value === "relevance" && !params.q)}
              onClick={() => onUpdate({ sort: option.value, page: 1 })}
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
      </CaricatureFilterSection>

      {categoryItems.length > 0 ? (
        <CaricatureFilterSection title="Category" defaultOpen>
          <CaricatureFilterSelectList
            items={categoryItems}
            activeId={activeCategoryId ?? params.categoryId}
            onSelect={(id) => {
              const currentId = activeCategoryId ?? params.categoryId
              onUpdate({ categoryId: id === currentId ? undefined : id, page: 1 })
            }}
          />
        </CaricatureFilterSection>
      ) : null}

      {languageItems.length > 0 ? (
        <CaricatureFilterSection title="Language" defaultOpen>
          <CaricatureFilterSelectList
            items={languageItems}
            activeId={params.language}
            onSelect={(id) => onUpdate({ language: id === params.language ? undefined : id, page: 1 })}
          />
        </CaricatureFilterSection>
      ) : null}

      <CaricatureFilterSection title="Visible text" defaultOpen>
        <div className="overflow-hidden border border-border">
          {VISIBLE_TEXT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onUpdate({
                hasVisibleText: option.value === "any"
                  ? undefined
                  : option.value === "true",
                page: 1,
              })}
              className={cn(
                "flex h-12 w-full items-center gap-3 border-b border-border px-4 text-left text-sm transition-colors last:border-b-0 disabled:cursor-not-allowed disabled:opacity-45",
                visibleTextValue === option.value ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted",
              )}
            >
              <span className={cn("h-4 w-4 rounded-full border-2", visibleTextValue === option.value ? "border-primary-foreground bg-primary-foreground shadow-[inset_0_0_0_3px_var(--primary)]" : "border-border-strong")} />
              {option.label}
            </button>
          ))}
        </div>
      </CaricatureFilterSection>

      {depictedSubjectItems.length > 0 ? (
        <CaricatureFilterSection title="Depicted subjects" defaultOpen={false}>
          <CaricatureFilterSearchList
            items={depictedSubjectItems}
            activeId={params.depictedSubject}
            searchPlaceholder="Search subjects"
            onSelect={(id) => onUpdate({ depictedSubject: id === params.depictedSubject ? undefined : id, page: 1 })}
          />
        </CaricatureFilterSection>
      ) : null}

      {creditItems.length > 0 ? (
        <CaricatureFilterSection title="Credit / Artist" defaultOpen={false}>
          <CaricatureFilterSearchList
            items={creditItems}
            activeId={params.credit}
            searchPlaceholder="Search credit / artist"
            onSelect={(id) => onUpdate({ credit: id === params.credit ? undefined : id, page: 1 })}
          />
        </CaricatureFilterSection>
      ) : null}
    </aside>
  )
}

function CaricatureFilterSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="border-b border-border p-4 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mb-3 flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <h2 className="text-base font-semibold uppercase tracking-wide text-foreground">{title}</h2>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? children : null}
    </section>
  )
}

function CaricatureFilterSelectList({
  items,
  activeId,
  onSelect,
}: {
  items: CaricatureFilterListItem[]
  activeId?: string
  onSelect: (id: string) => void
}) {
  return (
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
          <span className="min-w-0 truncate font-medium">{item.label}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatInteger(item.count)}</span>
        </button>
      ))}
    </div>
  )
}

function CaricatureFilterSearchList({
  items,
  activeId,
  searchPlaceholder,
  onSelect,
}: {
  items: CaricatureFilterListItem[]
  activeId?: string
  searchPlaceholder: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(false)

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) => item.label.toLowerCase().includes(normalized))
  }, [items, query])

  const visibleItems = expanded ? filteredItems : filteredItems.slice(0, SEARCH_LIST_PREVIEW_COUNT)
  const canExpand = filteredItems.length > SEARCH_LIST_PREVIEW_COUNT

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setExpanded(false)
        }}
        placeholder={searchPlaceholder}
        className="h-10 w-full border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
      />
      {visibleItems.length > 0 ? (
        <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex w-full items-start justify-between gap-3 px-2 py-2 text-left text-sm transition-colors",
                activeId === item.id ? "bg-accent-wash text-foreground ring-1 ring-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="min-w-0 truncate font-medium">{item.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatInteger(item.count)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No matches.</p>
      )}
      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-xs font-medium text-muted-foreground underline underline-offset-4"
        >
          {expanded ? "Show less" : `Show more (${formatInteger(filteredItems.length - SEARCH_LIST_PREVIEW_COUNT)} more)`}
        </button>
      ) : null}
    </div>
  )
}
