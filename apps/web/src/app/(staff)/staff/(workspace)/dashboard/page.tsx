import Link from "next/link"
import { ArrowRight, AlertTriangle, Upload, CheckCircle2, Users } from "lucide-react"
import { getAdminAssetStats, listInternalAdminUsers } from "@/lib/api/admin-assets-api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { staffNavItemsForRole } from "@/lib/staff/staff-navigation"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"
import { requireStaff } from "@/lib/staff-session"
import { cn } from "@/lib/utils"
import { DashboardChart } from "./dashboard-chart"

export const metadata = {
  title: "Staff Dashboard — Fotocorp",
}

export default async function StaffDashboardPage() {
  const staff = await requireStaff()
  const [stats, usersRes] = await Promise.all([
    getAdminAssetStats().catch(() => null),
    listInternalAdminUsers(new URLSearchParams({ limit: "1000" })).catch(() => null)
  ])

  const modules = staffNavItemsForRole(staff.role).filter((item) => item.href !== "/staff/dashboard")

  if (!stats) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load dashboard"
        description="Internal staff assets API request failed."
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-staff-950">Dashboard</h2>
          <p className="mt-1.5 text-sm text-staff-500">
            Operational snapshot for assets, previews, and ingestion coverage.
          </p>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total assets"
          value={stats.totalAssets.toLocaleString()}
          hint="All imported rows"
        />
        <StatCard
          label="Approved public"
          value={stats.approvedPublicAssets.toLocaleString()}
          hint="Publicly visible assets"
          status={stats.approvedPublicAssets > 0 ? "success" : undefined}
        />
        <StatCard
          label="Total Users"
          value={usersRes?.items?.length?.toLocaleString() ?? "0"}
          hint="Registered admin/staff users"
          icon={Users}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-staff-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-staff-900">Asset Overview</CardTitle>
            <CardDescription className="text-sm text-staff-500">Comparison of total imported vs approved assets.</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardChart
              total={stats.totalAssets}
              approved={stats.approvedPublicAssets}
            />
          </CardContent>
        </Card>
      </div>

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
          <h3 className="text-lg font-medium tracking-tight text-staff-900">Staff Modules</h3>
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
                  <span className="text-sm font-semibold text-staff-900">{label}</span>
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

function StatCard({ label, value, hint, status, icon: CustomIcon }: { label: string; value: string; hint: string; status?: "success" | "warning" | "error", icon?: any }) {
  const statusColor = status === "error" ? "text-red-600" : status === "warning" ? "text-yellow-600" : status === "success" ? "text-emerald-600" : "text-staff-950";
  const iconBg = status === "error" ? "bg-red-50 text-red-600" : status === "warning" ? "bg-yellow-50 text-yellow-600" : status === "success" ? "bg-emerald-50 text-emerald-600" : "bg-primary-wash text-primary-muted";

  return (
    <Card className="overflow-hidden border-staff-200 shadow-sm transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-staff-500">{label}</CardTitle>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", iconBg)}>
          {CustomIcon ? (
            <CustomIcon className="h-4 w-4" />
          ) : status === "error" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : status === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-current" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className={cn("text-3xl font-bold tracking-tight", statusColor)}>{value}</p>
        <p className="mt-1.5 text-xs font-medium text-staff-400">{hint}</p>
      </CardContent>
    </Card>
  )
}
