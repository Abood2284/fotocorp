
import { AlertTriangle } from "lucide-react"
import { listAdminAssets } from "@/lib/api/admin-assets-api"
import { EmptyState } from "@/components/shared/empty-state"
import { StaffCatalogClient } from "@/components/staff/catalog/staff-catalog-client"
import type { AdminCatalogAssetsResponse, AdminCatalogFilters } from "@/features/assets/admin-catalog-types"
import {
  hasActiveCatalogFilters,
  listAllFilteredAdminCatalogAssets,
} from "@/lib/server/staff-catalog-list"

interface StaffCatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = {
  title: "Catalog — Fotocorp Staff",
}

export default async function StaffCatalogPage({ searchParams }: StaffCatalogPageProps) {
  const params = await searchParams
  const query = toQueryParams(params)
  const filtersActive = hasActiveCatalogFilters(query)

  let response: AdminCatalogAssetsResponse | null = null
  try {
    response = await timeStaffCatalogPageCall(
      filtersActive ? "listAllFilteredAdminCatalogAssets" : "listAdminAssets",
      () => (filtersActive ? listAllFilteredAdminCatalogAssets(query) : listAdminAssets(query)),
    )
  } catch (error) {
    console.error(JSON.stringify({
      event: "staff_catalog_page_data_call_failed",
      operation: "listAdminAssets",
      route: "/staff/catalog",
      message: error instanceof Error ? error.message : String(error),
    }))
  }

  if (!response) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load catalog"
        description="The asset list request failed."
      />
    )
  }

  return (
    <StaffCatalogClient
      initialResponse={response}
      filters={fallbackFilters}
      filtersDeferred
      filtersActive={filtersActive}
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

async function timeStaffCatalogPageCall<T>(operation: string, callback: () => Promise<T>) {
  const startedAt = Date.now()
  try {
    const result = await callback()
    console.info(JSON.stringify({
      event: "staff_catalog_page_data_call",
      operation,
      route: "/staff/catalog",
      status: "ok",
      durationMs: Date.now() - startedAt,
    }))
    return result
  } catch (error) {
    console.error(JSON.stringify({
      event: "staff_catalog_page_data_call",
      operation,
      route: "/staff/catalog",
      status: "error",
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
    }))
    throw error
  }
}

const fallbackFilters: AdminCatalogFilters = {
  statuses: [
    { status: "DRAFT", assetCount: 0 },
    { status: "SUBMITTED", assetCount: 0 },
    { status: "APPROVED", assetCount: 0 },
    { status: "ACTIVE", assetCount: 0 },
    { status: "ARCHIVED", assetCount: 0 },
    { status: "DELETED", assetCount: 0 },
    { status: "MISSING_ORIGINAL", assetCount: 0 },
    { status: "UNKNOWN", assetCount: 0 },
  ],
  categories: [],
  events: [],
  contributors: [],
}
