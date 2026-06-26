import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { CheckCircle2, ClipboardList, ImageIcon, Inbox, PenLine, UserPlus, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StaffHelpHint } from "@/components/staff/staff-help-hint"
import { getAdminDashboardSummary } from "@/lib/api/staff-dashboard-api"
import { STAFF_HELP } from "@/lib/staff/staff-help-content"
import {
  getDashboardPendingAccessHelp,
  getDashboardPendingContributorHelp,
} from "@/lib/staff/access-inquiry-guidance"
import type { StaffRole } from "@/lib/staff/staff-route-access"
import { cn } from "@/lib/utils"

interface DashboardStatsProps {
  role: string
}

export async function DashboardStats({ role }: DashboardStatsProps) {
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

  const staffRole = role as StaffRole
  const actionCards = buildActionCards(summary, staffRole)
  const healthCards = buildHealthCards(summary, staffRole)

  return (
    <div className="space-y-8">
      {actionCards.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-medium tracking-tight text-staff-900">Needs attention</h3>
            <p className="mt-1 text-sm text-staff-500">Queues that need staff action right now.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {actionCards.map((card) => (
              <ActionQueueCard key={card.href} {...card} />
            ))}
          </div>
        </section>
      ) : null}

      {healthCards.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-medium tracking-tight text-staff-900">Platform health</h3>
            <p className="mt-1 text-sm text-staff-500">Read-only reference counts for your role.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {healthCards.map((card) => (
              <HealthStatCard key={card.label} {...card} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

interface ActionCardConfig {
  label: string
  count: number
  hint: string
  helpBody: string
  href: string
  icon: LucideIcon
}

interface HealthCardConfig {
  label: string
  value: string
  hint: string
  helpBody: string
  icon: LucideIcon
}

function buildActionCards(
  summary: Awaited<ReturnType<typeof getAdminDashboardSummary>>,
  role: StaffRole,
): ActionCardConfig[] {
  const cards: ActionCardConfig[] = []

  if (role === "SUPER_ADMIN") {
    cards.push(
      {
        label: "Contributor uploads",
        count: summary.pendingContributorUploads,
        hint: "Awaiting staff review",
        helpBody: STAFF_HELP.pendingContributorUploads,
        href: "/staff/contributor-uploads",
        icon: Inbox,
      },
      {
        label: "Caricatures in review",
        count: summary.pendingCaricatureReviews,
        hint: "Awaiting approval",
        helpBody: STAFF_HELP.pendingCaricatureReviews,
        href: "/staff/caricatures",
        icon: PenLine,
      },
      {
        label: "Contributor applications",
        count: summary.pendingContributorApplications,
        hint: "Applications pending review",
        helpBody: getDashboardPendingContributorHelp(summary.pendingContributorApplications),
        href: "/staff/access-inquiries?type=CONTRIBUTOR_APPLICATION",
        icon: UserPlus,
      },
    )
  }

  if (role === "SUPER_ADMIN" || role === "FINANCE" || role === "SUPPORT") {
    cards.push({
      label: "Open access requests",
      count: summary.pendingUserAccessInquiries,
      hint: "User access inquiries open",
      helpBody: getDashboardPendingAccessHelp(summary.pendingUserAccessInquiries),
      href: "/staff/access-inquiries",
      icon: ClipboardList,
    })
  }

  return cards
}

function buildHealthCards(
  summary: Awaited<ReturnType<typeof getAdminDashboardSummary>>,
  role: StaffRole,
): HealthCardConfig[] {
  const cards: HealthCardConfig[] = []

  if (role === "SUPER_ADMIN" || role === "CATALOG_MANAGER" || role === "REVIEWER") {
    cards.push({
      label: "Live in catalog",
      value: summary.liveImages.toLocaleString(),
      hint: "ACTIVE and PUBLIC images",
      helpBody: STAFF_HELP.liveImages,
      icon: ImageIcon,
    })
  }

  if (role === "SUPER_ADMIN" || role === "FINANCE") {
    cards.push({
      label: "Active subscribers",
      value: summary.activeSubscribers.toLocaleString(),
      hint: "Active customer accounts",
      helpBody: STAFF_HELP.activeSubscribers,
      icon: Users,
    })
  }

  return cards
}

function ActionQueueCard({ label, count, hint, helpBody, href, icon: Icon }: ActionCardConfig) {
  const badge = resolveQueueBadge(count)

  return (
    <Link
      href={href}
      className="group block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
    >
      <Card className="h-full overflow-hidden border-staff-200 shadow-sm transition-all duration-200 group-hover:border-staff-300 group-hover:shadow-md">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle className="inline-flex items-center gap-1 text-sm font-medium text-staff-500">
            {label}
            <StaffHelpHint label={`${label} help`} body={helpBody} />
          </CardTitle>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-wash text-primary-muted">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {badge ? (
              <Badge variant={badge.variant}>{badge.label}</Badge>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                All clear
              </span>
            )}
          </div>
          <p className="mt-3 text-xs font-medium text-staff-400">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function HealthStatCard({ label, value, hint, helpBody, icon: Icon }: HealthCardConfig) {
  return (
    <Card className="border-staff-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="inline-flex items-center gap-1 text-sm font-medium text-staff-500">
          {label}
          <StaffHelpHint label={`${label} help`} body={helpBody} />
        </CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-staff-100 text-staff-600">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-bold tracking-tight text-staff-950")}>{value}</p>
        <p className="mt-1.5 text-xs font-medium text-staff-400">{hint}</p>
      </CardContent>
    </Card>
  )
}

function resolveQueueBadge(count: number): { variant: "warning" | "destructive"; label: string } | null {
  if (count <= 0) return null
  if (count >= 10) {
    return { variant: "destructive", label: `${count.toLocaleString()} pending` }
  }
  return { variant: "warning", label: `${count.toLocaleString()} pending` }
}

export function DashboardStatsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard metrics">
      <div className="space-y-4">
        <div className="h-5 w-40 animate-pulse rounded bg-staff-100" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[132px] animate-pulse rounded-xl border border-staff-200 bg-staff-50" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-5 w-36 animate-pulse rounded bg-staff-100" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-[112px] animate-pulse rounded-xl border border-staff-200 bg-staff-50" />
          ))}
        </div>
      </div>
    </div>
  )
}
