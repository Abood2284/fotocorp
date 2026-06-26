import Link from "next/link"
import { buildStaffHelpHref, type HelpTagSummary } from "@/lib/api/staff-help-api"
import { cn } from "@/lib/utils"

interface HelpTagFilterProps {
  tags: HelpTagSummary[]
  activeTag?: string
  query?: string
  category?: string
}

export function HelpTagFilter({ tags, activeTag, query, category }: HelpTagFilterProps) {
  if (!tags.length) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = activeTag === tag.slug
          return (
            <Link
              key={tag.id}
              href={
                active
                  ? buildStaffHelpHref({ q: query, category })
                  : buildStaffHelpHref({ q: query, category, tag: tag.slug })
              }
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex rounded-none border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary-wash text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              {tag.name}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
