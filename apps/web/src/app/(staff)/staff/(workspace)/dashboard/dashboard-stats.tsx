import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { AlertTriangle, CheckCircle2, ClipboardList, Users, UserPlus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StaffHelpHint } from "@/components/staff/staff-help-hint"
import { getAdminDashboardSummary } from "@/lib/api/staff-dashboard-api"
import { STAFF_HELP } from "@/lib/staff/staff-help-content"
import {
  getDashboardPendingAccessHelp,
  getDashboardPendingContributorHelp,
} from "@/lib/staff/access-inquiry-guidance"
import { cn } from "@/lib/utils"
import { DashboardChartLazy } from "./dashboard-chart-lazy"

export async function DashboardStats() {
  let summary: Awaited<ReturnType<typeof getAdminDashboardSummary>> | null = null
  let loadError = ""
  try {
    summary = await getAdminDashboardSummary()
  } catch (caught) {
    loadError = caught instanceof Error ? caught.message : "Unknown error"
    if (process.env.NODE_ENV === "development") {
      console.error("[staff-dashboard] summary fetch failed:", caught)
    }
  }

  if (!summary) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Unable to load dashboard metrics. Try refreshing the page.
        {process.env.NODE_ENV === "development" && loadError ? (
          <span className="mt-1 block font-mono text-xs opacity-80">{loadError}</span>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total assets"
          value={summary.totalAssets.toLocaleString()}
          hint="All imported rows"
          helpBody={STAFF_HELP.totalAssets}
        />
        <StatCard
          label="Approved public"
          value={summary.approvedPublicAssets.toLocaleString()}
          hint="Publicly visible"
          helpBody={STAFF_HELP.approvedPublic}
          status={summary.approvedPublicAssets > 0 ? "success" : undefined}
        />
        <StatCard
          label="Platform subscribers"
          value={summary.platformUsers.toLocaleString()}
          hint="Active customer accounts"
          helpBody={STAFF_HELP.platformUsers}
          icon={Users}
        />
        <StatCard
          label="Pending access requests"
          value={summary.pendingUserAccessInquiries.toLocaleString()}
          hint="Open row → entitlements"
          helpBody={getDashboardPendingAccessHelp(summary.pendingUserAccessInquiries)}
          icon={ClipboardList}
          href="/staff/access-inquiries"
          status={summary.pendingUserAccessInquiries > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Pending contributor apps"
          value={summary.pendingContributorApplications.toLocaleString()}
          hint="Open row → approve"
          helpBody={getDashboardPendingContributorHelp(summary.pendingContributorApplications)}
          icon={UserPlus}
          href="/staff/access-inquiries?type=CONTRIBUTOR_APPLICATION"
          status={summary.pendingContributorApplications > 0 ? "warning" : undefined}
        />
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Card className="min-w-0 border-staff-200 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="inline-flex items-center gap-1.5 text-base font-semibold text-staff-900">
                Asset overview
                <StaffHelpHint label="Asset chart help" body={STAFF_HELP.assetChart} />
              </CardTitle>
              <CardDescription className="text-sm text-staff-500">
                Total imported vs approved public assets.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
            <DashboardChartLazy total={summary.totalAssets} approved={summary.approvedPublicAssets} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  hint,
  helpBody,
  status,
  icon: CustomIcon,
  href,
}: {
  label: string
  value: string
  hint: string
  helpBody: string
  status?: "success" | "warning" | "error"
  icon?: LucideIcon
  href?: string
}) {
  const statusColor =
    status === "error"
      ? "text-red-600"
      : status === "warning"
        ? "text-amber-700"
        : status === "success"
          ? "text-emerald-600"
          : "text-staff-950"
  const iconBg =
    status === "error"
      ? "bg-red-50 text-red-600"
      : status === "warning"
        ? "bg-amber-50 text-amber-700"
        : status === "success"
          ? "bg-emerald-50 text-emerald-600"
          : "bg-primary-wash text-primary-muted"

  const inner = (
    <Card className="h-full overflow-hidden border-staff-200 shadow-sm transition-all duration-200 group-hover:border-staff-300 group-hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="inline-flex items-center gap-1 text-sm font-medium text-staff-500">
          {label}
          <StaffHelpHint label={`${label} help`} body={helpBody} />
        </CardTitle>
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

  if (!href) return inner
  return (
    <Link
      href={href}
      className="group block h-full cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
    >
      {inner}
    </Link>
  )
}

export function DashboardStatsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard metrics">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-[120px] animate-pulse rounded-xl border border-staff-200 bg-staff-50" />
        ))}
      </div>
      <div className="h-[320px] animate-pulse rounded-xl border border-staff-200 bg-staff-50" />
    </div>
  )
}
