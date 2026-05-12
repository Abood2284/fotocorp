"use client"

import type { Category } from "@/types"
import type { AssetOrientation } from "@/features/assets/filter-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ORIENTATIONS: Array<{ label: string; value: AssetOrientation }> = [
  { label: "All", value: "all" },
  { label: "Landscape", value: "landscape" },
  { label: "Portrait", value: "portrait" },
  { label: "Square", value: "square" },
]

interface FilterSidebarProps {
  categories: Category[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  selectedKeywords: string[]
  keywordOptions: string[]
  onKeywordToggle: (keyword: string) => void
  orientation: AssetOrientation
  onOrientationChange: (orientation: AssetOrientation) => void
  onReset: () => void
  className?: string
}

export function FilterSidebar({
  categories,
  selectedCategory,
  onCategoryChange,
  selectedKeywords,
  keywordOptions,
  onKeywordToggle,
  orientation,
  onOrientationChange,
  onReset,
  className,
}: FilterSidebarProps) {
  return (
    <aside className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between pb-1">
        <h2 className="font-medium text-sm text-foreground">Filters</h2>
        <button onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Reset
        </button>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">Category</h3>
        <div className="space-y-0.5">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.slug)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                selectedCategory === category.slug
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2 pt-2">
        <h3 className="text-xs font-medium text-muted-foreground">Orientation</h3>
        <div className="flex flex-wrap gap-1.5">
          {ORIENTATIONS.map((item) => (
            <button key={item.value} type="button" onClick={() => onOrientationChange(item.value)}>
              <Badge variant={item.value === orientation ? "default" : "secondary"} className="rounded-md px-2.5 py-0.5 font-normal text-xs">
                {item.label}
              </Badge>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2 pt-2">
        <h3 className="text-xs font-medium text-muted-foreground">Keywords</h3>
        <div className="flex flex-wrap gap-1.5">
          {keywordOptions.map((keyword, keywordIndex) => {
            const isActive = selectedKeywords.includes(keyword)
            return (
              <button key={`${keyword}-${keywordIndex}`} type="button" onClick={() => onKeywordToggle(keyword)}>
                <Badge variant={isActive ? "default" : "secondary"} className="capitalize rounded-md px-2.5 py-0.5 font-normal text-xs">
                  {keyword}
                </Badge>
              </button>
            )
          })}
        </div>
      </section>
    </aside>
  )
}
