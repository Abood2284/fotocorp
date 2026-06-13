import { AlertTriangle } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import {
  getStaffProductivity,
  StaffApiError,
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

  try {
    const response = await getStaffProductivity({
      cookieHeader: await getStaffCookieHeader(),
      from,
      to,
    })
    summary = response.summary
    members = response.members
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
            Caption writer productivity from audit logs: catalog caption edits, contributor upload metadata saves,
            approvals, and rejections.
          </p>
        </div>
        <TeamPerformanceFilters fromDate={fromDate} toDate={toDate} />
      </div>

      <SummaryGrid summary={summary} />

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium">Staff</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 text-right font-medium">Captions Edited</th>
              <th className="px-4 py-3 text-right font-medium">Unique Assets</th>
              <th className="px-4 py-3 text-right font-medium">Metadata Edits</th>
              <th className="px-4 py-3 text-right font-medium">Uploads Approved</th>
              <th className="px-4 py-3 text-right font-medium">Rejected</th>
              <th className="px-4 py-3 font-medium">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No caption writer activity found for this range.
                </td>
              </tr>
            ) : (
              members.map((member) => <PerformanceRow key={member.staffMemberId} member={member} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TeamPerformanceFilters({ fromDate, toDate }: { fromDate?: string; toDate?: string }) {
  return (
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
      {(fromDate || toDate) ? (
        <Link
          href="/staff/team-performance"
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
        >
          Clear
        </Link>
      ) : null}
    </form>
  )
}

function SummaryGrid({ summary }: { summary: StaffProductivitySummary }) {
  const cards = [
    { label: "Captions edited", value: summary.captionsEdited },
    { label: "Unique assets captioned", value: summary.uniqueAssetsCaptioned },
    { label: "Uploads approved", value: summary.uploadsApproved },
    { label: "Uploads rejected", value: summary.uploadsRejected },
    { label: "Metadata edits", value: summary.metadataEdits },
    { label: "Active staff", value: summary.activeStaffCount },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(card.value)}</p>
        </div>
      ))}
    </div>
  )
}

function PerformanceRow({ member }: { member: StaffProductivityMember }) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{member.displayName}</div>
        <div className="text-xs text-muted-foreground">{member.username ? `@${member.username}` : shortId(member.staffMemberId)}</div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
          {member.role.replaceAll("_", " ")}
        </span>
        {member.status !== "ACTIVE" ? (
          <span className="ml-2 text-xs text-muted-foreground">{member.status.toLowerCase()}</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(member.captionsEdited)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(member.uniqueAssetsCaptioned)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(member.metadataEdits)}</td>
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
