"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

const CUSTOMER_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "IN_REVIEW", label: "In review" },
  { id: "ACCESS_GRANTED", label: "Access granted" },
  { id: "CLOSED", label: "Closed" },
] as const

const CONTRIBUTOR_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "CONTRIBUTOR_APPROVED", label: "Approved" },
  { id: "CLOSED", label: "Closed" },
] as const

function buildHref(type: string, status: string) {
  const params = new URLSearchParams()
  params.set("type", type)
  if (status !== "ALL") params.set("status", status)
  return `/staff/access-inquiries?${params.toString()}`
}

export function AccessInquiriesFilters() {
  const searchParams = useSearchParams()
  const type = searchParams.get("type") === "CONTRIBUTOR_APPLICATION" ? "CONTRIBUTOR_APPLICATION" : "USER_ACCESS"
  const activeStatus = searchParams.get("status")?.toUpperCase() ?? "ALL"
  const filters = type === "CONTRIBUTOR_APPLICATION" ? CONTRIBUTOR_FILTERS : CUSTOMER_FILTERS

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
      {filters.map((filter) => {
        const isActive = activeStatus === filter.id || (filter.id === "ALL" && !searchParams.get("status"))
        return (
          <Link
            key={filter.id}
            href={buildHref(type, filter.id)}
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
  )
}
