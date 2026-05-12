"use client"

import { Grid2X2, List, SlidersHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AssetSort, AssetViewMode } from "@/features/assets/filter-utils"

const SORT_OPTIONS: Array<{ label: string; value: AssetSort }> = [
  { label: "Relevance", value: "relevance" },
  { label: "Newest", value: "newest" },
  { label: "Popular", value: "popular" },
  { label: "Title", value: "title" },
]

interface SearchToolbarProps {
  total: number
  sourceLabel?: string
  sort: AssetSort
  onSortChange: (sort: AssetSort) => void
  viewMode: AssetViewMode
  onViewModeChange: (viewMode: AssetViewMode) => void
  onMobileFilterOpen: () => void
}

export function SearchToolbar({
  total,
  sourceLabel = "live catalog",
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  onMobileFilterOpen,
}: SearchToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-0">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{total.toLocaleString()}</span> results
      </p>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="md:hidden"
          onClick={onMobileFilterOpen}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </Button>

        <label className="sr-only" htmlFor="search-sort">
          Sort results
        </label>
        <select
          id="search-sort"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as AssetSort)}
          className="h-8 rounded-md border border-border/70 bg-background/80 px-2.5 text-xs font-medium"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="hidden items-center rounded-md border border-border/70 bg-background/80 p-0.5 sm:flex">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`rounded p-1.5 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="Grid view"
          >
            <Grid2X2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`rounded p-1.5 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
