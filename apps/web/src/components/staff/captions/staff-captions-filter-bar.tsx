"use client"

import { useRouter, useSearchParams } from "next/navigation"
import type { AdminCatalogFilters } from "@/features/assets/admin-catalog-types"

export function StaffCaptionsFilterBar({ filters }: { filters: AdminCatalogFilters }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleToggle(key: string) {
    const sp = new URLSearchParams(searchParams)
    if (sp.get(key) === "true") {
      sp.delete(key)
    } else {
      sp.set(key, "true")
    }
    sp.delete("cursor")
    router.push(`/staff/captions?${sp.toString()}`)
  }

  function handleSelect(key: string, value: string) {
    const sp = new URLSearchParams(searchParams)
    if (value) {
      sp.set(key, value)
    } else {
      sp.delete(key)
    }
    sp.delete("cursor")
    router.push(`/staff/captions?${sp.toString()}`)
  }

  const isMissingTitle = searchParams.get("missingTitle") === "true"
  const isMissingCaption = searchParams.get("missingCaption") === "true"
  const isNoEvent = searchParams.get("noEvent") === "true"
  const isNoCategory = searchParams.get("noCategory") === "true"
  const sort = searchParams.get("sort") || "newest"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center space-x-1 border-r pr-2 mr-1">
        <button
          onClick={() => handleToggle("missingTitle")}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            isMissingTitle 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-background hover:bg-muted"
          }`}
        >
          No Title
        </button>
        <button
          onClick={() => handleToggle("missingCaption")}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            isMissingCaption 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-background hover:bg-muted"
          }`}
        >
          No Caption
        </button>
        <button
          onClick={() => handleToggle("noEvent")}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            isNoEvent 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-background hover:bg-muted"
          }`}
        >
          No Event
        </button>
        <button
          onClick={() => handleToggle("noCategory")}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            isNoCategory 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-background hover:bg-muted"
          }`}
        >
          No Category
        </button>
      </div>

      <select
        value={sort}
        onChange={(e) => handleSelect("sort", e.target.value)}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="recentlyUpdated">Recently Updated</option>
      </select>

      <select
        value={searchParams.get("categoryId") || ""}
        onChange={(e) => handleSelect("categoryId", e.target.value)}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs max-w-[150px]"
      >
        <option value="">All Categories</option>
        {filters.categories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select
        value={searchParams.get("eventId") || ""}
        onChange={(e) => handleSelect("eventId", e.target.value)}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs max-w-[150px]"
      >
        <option value="">All Events</option>
        {filters.events.map(e => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
    </div>
  )
}
