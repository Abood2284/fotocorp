import Link from "next/link"
import { buildStaffHelpHref, type HelpCategorySummary } from "@/lib/api/staff-help-api"
import { cn } from "@/lib/utils"

interface HelpCategoryFilterProps {
  categories: HelpCategorySummary[]
  activeCategory?: string
  query?: string
  activeTag?: string
  layout?: "sidebar" | "chips"
}

export function HelpCategoryFilter({
  categories,
  activeCategory,
  query,
  activeTag,
  layout = "sidebar",
}: HelpCategoryFilterProps) {
  if (layout === "chips") {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Help categories">
        <CategoryChip
          label="All"
          href={buildStaffHelpHref({ q: query, tag: activeTag })}
          active={!activeCategory}
          count={null}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            label={category.name}
            href={buildStaffHelpHref({ q: query, category: category.slug, tag: activeTag })}
            active={activeCategory === category.slug}
            count={category.articleCount}
          />
        ))}
      </div>
    )
  }

  return (
    <nav className="hidden lg:block" aria-label="Help categories">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</p>
      <ul className="space-y-1">
        <li>
          <CategoryLink
            href={buildStaffHelpHref({ q: query, tag: activeTag })}
            active={!activeCategory}
            name="All categories"
            count={null}
          />
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <CategoryLink
              href={buildStaffHelpHref({ q: query, category: category.slug, tag: activeTag })}
              active={activeCategory === category.slug}
              name={category.name}
              count={category.articleCount}
              subdued={category.articleCount === 0}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function CategoryLink({
  href,
  active,
  name,
  count,
  subdued = false,
}: {
  href: string
  active: boolean
  name: string
  count: number | null
  subdued?: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-muted/60",
        subdued && !active && "text-muted-foreground",
      )}
    >
      <span>{name}</span>
      {count !== null ? (
        <span className={cn("text-xs tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {count}
        </span>
      ) : null}
    </Link>
  )
}

function CategoryChip({
  label,
  href,
  active,
  count,
}: {
  label: string
  href: string
  active: boolean
  count: number | null
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-none border px-3 py-1.5 text-sm whitespace-nowrap",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted/50",
      )}
    >
      <span>{label}</span>
      {count !== null ? <span className="text-xs opacity-80">{count}</span> : null}
    </Link>
  )
}
