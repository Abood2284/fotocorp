import { AlertTriangle } from "lucide-react"

import { StaffMembersClient } from "@/components/staff/staff-members/staff-members-client"
import { ContextualHelpPanel } from "@/components/staff/help/contextual-help-panel"
import { getStaffMembers, StaffApiError } from "@/lib/api/staff-api"
import { getStaffCookieHeader, requireStaffRole } from "@/lib/staff-session"

export const metadata = {
  title: "Staff Users — Fotocorp",
}

export default async function StaffUsersPage() {
  await requireStaffRole(["SUPER_ADMIN"])

  let items: Awaited<ReturnType<typeof getStaffMembers>>["items"] = []
  let loadError: string | null = null

  try {
    const response = await getStaffMembers({
      cookieHeader: await getStaffCookieHeader(),
      role: "CAPTION_WRITER",
    })
    items = response.items
  } catch (error) {
    loadError = error instanceof StaffApiError ? error.message : "Could not load caption writer accounts."
  }

  if (loadError) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{loadError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ContextualHelpPanel
        contextKey="staff.staff-management"
        cookieHeader={await getStaffCookieHeader()}
        compact
      />
      <StaffMembersClient initialItems={items} />
    </div>
  )
}
