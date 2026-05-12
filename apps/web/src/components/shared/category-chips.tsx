import Link from "next/link"
import { cn } from "@/lib/utils"
import type { Category } from "@/types"

interface CategoryChipsProps {
  categories: Category[]
  activeSlug?: string
  className?: string
}

export function CategoryChips({ categories, activeSlug, className }: CategoryChipsProps) {
  return (
    <div
      className={cn("flex gap-2 overflow-x-auto pb-1 scrollbar-none", className)}
      role="list"
      aria-label="Browse by category"
    >
      {categories.map((cat) => {
        const isActive = cat.slug === activeSlug
        return (
          <Link
            key={cat.id}
            href={cat.slug === "all" ? "/search" : `/search?category=${cat.slug}`}
            role="listitem"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted",
            )}
          >
            {cat.icon && <span aria-hidden>{cat.icon}</span>}
            {cat.label}
          </Link>
        )
      })}
    </div>
  )
}
