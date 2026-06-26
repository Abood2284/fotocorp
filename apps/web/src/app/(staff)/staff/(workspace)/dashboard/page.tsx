import Link from "next/link"
import { Suspense } from "react"
import { ArrowRight, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StaffHelpHint } from "@/components/staff/staff-help-hint"
import { getAdminDashboardSummary } from "@/lib/api/staff-dashboard-api"
import { STAFF_ACCESS_INQUIRIES_HREF, staffNavItemsForRole } from "@/lib/staff/staff-navigation"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"
import { STAFF_HELP } from "@/lib/staff/staff-help-content"
import { requireStaff } from "@/lib/staff-session"
import { DashboardStats, DashboardStatsSkeleton } from "./dashboard-stats"

export const metadata = {
  title: "Staff Dashboard — Fotocorp",
}

export default async function StaffDashboardPage() {
  const staff = await requireStaff()
  const modules = staffNavItemsForRole(staff.role).filter((item) => item.href !== "/staff/dashboard")

  let summary: Awaited<ReturnType<typeof getAdminDashboardSummary>> | null = null
  try {
    summary = await getAdminDashboardSummary()
  } catch {
    summary = null
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="inline-flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-staff-950">
            Dashboard
            <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {formatStaffRole(staff.role)}
            </Badge>
            <StaffHelpHint label="Dashboard help" body={STAFF_HELP.dashboardIntro} />
          </h2>
          <p className="mt-1.5 text-sm text-staff-500">Operational view for your role.</p>
        </div>
        {staffRoleCanAccessPath(staff.role, "/staff/contributor-uploads/new") ? (
          <Link
            href="/staff/contributor-uploads/new"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-staff-200 bg-white px-4 text-sm font-medium text-staff-900 shadow-sm transition-all hover:bg-staff-50 hover:text-staff-950 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1 focus:ring-offset-staff-50"
          >
            <Upload className="h-4 w-4 shrink-0 text-staff-500" aria-hidden />
            New upload
          </Link>
        ) : null}
      </div>

      <Suspense fallback={<DashboardStatsSkeleton />}>
        <DashboardStats role={staff.role} />
      </Suspense>

      {modules.length === 0 ? (
        <Card className="border-staff-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-staff-900">Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-staff-500">No workspace modules are assigned to your role yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-medium tracking-tight text-staff-900">Staff modules</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col justify-between rounded-xl border border-staff-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-staff-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1 focus:ring-offset-staff-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-wash text-primary-muted transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-staff-900">{label}</span>
                      {resolveModuleBadge({ href, role: staff.role, summary })}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-staff-100 pt-3">
                  <span className="text-xs font-medium text-staff-500 transition-colors group-hover:text-staff-950">
                    Access module
                  </span>
                  <ArrowRight className="h-4 w-4 text-staff-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-staff-950" aria-hidden />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatStaffRole(role: string) {
  return role.replaceAll("_", " ")
}

function resolveModuleBadge({
  href,
  role,
  summary,
}: {
  href: string
  role: string
  summary: Awaited<ReturnType<typeof getAdminDashboardSummary>> | null
}) {
  if (!summary) return null

  if (href === "/staff/contributor-uploads" && summary.pendingContributorUploads > 0) {
    return (
      <Badge variant="warning" className="rounded-md px-1.5 py-0 text-[10px]">
        {summary.pendingContributorUploads.toLocaleString()} pending
      </Badge>
    )
  }

  if (href === "/staff/caricatures" && role === "SUPER_ADMIN") {
    return (
      <Badge variant="success" className="rounded-md px-1.5 py-0 text-[10px]">
        NEW
      </Badge>
    )
  }

  if (href === STAFF_ACCESS_INQUIRIES_HREF) {
    const openCount = summary.pendingUserAccessInquiries + summary.pendingContributorApplications
    if (openCount <= 0) return null
    return (
      <Badge variant="warning" className="rounded-md px-1.5 py-0 text-[10px]">
        {openCount.toLocaleString()} open
      </Badge>
    )
  }

  return null
}
