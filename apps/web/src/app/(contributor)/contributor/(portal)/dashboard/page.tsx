import Link from "next/link"

import { getContributorAnalyticsSummary } from "@/lib/api/contributor-api"
import { getContributorCookieHeader, requireContributorPasswordReady } from "@/lib/contributor-session"
import {
  ArrowUpRight,
  BarChart3,
  Calendar,
  CloudUpload,
  Download,
  ImagePlus,
  Layers,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Dashboard — Contributor",
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
}: {
  title: string
  value: number
  subtitle: string
  icon: LucideIcon
  href?: string
}) {
  const content = (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:border-border/80 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground group-hover:bg-muted">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      {href ? (
        <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
      ) : null}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date)
}

export default async function ContributorDashboardPage() {
  const session = await requireContributorPasswordReady()
  const cookieHeader = await getContributorCookieHeader()

  const analyticsResult = await getContributorAnalyticsSummary({ cookieHeader }).catch(() => null)
  const summary = analyticsResult?.summary
  const topDownloaded = analyticsResult?.topDownloadedImages ?? []
  const recentUploads = analyticsResult?.recentUploads ?? []
  const analyticsFailed = !analyticsResult

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Contributor Dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Welcome, {session.contributor.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Portfolio performance, subscriber downloads, and recent activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/contributor/uploads/new">
              <CloudUpload className="mr-1.5" size={16} />
              New upload
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/contributor/uploads">View uploads</Link>
          </Button>
        </div>
      </div>

      {analyticsFailed ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">Analytics could not be loaded at this time.</p>
        </div>
      ) : !summary ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No summary analytics available.</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Published"
              value={summary.approvedImages}
              subtitle="Live on public catalog"
              icon={BarChart3}
              href="/contributor/images"
            />
            <StatCard
              title="Downloads"
              value={summary.downloadsThisMonth}
              subtitle={`${summary.downloadsToday} today · ${summary.downloadsAllTime} all time`}
              icon={Download}
            />
            <StatCard
              title="Uploads"
              value={summary.uploadsThisMonth}
              subtitle={`${summary.uploadsThisWeek} this week · ${summary.totalUploads} total`}
              icon={ImagePlus}
              href="/contributor/uploads"
            />
            <StatCard
              title="In Review"
              value={summary.submittedImages}
              subtitle={`${summary.submissionsThisWeek} this week · ${summary.submissionsThisMonth} this month`}
              icon={Layers}
            />
          </div>

          {/* Recent Uploads + Top Downloads — side by side on wide screens */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Uploads */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <CloudUpload className="text-muted-foreground" size={20} />
                Recent Uploads
              </h2>
              {recentUploads.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  No uploads yet.{" "}
                  <Link href="/contributor/uploads/new" className="text-primary hover:underline">
                    Start your first upload
                  </Link>
                  .
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <ul className="divide-y divide-border">
                    {recentUploads.map((row) => (
                      <li
                        key={row.imageAssetId}
                        className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {row.whoIsInPicture ?? row.headline ?? row.legacyImageCode ?? "Untitled"}
                          </p>
                          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar size={12} />
                            <span>
                              {row.assetType === "CARICATURE"
                                ? row.categoryName ?? "Caricature"
                                : row.eventName ?? "Event TBD"}
                            </span>
                            {row.assetType === "CARICATURE" ? (
                              <Badge variant="outline">Caricature</Badge>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={row.status === "ACTIVE" ? "success" : "muted"}>
                            {row.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatDate(row.createdAt)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Top Downloaded Images */}
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <TrendingUp className="text-muted-foreground" size={20} />
                Top Downloaded
              </h2>
              {topDownloaded.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  No downloads yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <ul className="divide-y divide-border">
                    {topDownloaded.map((row) => (
                      <li
                        key={row.imageAssetId}
                        className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {row.whoIsInPicture ?? row.headline ?? row.legacyImageCode ?? "Untitled"}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{row.eventName ?? "Event TBD"}</span>
                            {row.legacyImageCode ? (
                              <>
                                <span className="h-1 w-1 rounded-full bg-border" />
                                <span className="font-mono">{row.legacyImageCode}</span>
                              </>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {!row.cardPreviewAvailable ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground">
                              Preview pending
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm font-medium tabular-nums text-foreground">
                            <Download className="text-muted-foreground" size={14} />
                            {row.downloadCount}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
