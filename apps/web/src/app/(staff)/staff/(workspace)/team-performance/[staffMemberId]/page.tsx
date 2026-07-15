import { AlertTriangle, ChevronLeft, Download } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { EmptyState } from "@/components/shared/empty-state"
import { StaffProductivityActivityTable } from "@/components/staff/team-performance/staff-productivity-activity-table"
import { StaffProductivityCharts } from "@/components/staff/team-performance/staff-productivity-charts"
import {
  buildStaffProductivityExportHref,
  getStaffProductivityActivity,
  getStaffProductivityDetail,
  StaffApiError,
} from "@/lib/api/staff-api"
import { getStaffCookieHeader, requireStaffRole } from "@/lib/staff-session"

export const metadata = {
  title: "Staff performance detail — Fotocorp Staff",
}

interface PageProps {
  params: Promise<{ staffMemberId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StaffTeamPerformanceDetailPage({ params, searchParams }: PageProps) {
  await requireStaffRole(["SUPER_ADMIN"])

  const { staffMemberId } = await params
  const sp = await searchParams
  const fromDate = readDate(sp.from)
  const toDate = readDate(sp.to)
  const cursor = typeof sp.cursor === "string" ? sp.cursor.trim() : undefined
  const from = fromDate ? `${fromDate}T00:00:00.000Z` : undefined
  const to = toDate ? `${toDate}T23:59:59.999Z` : undefined
  const cookieHeader = await getStaffCookieHeader()

  let detail
  let activity
  try {
    ;[detail, activity] = await Promise.all([
      getStaffProductivityDetail(staffMemberId, { cookieHeader, from, to }),
      getStaffProductivityActivity(staffMemberId, { cookieHeader, from, to, limit: 50, cursor }),
    ])
  } catch (caught) {
    if (caught instanceof StaffApiError && caught.status === 404) notFound()
    if (!(caught instanceof StaffApiError)) throw caught
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load staff performance"
        description="The productivity detail service is unavailable or you may not have access."
      />
    )
  }

  const rangeQuery = new URLSearchParams()
  if (fromDate) rangeQuery.set("from", fromDate)
  if (toDate) rangeQuery.set("to", toDate)
  const rangeSuffix = rangeQuery.toString() ? `?${rangeQuery.toString()}` : ""
  const listHref = `/staff/team-performance${rangeSuffix}`

  const olderQuery = new URLSearchParams(rangeQuery)
  if (activity.nextCursor) olderQuery.set("cursor", activity.nextCursor)
  const olderHref = activity.nextCursor
    ? `/staff/team-performance/${staffMemberId}?${olderQuery.toString()}`
    : null

  const exportHref = buildStaffProductivityExportHref(staffMemberId, { from, to })
  const member = detail.member
  const presets = buildPresets()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href={listHref}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={14} />
            Back to team performance
          </Link>
          <h2 className="mt-3 font-serif text-2xl font-semibold text-foreground">{member.displayName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {member.username ? `@${member.username}` : shortId(member.staffMemberId)} ·{" "}
            {member.role.replaceAll("_", " ")}
            {member.status !== "ACTIVE" ? ` · ${member.status.toLowerCase()}` : ""}
          </p>
          <p className="mt-2 max-w-2xl text-xs text-muted-foreground">{detail.definitions.reliableFrom}</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Link
                key={preset.label}
                href={`/staff/team-performance/${staffMemberId}?from=${preset.from}&to=${preset.to}`}
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
              >
                {preset.label}
              </Link>
            ))}
          </div>
          <a
            href={exportHref}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Download size={14} />
            Export CSV
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Assets touched", value: member.uniqueAssetsTouched, title: detail.definitions.uniqueAssetsTouched },
          { label: "Saves", value: member.saves, title: detail.definitions.saves },
          { label: "Caption assets", value: member.uniqueAssetsByField.caption, title: detail.definitions.uniqueAssetsByField },
          { label: "Who-in-pic assets", value: member.uniqueAssetsByField.whoIsInPicture, title: detail.definitions.uniqueAssetsByField },
          { label: "Keyword assets", value: member.uniqueAssetsByField.keywords, title: detail.definitions.uniqueAssetsByField },
          { label: "Uploads approved", value: member.uploadsApproved, title: "Contributor uploads approved" },
          { label: "Uploads rejected", value: member.uploadsRejected, title: "Contributor uploads rejected" },
          { label: "Last activity", value: formatDateTime(member.lastActivityAt), title: "Most recent audited action" },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4" title={card.title}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {typeof card.value === "number" ? formatNumber(card.value) : card.value}
            </p>
          </div>
        ))}
      </div>

      <StaffProductivityCharts
        activityByDay={detail.activityByDay}
        uniqueAssetsByField={member.uniqueAssetsByField}
        fieldSaves={member.fieldSaves}
      />

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Activity log</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Save / edit operations with changed fields. CSV export includes up to 5,000 rows for this range.
          </p>
        </div>
        <StaffProductivityActivityTable
          items={activity.items}
          nextCursor={activity.nextCursor}
          olderHref={olderHref}
        />
      </div>
    </div>
  )
}

function buildPresets() {
  const today = new Date()
  const toIsoDate = (date: Date) => date.toISOString().slice(0, 10)
  const shiftDays = (days: number) => {
    const date = new Date(today)
    date.setUTCDate(date.getUTCDate() - (days - 1))
    return toIsoDate(date)
  }
  return [
    { label: "1 day", from: toIsoDate(today), to: toIsoDate(today) },
    { label: "7 days", from: shiftDays(7), to: toIsoDate(today) },
    { label: "30 days", from: shiftDays(30), to: toIsoDate(today) },
  ]
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value)
}

function formatDateTime(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function shortId(value: string) {
  if (value.length <= 12) return value
  return value.slice(0, 8)
}

function readDate(value: string | string[] | undefined) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined
}
