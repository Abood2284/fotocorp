import { AlertTriangle } from "lucide-react"
import { getAdminAssetFilters, getAdminAssetStats, listAdminAssets } from "@/lib/api/admin-assets-api"
import { EmptyState } from "@/components/shared/empty-state"
import { StaffCatalogClient } from "@/components/staff/catalog/staff-catalog-client"

interface StaffCatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = {
  title: "Catalog — Fotocorp Staff",
}

export default async function StaffCatalogPage({ searchParams }: StaffCatalogPageProps) {
  const params = await searchParams
  const query = toQueryParams(params)

  const [filters, response, stats] = await Promise.all([
    getAdminAssetFilters().catch(() => null),
    listAdminAssets(query).catch(() => null),
    getAdminAssetStats().catch(() => null),
  ])

  if (!filters || !response || !stats) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load catalog"
        description="Internal admin catalog request failed."
      />
    )
  }

  return (
    <StaffCatalogClient
      initialResponse={response}
      filters={filters}
      stats={stats}
      initialQuery={Object.fromEntries(query.entries())}
    />
  )
}

function toQueryParams(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.trim()) {
      query.set(key, value)
    }
  }
  if (!query.has("limit")) query.set("limit", "50")
  return query
}
