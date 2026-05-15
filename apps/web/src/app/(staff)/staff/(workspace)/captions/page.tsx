import { AlertTriangle } from "lucide-react"
import { getAdminCatalogFilters, listAdminCatalogAssets } from "@/lib/api/admin-catalog-api"
import { EmptyState } from "@/components/shared/empty-state"
import { StaffCaptionsClient } from "./staff-captions-client"

interface StaffCaptionsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = {
  title: "Caption Queue — Fotocorp Staff",
}

export default async function StaffCaptionsPage({ searchParams }: StaffCaptionsPageProps) {
  const params = await searchParams
  
  // Create search params for catalog API
  const query = new URLSearchParams()
  
  // Set defaults if nothing specified (default to recent updates or just normal list)
  query.set("limit", "100")
  query.set("sort", typeof params.sort === "string" ? params.sort : "newest")

  if (typeof params.missingTitle === "string") query.set("missingTitle", params.missingTitle)
  if (typeof params.missingCaption === "string") query.set("missingCaption", params.missingCaption)
  if (typeof params.noEvent === "string") query.set("noEvent", params.noEvent)
  if (typeof params.noCategory === "string") query.set("noCategory", params.noCategory)
  if (typeof params.eventId === "string") query.set("eventId", params.eventId)
  if (typeof params.categoryId === "string") query.set("categoryId", params.categoryId)
  if (typeof params.cursor === "string") query.set("cursor", params.cursor)

  const [assetsResponse, filtersResponse] = await Promise.all([
    listAdminCatalogAssets(query).catch(() => null),
    getAdminCatalogFilters().catch(() => null),
  ])

  if (!assetsResponse || !filtersResponse) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load caption queue"
        description="Internal admin catalog service is unavailable."
      />
    )
  }

  return (
    <StaffCaptionsClient 
      initialAssets={assetsResponse} 
      filters={filtersResponse} 
    />
  )
}
