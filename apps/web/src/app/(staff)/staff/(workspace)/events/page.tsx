import { AlertTriangle } from "lucide-react"
import { listAdminEvents } from "@/lib/api/admin-events-api"
import { EmptyState } from "@/components/shared/empty-state"
import { StaffEventsClient } from "@/components/staff/events/staff-events-client"

interface StaffEventsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = {
  title: "Events — Fotocorp Staff",
}

export default async function StaffEventsPage({ searchParams }: StaffEventsPageProps) {
  const params = await searchParams
  const query = new URLSearchParams()
  
  if (typeof params.q === "string") query.set("q", params.q)
  if (typeof params.source === "string") query.set("source", params.source)
  if (typeof params.hasAssets === "string") query.set("hasAssets", params.hasAssets)
  if (typeof params.page === "string") query.set("page", params.page)

  const response = await listAdminEvents(query).catch(() => null)

  if (!response) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load events"
        description="Internal admin events service is unavailable."
      />
    )
  }

  return <StaffEventsClient initialData={response} />
}
