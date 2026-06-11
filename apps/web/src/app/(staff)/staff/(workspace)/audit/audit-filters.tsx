"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

const SOURCE_FILTERS = [
  { id: "ALL", label: "All sources" },
  { id: "staff", label: "Staff ops" },
  { id: "asset", label: "Asset editorial" },
  { id: "user", label: "User admin" },
] as const

function buildHref(source: string, action: string | null) {
  const params = new URLSearchParams()
  if (source !== "ALL") params.set("source", source)
  if (action) params.set("action", action)
  const query = params.toString()
  return query ? `/staff/audit?${query}` : "/staff/audit"
}

export function AuditFilters() {
  const searchParams = useSearchParams()
  const activeSource = searchParams.get("source") ?? "ALL"
  const action = searchParams.get("action") ?? ""

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by source">
        {SOURCE_FILTERS.map((filter) => {
          const isActive = activeSource === filter.id || (filter.id === "ALL" && !searchParams.get("source"))
          return (
            <Link
              key={filter.id}
              href={buildHref(filter.id === "ALL" ? "ALL" : filter.id, action || null)}
              className={
                isActive
                  ? "rounded-none border border-foreground bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                  : "rounded-none border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {filter.label}
            </Link>
          )
        })}
      </div>
      <form action="/staff/audit" method="get" className="flex items-center gap-2">
        {activeSource !== "ALL" ? <input type="hidden" name="source" value={activeSource} /> : null}
        <input
          name="action"
          defaultValue={action}
          placeholder="Filter by action..."
          className="h-8 w-full min-w-[12rem] rounded-none border border-border bg-background px-2 text-xs sm:w-56"
        />
        <button
          type="submit"
          className="rounded-none border border-foreground bg-foreground px-3 py-1.5 text-xs font-medium text-background"
        >
          Apply
        </button>
      </form>
    </div>
  )
}
