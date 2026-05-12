import { BarChart3, Download, ImagePlus, Layers, TrendingUp, type LucideIcon } from "lucide-react"
import { getContributorAnalyticsSummary } from "@/lib/api/contributor-api"
import { getContributorCookieHeader, requireContributorPasswordReady } from "@/lib/contributor-session"

export const metadata = {
  title: "Contributor Dashboard",
}

function StatCard({
  title,
  primaryValue,
  primaryLabel,
  secondaryStats,
  icon: Icon
}: {
  title: string
  primaryValue: number
  primaryLabel: string
  secondaryStats: { label: string; value: number }[]
  icon: LucideIcon
}) {
  return (
    <div className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-6 md:p-8 transition-all hover:bg-muted/30">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-semibold uppercase tracking-[0.15em]">{title}</span>
        <Icon className="h-4 w-4" />
      </div>

      <div className="mt-8 md:mt-12">
        <p className="text-4xl md:text-5xl font-light tabular-nums tracking-tighter text-foreground">{primaryValue}</p>
        <p className="mt-1 text-sm text-muted-foreground">{primaryLabel}</p>
      </div>

      {secondaryStats.length > 0 && (
        <div className="mt-6 flex items-center gap-6 border-t border-border pt-4">
          {secondaryStats.map(stat => (
            <div key={stat.label}>
              <p className="text-lg md:text-xl font-medium tabular-nums text-foreground">{stat.value}</p>
              <p className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default async function ContributorDashboardPage() {
  const session = await requireContributorPasswordReady()
  const cookieHeader = await getContributorCookieHeader()

  const analyticsResult = await getContributorAnalyticsSummary({ cookieHeader }).catch(() => null)
  const summary = analyticsResult?.summary
  const topDownloaded = analyticsResult?.topDownloadedImages ?? []
  const analyticsFailed = !analyticsResult

  return (
    <div className="space-y-8 lg:space-y-12">
      <div className="flex flex-col gap-12 lg:gap-16">
        {/* Header */}
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              Welcome, {session.contributor.displayName}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-xl">
              Overview of your portfolio performance, subscriber downloads, and recent uploads.
            </p>
            {analyticsFailed && (
              <p className="mt-2 text-sm text-destructive">
                Analytics could not be loaded at this time.
              </p>
            )}
          </div>
          
        </header>

        {summary ? (
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 xl:grid-cols-4">
            {/* Published Portfolio */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-6 md:p-8 transition-all hover:bg-muted/30">
               <div className="relative z-10 flex items-center justify-between text-muted-foreground">
                 <span className="text-xs font-semibold uppercase tracking-[0.15em]">Published</span>
                 <BarChart3 className="h-4 w-4" />
               </div>
               <div className="relative z-10 mt-12 md:mt-16">
                 <p className="text-4xl md:text-5xl font-light tracking-tighter tabular-nums text-foreground">{summary.approvedImages}</p>
                 <p className="mt-1 text-sm text-muted-foreground">Live on public catalog</p>
               </div>
            </div>

            <StatCard
              title="Downloads"
              primaryValue={summary.downloadsThisMonth}
              primaryLabel="This month"
              secondaryStats={[
                { label: "Today", value: summary.downloadsToday },
                { label: "All time", value: summary.downloadsAllTime },
              ]}
              icon={Download}
            />

            <StatCard
              title="Uploads"
              primaryValue={summary.uploadsThisMonth}
              primaryLabel="This month"
              secondaryStats={[
                { label: "This wk", value: summary.uploadsThisWeek },
                { label: "Total", value: summary.totalUploads },
              ]}
              icon={ImagePlus}
            />

            <StatCard
              title="In Review"
              primaryValue={summary.submittedImages}
              primaryLabel="Right now"
              secondaryStats={[
                { label: "This wk", value: summary.submissionsThisWeek },
                { label: "This mo", value: summary.submissionsThisMonth },
              ]}
              icon={Layers}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">No summary analytics available.</p>
          </div>
        )}

        {/* Top Downloads Table */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              Top Downloaded Images
            </h2>
          </div>

          {!summary ? null : topDownloaded.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
              No downloads yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {topDownloaded.map((row) => (
                  <li key={row.imageAssetId} className="group flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/20">
                    <div>
                      <p className="font-medium text-foreground md:text-base">{row.title ?? row.headline ?? row.legacyImageCode ?? "Untitled"}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{row.eventName || "Event TBD"}</span>
                        {row.legacyImageCode && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-border" />
                            <span className="font-mono">{row.legacyImageCode}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      {!row.cardPreviewAvailable && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Preview pending</span>
                      )}
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-sm font-medium tabular-nums text-foreground transition-colors group-hover:bg-muted">
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
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
    </div>
  )
}
