import { AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { getStaffAuditLogs, StaffApiError, type StaffAuditLogItem, type StaffAuditLogSource } from "@/lib/api/staff-api"
import { getStaffCookieHeader, requireStaffRole } from "@/lib/staff-session"
import { AuditFilters } from "./audit-filters"
import { AuditPagination } from "./audit-pagination"

export const metadata = {
  title: "Audit — Fotocorp Staff",
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StaffAuditPage({ searchParams }: PageProps) {
  await requireStaffRole(["SUPER_ADMIN"])

  const params = await searchParams
  const source = parseSource(params.source)
  const action = readString(params.action)
  const entityType = readString(params.entityType)
  const cursor = readString(params.cursor)

  let items: StaffAuditLogItem[] = []
  let nextCursor: string | null = null

  try {
    const response = await getStaffAuditLogs({
      cookieHeader: await getStaffCookieHeader(),
      source,
      action,
      entityType,
      limit: 50,
      cursor,
    })
    items = response.items
    nextCursor = response.nextCursor
  } catch (caught) {
    if (!(caught instanceof StaffApiError)) throw caught
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load audit logs"
        description="The staff audit service is unavailable or you may not have access."
      />
    )
  }

  const filterParams = {
    source: source ?? undefined,
    action: action ?? undefined,
    entityType: entityType ?? undefined,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">Audit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Unified trail for staff operations, asset editorial changes, and user administration.
        </p>
      </div>

      <Suspense fallback={null}>
        <AuditFilters />
      </Suspense>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No audit entries match this filter.
                </td>
              </tr>
            ) : (
              items.map((row) => <AuditTableRow key={`${row.source}-${row.id}`} row={row} />)
            )}
          </tbody>
        </table>
      </div>

      <AuditPagination nextCursor={nextCursor} searchParams={filterParams} />
    </div>
  )
}

function AuditTableRow({ row }: { row: StaffAuditLogItem }) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap">
        {formatAuditTimestamp(row.createdAt)}
      </td>
      <td className="px-4 py-3 align-top">
        <SourceBadge source={row.source} />
      </td>
      <td className="px-4 py-3 align-top text-sm">{row.actorLabel ?? "—"}</td>
      <td className="px-4 py-3 align-top font-mono text-xs">{row.action}</td>
      <td className="px-4 py-3 align-top text-sm">
        {row.entityHref ? (
          <Link href={row.entityHref} className="text-primary hover:underline">
            {formatEntityLabel(row)}
          </Link>
        ) : (
          formatEntityLabel(row)
        )}
      </td>
      <td className="px-4 py-3 align-top text-sm">{row.targetLabel ?? "—"}</td>
      <td className="px-4 py-3 align-top text-sm text-muted-foreground">{row.summary}</td>
    </tr>
  )
}

function SourceBadge({ source }: { source: StaffAuditLogSource }) {
  const label = source === "staff" ? "Staff" : source === "asset" ? "Asset" : "User"
  return (
    <span className="inline-flex rounded-none border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
      {label}
    </span>
  )
}

function formatEntityLabel(row: StaffAuditLogItem) {
  if (row.entityType && row.entityId) return `${row.entityType} · ${shortId(row.entityId)}`
  if (row.entityType) return row.entityType
  return "—"
}

function shortId(value: string) {
  if (value.length <= 12) return value
  return `${value.slice(0, 8)}…`
}

function formatAuditTimestamp(value: string) {
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

function parseSource(value: string | string[] | undefined): StaffAuditLogSource | undefined {
  const raw = readString(value)
  if (raw === "staff" || raw === "asset" || raw === "user") return raw
  return undefined
}

function readString(value: string | string[] | undefined) {
  if (typeof value === "string" && value.trim()) return value.trim()
  return undefined
}
