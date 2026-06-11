import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  getContributorDownloads,
  getContributorAnalyticsSummary,
} from "@/lib/api/contributor-api"
import {
  getContributorCookieHeader,
  requireContributorPasswordReady,
} from "@/lib/contributor-session"
import { DownloadPdfButton } from "./download-pdf-button"
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
} from "lucide-react"

export const metadata = {
  title: "Download Reports — Contributor",
}

const SORT_OPTIONS = [
  { value: "top", label: "Most Downloaded" },
  { value: "recent", label: "Most Recent" },
] as const

const LIMIT_DEFAULT = 24

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date)
}

function formatShortDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

interface PageProps {
  searchParams: Promise<{
    sort?: string
    from?: string
    to?: string
    limit?: string
    offset?: string
  }>
}

export default async function ContributorDownloadReportsPage({
  searchParams,
}: PageProps) {
  await requireContributorPasswordReady()
  const sp = await searchParams

  const sort = sp.sort === "recent" ? "recent" : "top"
  const from = sp.from?.trim() || undefined
  const to = sp.to?.trim() || undefined
  const limit = Math.min(
    Math.max(1, Number(sp.limit) || LIMIT_DEFAULT),
    100,
  )
  const offset = Math.max(0, Number(sp.offset) || 0)

  const cookieHeader = await getContributorCookieHeader()

  const [downloadsResult, analyticsResult] = await Promise.all([
    getContributorDownloads(
      { limit, offset, sort, from, to },
      { cookieHeader },
    ).catch(() => null),
    getContributorAnalyticsSummary({ cookieHeader }).catch(() => null),
  ])

  const downloads = downloadsResult?.downloads ?? []
  const pagination = downloadsResult?.pagination ?? {
    limit,
    offset,
    total: 0,
  }
  const summary = analyticsResult?.summary
  const fetchFailed = !downloadsResult

  const nextOffset = pagination.offset + pagination.limit
  const prevOffset = Math.max(0, pagination.offset - pagination.limit)
  const hasMore = nextOffset < pagination.total
  const hasPrev = pagination.offset > 0

  function buildQuery(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams()
    if (overrides.sort !== undefined && overrides.sort !== "top")
      next.set("sort", overrides.sort)
    else if (sort !== "top" && overrides.sort === undefined)
      next.set("sort", sort)
    if ((overrides.from ?? from)) next.set("from", overrides.from ?? from!)
    if ((overrides.to ?? to)) next.set("to", overrides.to ?? to!)
    if (overrides.limit !== undefined) next.set("limit", overrides.limit)
    if (overrides.offset !== undefined && overrides.offset !== "0")
      next.set("offset", overrides.offset)
    const qs = next.toString()
    return qs ? `?${qs}` : ""
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Contributor Reports
          </p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <FileText className="text-muted-foreground" size={28} />
            Download Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            See how subscribers are downloading your images. Export as PDF for
            your records.
          </p>
        </div>
        <DownloadPdfButton
          sort={sort}
          from={from}
          to={to}
          summary={
            summary
              ? {
                  downloadsToday: summary.downloadsToday,
                  downloadsThisMonth: summary.downloadsThisMonth,
                  downloadsAllTime: summary.downloadsAllTime,
                }
              : null
          }
        />
      </div>

      {fetchFailed ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">
            Download data could not be loaded at this time.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {summary ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Downloads Today
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                  {summary.downloadsToday.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  This Month
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                  {summary.downloadsThisMonth.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  All Time
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                  {summary.downloadsAllTime.toLocaleString()}
                </p>
              </div>
            </div>
          ) : null}

          {/* Sort + Date filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((opt) => (
                <Link
                  key={opt.value}
                  href={`/contributor/download-reports${buildQuery({ sort: opt.value })}`}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    sort === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {opt.label}
                </Link>
              ))}
            </div>

            <form
              action="/contributor/download-reports"
              method="get"
              className="flex flex-wrap items-end gap-2"
            >
              {sort !== "top" ? (
                <input type="hidden" name="sort" value={sort} />
              ) : null}
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                From
                <input
                  type="date"
                  name="from"
                  defaultValue={from ?? ""}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                To
                <input
                  type="date"
                  name="to"
                  defaultValue={to ?? ""}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
              </label>
              <Button type="submit" variant="outline" size="sm">
                Apply
              </Button>
              {(from || to) ? (
                <Link
                  href={`/contributor/download-reports${buildQuery({ from: undefined, to: undefined })}`}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear dates
                </Link>
              ) : null}
            </form>
          </div>

          {/* Table */}
          {downloads.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
              {from || to
                ? "No downloads found in this date range."
                : "No downloads yet. Downloads will appear here once subscribers license your images."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Image</th>
                    <th className="px-5 py-3">Fotokey</th>
                    <th className="px-5 py-3">Event</th>
                    <th className="px-5 py-3 text-right">Downloads</th>
                    <th className="px-5 py-3 text-right">Last Downloaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {downloads.map((row) => (
                    <tr
                      key={row.imageAssetId}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">
                          {row.whoIsInPicture ??
                            row.headline ??
                            row.legacyImageCode ??
                            "Untitled"}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        {row.legacyImageCode ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            {row.legacyImageCode}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {row.eventName ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm font-medium tabular-nums text-foreground">
                          <Download className="text-muted-foreground" size={14} />
                          {row.downloadCount}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground tabular-nums">
                        {formatShortDate(row.lastDownloadedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <footer className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {downloads.length} of {pagination.total.toLocaleString()}{" "}
              ({pagination.offset + 1}-
              {Math.min(pagination.offset + downloads.length, pagination.total)}
              )
            </p>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrev}
                tabIndex={hasPrev ? 0 : -1}
                href={`/contributor/download-reports${buildQuery({
                  offset: String(prevOffset),
                })}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-medium",
                  hasPrev
                    ? "hover:bg-muted"
                    : "pointer-events-none opacity-50",
                )}
              >
                <ChevronLeft size={14} /> Previous
              </Link>
              <Link
                aria-disabled={!hasMore}
                tabIndex={hasMore ? 0 : -1}
                href={`/contributor/download-reports${buildQuery({
                  offset: String(nextOffset),
                })}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-medium",
                  hasMore
                    ? "hover:bg-muted"
                    : "pointer-events-none opacity-50",
                )}
              >
                Next <ChevronRight size={14} />
              </Link>
            </div>
          </footer>
        </>
      )}
    </div>
  )
}
