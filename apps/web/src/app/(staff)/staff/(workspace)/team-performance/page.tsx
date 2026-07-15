import { AlertTriangle } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import {
  getStaffProductivity,
  StaffApiError,
  type StaffProductivityDefinitions,
  type StaffProductivityMember,
  type StaffProductivitySummary,
} from "@/lib/api/staff-api"
import { getStaffCookieHeader, requireStaffRole } from "@/lib/staff-session"

export const metadata = {
  title: "Team Performance — Fotocorp Staff",
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StaffTeamPerformancePage({ searchParams }: PageProps) {
  await requireStaffRole(["SUPER_ADMIN"])

  const params = await searchParams
  const fromDate = readDate(params.from)
  const toDate = readDate(params.to)
  const from = fromDate ? `${fromDate}T00:00:00.000Z` : undefined
  const to = toDate ? `${toDate}T23:59:59.999Z` : undefined

  let summary: StaffProductivitySummary
  let members: StaffProductivityMember[]
  let definitions: StaffProductivityDefinitions

  try {
    const response = await getStaffProductivity({
      cookieHeader: await getStaffCookieHeader(),
      from,
      to,
    })
    summary = response.summary
    members = response.members
    definitions = response.definitions
  } catch (caught) {
    if (!(caught instanceof StaffApiError)) throw caught
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load team performance"
        description="The staff productivity service is unavailable or you may not have access."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Team Performance</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Primary KPI is unique assets touched. Field saves show caption, who-is-in-picture, keywords, and related
            edits from catalog, captions, contributor review, and upload wizard audits.
          </p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{definitions.reliableFrom}</p>
        </div>
        <TeamPerformanceFilters fromDate={fromDate} toDate={toDate} />
      </div>

      <SummaryGrid summary={summary} definitions={definitions} />

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium">Staff</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 text-right font-medium" title={definitions.uniqueAssetsTouched}>
                Assets touched
              </th>
              <th className="px-4 py-3 text-right font-medium" title={definitions.saves}>
                Saves
              </th>
              <th className="px-4 py-3 text-right font-medium" title={definitions.uniqueAssetsByField}>
                Caption assets
              </th>
              <th className="px-4 py-3 text-right font-medium" title={definitions.uniqueAssetsByField}>
                Who-in-pic assets
              </th>
              <th className="px-4 py-3 text-right font-medium" title={definitions.uniqueAssetsByField}>
                Keyword assets
              </th>
              <th className="px-4 py-3 text-right font-medium">Approved</th>
              <th className="px-4 py-3 text-right font-medium">Rejected</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  No staff activity found for this range.
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <PerformanceRow
                  key={member.staffMemberId}
                  member={member}
                  fromDate={fromDate}
                  toDate={toDate}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TeamPerformanceFilters({ fromDate, toDate }: { fromDate?: string; toDate?: string }) {
  const today = new Date()
  const toIsoDate = (date: Date) => date.toISOString().slice(0, 10)
  const shiftDays = (days: number) => {
    const date = new Date(today)
    date.setUTCDate(date.getUTCDate() - (days - 1))
    return toIsoDate(date)
  }
  const presets = [
    { label: "1 day", from: toIsoDate(today), to: toIsoDate(today) },
    { label: "7 days", from: shiftDays(7), to: toIsoDate(today) },
    { label: "30 days", from: shiftDays(30), to: toIsoDate(today) },
  ]

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Link
            key={preset.label}
            href={`/staff/team-performance?from=${preset.from}&to=${preset.to}`}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            {preset.label}
          </Link>
        ))}
      </div>
      <form action="/staff/team-performance" className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          From
          <input
            type="date"
            name="from"
            defaultValue={fromDate}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          To
          <input
            type="date"
            name="to"
            defaultValue={toDate}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Apply
        </button>
        {fromDate || toDate ? (
          <Link
            href="/staff/team-performance"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            Clear
          </Link>
        ) : null}
      </form>
    </div>
  )
}

function SummaryGrid({
  summary,
  definitions,
}: {
  summary: StaffProductivitySummary
  definitions: StaffProductivityDefinitions
}) {
  const cards = [
    { label: "Assets touched", value: summary.uniqueAssetsTouched, title: definitions.uniqueAssetsTouched },
    { label: "Saves", value: summary.saves, title: definitions.saves },
    { label: "Caption saves", value: summary.fieldSaves.caption, title: definitions.fieldSaves },
    { label: "Who-in-pic saves", value: summary.fieldSaves.whoIsInPicture, title: definitions.fieldSaves },
    { label: "Keyword saves", value: summary.fieldSaves.keywords, title: definitions.fieldSaves },
    { label: "Uploads approved", value: summary.uploadsApproved, title: "Contributor upload approvals in range" },
    { label: "Uploads rejected", value: summary.uploadsRejected, title: "Contributor upload rejections in range" },
    { label: "Active staff", value: summary.activeStaffCount, title: "Staff with any activity in range" },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border bg-card p-4" title={card.title}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(card.value)}</p>
        </div>
      ))}
    </div>
  )
}

function PerformanceRow({
  member,
  fromDate,
  toDate,
}: {
  member: StaffProductivityMember
  fromDate?: string
  toDate?: string
}) {
  const params = new URLSearchParams()
  if (fromDate) params.set("from", fromDate)
  if (toDate) params.set("to", toDate)
  const href = `/staff/team-performance/${member.staffMemberId}${params.toString() ? `?${params.toString()}` : ""}`

  return (
    <tr className="border-b border-border/70 last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link href={href} className="block">
          <div className="font-medium text-foreground hover:underline">{member.displayName}</div>
          <div className="text-xs text-muted-foreground">{member.username ? `@${member.username}` : shortId(member.staffMemberId)}</div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
          {member.role.replaceAll("_", " ")}
        </span>
        {member.status !== "ACTIVE" ? (
          <span className="ml-2 text-xs text-muted-foreground">{member.status.toLowerCase()}</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium">
        <Link href={href} className="hover:underline">
          {formatNumber(member.uniqueAssetsTouched)}
        </Link>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(member.saves)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(member.uniqueAssetsByField.caption)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(member.uniqueAssetsByField.whoIsInPicture)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(member.uniqueAssetsByField.keywords)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(member.uploadsApproved)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(member.uploadsRejected)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateTime(member.lastActivityAt)}</td>
    </tr>
  )
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
