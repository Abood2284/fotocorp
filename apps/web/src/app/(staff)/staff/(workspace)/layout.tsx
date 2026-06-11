import { StaffShell } from "@/components/staff/staff-shell"
import { StaffProviders } from "@/components/staff/staff-providers"
import { getAdminDashboardSummary } from "@/lib/api/staff-dashboard-api"
import { assertStaffRouteAccess, requireStaff } from "@/lib/staff-session"

export default async function StaffWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()
  await assertStaffRouteAccess(staff.role)
  const initial = (staff.displayName || staff.username).trim().charAt(0).toUpperCase() || "S"

  let pendingInquiriesCount = 0
  try {
    const summary = await getAdminDashboardSummary()
    pendingInquiriesCount =
      summary.pendingUserAccessInquiries + summary.pendingContributorApplications
  } catch {
    pendingInquiriesCount = 0
  }

  return (
    <StaffShell
      staff={{
        displayName: staff.displayName,
        username: staff.username,
        role: staff.role,
        userInitial: initial,
      }}
      pendingInquiriesCount={pendingInquiriesCount}
    >
      <StaffProviders>{children}</StaffProviders>
    </StaffShell>
  )
}
