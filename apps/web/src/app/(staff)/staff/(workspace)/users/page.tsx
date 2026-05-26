import { AlertTriangle } from "lucide-react"
import type { AdminCatalogUsersResponse } from "@/features/assets/admin-catalog-types"
import { listInternalAdminUsers } from "@/lib/api/admin-assets-api"
import { EmptyState } from "@/components/shared/empty-state"
import { StaffUsersClient } from "@/components/staff/users/staff-users-client"

interface AdminUsersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = {
  title: "Users — Fotocorp Staff",
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams
  const query = toQueryParams(params)

  const response = await listInternalAdminUsers(query).catch(() => null)

  if (!response) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load users"
        description="Internal admin users request failed."
      />
    )
  }

  return (
    <StaffUsersClient
      initialResponse={response}
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
