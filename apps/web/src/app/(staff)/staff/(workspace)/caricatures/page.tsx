import { AlertTriangle } from "lucide-react"

import { StaffCaricaturesClient } from "@/components/staff/caricatures/staff-caricatures-client"
import { EmptyState } from "@/components/shared/empty-state"
import { listStaffCaricatures } from "@/lib/api/staff-caricatures-api"

interface StaffCaricaturesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = {
  title: "Caricatures — Fotocorp Staff",
}

export default async function StaffCaricaturesPage({ searchParams }: StaffCaricaturesPageProps) {
  const params = await searchParams
  const status = typeof params.status === "string" && params.status.trim() ? params.status.trim() : "PENDING_REVIEW"
  const q = typeof params.q === "string" ? params.q.trim() : ""

  let response = null
  try {
    response = await listStaffCaricatures({
      status: status === "all" ? undefined : status,
      q: q || undefined,
      page: 1,
      limit: 50,
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "staff_caricatures_page_data_call_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    )
  }

  if (!response) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load caricatures"
        description="The caricature review list request failed."
      />
    )
  }

  return (
    <StaffCaricaturesClient
      initialResponse={response}
      currentStatus={status}
      currentQuery={q}
    />
  )
}
