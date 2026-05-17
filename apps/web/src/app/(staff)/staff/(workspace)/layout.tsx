import { StaffShell } from "@/components/staff/staff-shell"
import { assertStaffRouteAccess, requireStaff } from "@/lib/staff-session"

export default async function StaffWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()
  await assertStaffRouteAccess(staff.role)
  const initial = (staff.displayName || staff.username).trim().charAt(0).toUpperCase() || "S"

  return (
    <StaffShell
      staff={{
        displayName: staff.displayName,
        username: staff.username,
        role: staff.role,
        userInitial: initial,
      }}
    >
      {children}
    </StaffShell>
  )
}
