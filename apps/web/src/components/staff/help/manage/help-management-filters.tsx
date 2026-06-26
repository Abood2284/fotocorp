"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import type { HelpCategoryManageSummary, HelpTagSummary } from "@/lib/api/staff-help-api"
import { buildStaffHelpManageHref } from "@/lib/staff/help-form"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
] as const

interface HelpManagementFiltersProps {
  query?: string
  status?: string
  category?: string
  tag?: string
  categories: HelpCategoryManageSummary[]
  tags: HelpTagSummary[]
}

export function HelpManagementFilters({
  query = "",
  status = "",
  category = "",
  tag = "",
  categories,
  tags,
}: HelpManagementFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function navigate(next: { q?: string; status?: string; category?: string; tag?: string }) {
    startTransition(() => {
      router.push(
        buildStaffHelpManageHref({
          q: next.q ?? query,
          status: next.status ?? status,
          category: next.category ?? category,
          tag: next.tag ?? tag,
        }),
      )
    })
  }

  return (
    <div className={cn("space-y-4", isPending && "opacity-70")}>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          const formData = new FormData(event.currentTarget)
          navigate({ q: String(formData.get("q") ?? "") })
        }}
      >
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search articles by title or summary"
          aria-label="Search help articles"
          className="flex-1"
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value
          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
              onClick={() => navigate({ status: tab.value })}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Category</span>
          <select
            value={category}
            onChange={(event) => navigate({ category: event.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
                {!item.isActive ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Tag</span>
          <select
            value={tag}
            onChange={(event) => navigate({ tag: event.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            aria-label="Filter by tag"
          >
            <option value="">All tags</option>
            {tags.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
