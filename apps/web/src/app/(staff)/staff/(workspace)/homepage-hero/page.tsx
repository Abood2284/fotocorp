import { AlertTriangle } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { SearchFiltersProvider } from "@/components/search/search-filters-context"
import { StaffHomepageHeroClient } from "@/components/staff/homepage-hero/staff-homepage-hero-client"
import { getHomepageHeroPool } from "@/lib/api/admin-homepage-hero-api"
import { requireStaffRole } from "@/lib/staff-session"

export const metadata = {
  title: "Homepage Hero — Fotocorp Staff",
}

export default async function StaffHomepageHeroPage() {
  await requireStaffRole(["SUPER_ADMIN", "CATALOG_MANAGER"])

  const pool = await getHomepageHeroPool().catch(() => null)
  if (!pool) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load homepage hero pool"
        description="Internal admin homepage hero request failed."
      />
    )
  }

  return (
    <SearchFiltersProvider>
      <StaffHomepageHeroClient initialPool={pool} />
    </SearchFiltersProvider>
  )
}
