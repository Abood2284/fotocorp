"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

const TABS = [
  { id: "USER_ACCESS", label: "Customer access" },
  { id: "CONTRIBUTOR_APPLICATION", label: "Contributor applications" },
] as const

function tabHref(type: string, status: string | null) {
  const params = new URLSearchParams()
  params.set("type", type)
  if (status) params.set("status", status)
  return `/staff/access-inquiries?${params.toString()}`
}

export function AccessInquiriesTabs() {
  const searchParams = useSearchParams()
  const active = searchParams.get("type") === "CONTRIBUTOR_APPLICATION" ? "CONTRIBUTOR_APPLICATION" : "USER_ACCESS"
  const status = searchParams.get("status")

  return (
    <nav className="flex flex-wrap gap-2 border-b border-border pb-3" aria-label="Inquiry type">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tabHref(tab.id, status)}
          className={
            active === tab.id
              ? "rounded-none border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background"
              : "rounded-none border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
