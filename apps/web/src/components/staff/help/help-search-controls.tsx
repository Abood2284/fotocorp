"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { buildStaffHelpHref } from "@/lib/api/staff-help-api"
import { cn } from "@/lib/utils"

interface HelpSearchControlsProps {
  initialQuery: string
  category?: string
  tag?: string
}

export function HelpSearchControls({ initialQuery, category, tag }: HelpSearchControlsProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === initialQuery.trim()) return

    const handle = window.setTimeout(() => {
      startTransition(() => {
        router.replace(buildStaffHelpHref({ q: trimmed, category, tag }))
      })
    }, 350)

    return () => window.clearTimeout(handle)
  }, [query, initialQuery, category, tag, router])

  function clearFilters() {
    setQuery("")
    startTransition(() => {
      router.replace("/staff/help")
    })
  }

  const hasFilters = Boolean(initialQuery.trim() || category || tag)

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor="help-search" className="sr-only">
          Search help articles
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="help-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search help articles, workflows, tags..."
          className={cn("h-11 pl-10 pr-4", isPending && "opacity-80")}
        />
      </div>

      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          {initialQuery.trim() ? (
            <FilterChip label={`Search: ${initialQuery.trim()}`} href={buildStaffHelpHref({ category, tag })} />
          ) : null}
          {category ? (
            <FilterChip label={`Category: ${category}`} href={buildStaffHelpHref({ q: initialQuery, tag })} />
          ) : null}
          {tag ? <FilterChip label={`Tag: ${tag}`} href={buildStaffHelpHref({ q: initialQuery, category })} /> : null}
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function FilterChip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-none border border-border bg-muted/40 px-2 py-1 text-xs text-foreground hover:bg-muted"
    >
      <span>{label}</span>
      <X className="h-3 w-3 text-muted-foreground" aria-hidden />
      <span className="sr-only">Remove filter</span>
    </Link>
  )
}
