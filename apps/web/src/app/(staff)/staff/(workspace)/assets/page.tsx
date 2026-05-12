import Link from "next/link"
import type { ReactNode } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, Filter, ImageOff, Search, X } from "lucide-react"
import { getAdminAssetFilters, getAdminAssetStats, listAdminAssets } from "@/lib/api/admin-assets-api"
import { EmptyState } from "@/components/shared/empty-state"
import { PreviewImage } from "@/components/assets/preview-image"

interface AdminAssetsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = {
  title: "Admin Assets — Fotocorp",
}

export default async function AdminAssetsPage({ searchParams }: AdminAssetsPageProps) {
  const params = await searchParams
  const query = toQueryParams(params)

  const [filters, response, stats] = await Promise.all([
    getAdminAssetFilters().catch(() => null),
    listAdminAssets(query).catch(() => null),
    getAdminAssetStats().catch(() => null),
  ])

  if (!filters || !response) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load admin assets"
        description="Internal admin assets API request failed."
      />
    )
  }

  const nextQuery = new URLSearchParams(query)
  if (response.nextCursor) nextQuery.set("cursor", response.nextCursor)
  const previousQuery = new URLSearchParams(query)
  previousQuery.delete("cursor")

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Assets</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review imported assets, preview readiness, publishing state, and metadata quality.
          </p>
        </div>
      </div>

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total assets" value={stats.totalAssets.toLocaleString()} />
          <StatCard label="Approved public" value={stats.approvedPublicAssets.toLocaleString()} />
          <StatCard label="Preview ready card" value={stats.readyCardPreviewCount.toLocaleString()} />
          <StatCard label="R2 verified" value={(stats.totalAssets - stats.missingR2Count).toLocaleString()} />
        </div>
      ) : null}

      <ActiveFilterChips query={query} />

      {response.items.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title="No assets match this filter set"
          description="Try broadening search or filters."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[1320px] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <Th>Preview</Th>
                <Th
                  filterControl={(
                    <HeaderSearchFilter query={query} />
                  )}
                >
                  Asset
                </Th>
                <Th
                  filterControl={(
                    <HeaderSelectFilter
                      query={query}
                      name="status"
                      label="Status"
                      options={[
                        { value: "", label: "All" },
                        ...filters.statuses.map((item) => ({ value: item.status, label: item.status })),
                      ]}
                    />
                  )}
                >
                  Status
                </Th>
                <Th
                  filterControl={(
                    <HeaderSelectFilter
                      query={query}
                      name="visibility"
                      label="Visibility"
                      options={[
                        { value: "", label: "All" },
                        { value: "PUBLIC", label: "PUBLIC" },
                        { value: "PRIVATE", label: "PRIVATE" },
                        { value: "UNLISTED", label: "UNLISTED" },
                      ]}
                    />
                  )}
                >
                  Visibility
                </Th>
                <Th
                  filterControl={(
                    <HeaderSelectFilter
                      query={query}
                      name="previewState"
                      label="Preview"
                      options={[
                        { value: "all", label: "All" },
                        { value: "ready", label: "READY" },
                        { value: "partial", label: "PARTIAL" },
                        { value: "missing", label: "MISSING" },
                      ]}
                    />
                  )}
                >
                  Preview readiness
                </Th>
                <Th
                  filterControl={(
                    <HeaderSelectFilter
                      query={query}
                      name="r2Exists"
                      label="R2"
                      options={[
                        { value: "", label: "All" },
                        { value: "true", label: "Mapped" },
                        { value: "false", label: "Missing" },
                      ]}
                    />
                  )}
                >
                  R2
                </Th>
                <Th
                  filterControl={(
                    <HeaderSelectFilter
                      query={query}
                      name="categoryId"
                      label="Category"
                      options={[
                        { value: "", label: "All" },
                        ...filters.categories.map((item) => ({ value: item.id, label: item.name })),
                      ]}
                    />
                  )}
                >
                  Category
                </Th>
                <Th
                  filterControl={(
                    <HeaderSelectFilter
                      query={query}
                      name="eventId"
                      label="Event"
                      options={[
                        { value: "", label: "All" },
                        ...filters.events.map((item) => ({ value: item.id, label: item.name ?? "Untitled" })),
                      ]}
                    />
                  )}
                >
                  Event
                </Th>
                <Th
                  filterControl={(
                    <HeaderSelectFilter
                      query={query}
                      name="contributorId"
                      label="Photographer"
                      options={[
                        { value: "", label: "All" },
                        ...filters.contributors.map((item) => ({ value: item.id, label: item.displayName })),
                      ]}
                    />
                  )}
                >
                  Photographer
                </Th>
                <Th
                  filterControl={(
                    <HeaderSelectFilter
                      query={query}
                      name="sort"
                      label="Sort"
                      options={[
                        { value: "newest", label: "Newest" },
                        { value: "oldest", label: "Oldest" },
                        { value: "imageDateDesc", label: "Image date newest" },
                        { value: "imageDateAsc", label: "Image date oldest" },
                        { value: "recentlyUpdated", label: "Recently updated" },
                        { value: "missingR2", label: "Missing R2 first" },
                        { value: "missingPreview", label: "Missing preview first" },
                      ]}
                    />
                  )}
                >
                  Updated
                </Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {response.items.map((asset) => (
                <tr key={asset.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    {bestPreviewVariant(asset) ? (
                      <div className="h-16 w-24 overflow-hidden rounded border border-border bg-muted">
                        <PreviewImage
                          src={`/staff/assets/${asset.id}/preview-image?variant=${bestPreviewVariant(asset)}`}
                          alt={asset.headline || asset.caption || asset.legacyImageCode || asset.id}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <StatusBadge tone="neutral">Preview unavailable</StatusBadge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-mono text-xs">{asset.legacyImageCode ?? asset.id}</p>
                    <p className="mt-1 line-clamp-2 font-medium">{asset.headline || asset.caption || "Untitled"}</p>
                  </td>
                  <td className="px-3 py-2"><StatusBadge tone="neutral">{asset.status}</StatusBadge></td>
                  <td className="px-3 py-2"><StatusBadge tone={asset.visibility === "PUBLIC" ? "ok" : "warn"}>{asset.visibility}</StatusBadge></td>
                  <td className="px-3 py-2">
                    {(asset.previewReady ?? false)
                      ? <StatusBadge tone="ok">Ready</StatusBadge>
                      : (asset.previewState === "PARTIAL"
                        ? <StatusBadge tone="warn">{asset.missingPreviewVariants?.length ? `Missing ${asset.missingPreviewVariants.join(",")}` : "Partial"}</StatusBadge>
                        : <StatusBadge tone="neutral">Missing</StatusBadge>)}
                  </td>
                  <td className="px-3 py-2">
                    {asset.r2Exists ? <StatusBadge tone="ok">Verified</StatusBadge> : <StatusBadge tone="danger">Missing R2</StatusBadge>}
                  </td>
                  <td className="px-3 py-2">{asset.category?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <p>{asset.event?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{toDate(asset.event?.eventDate ?? null)}</p>
                  </td>
                  <td className="px-3 py-2">{asset.contributor?.displayName ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{toDate(asset.updatedAt ?? asset.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/staff/assets/${asset.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Inspect <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link href={`/staff/assets?${previousQuery.toString()}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
          Reset cursor
        </Link>
        {response.nextCursor ? (
          <Link href={`/staff/assets?${nextQuery.toString()}`} className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            Load more
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">End of filtered results</span>
        )}
      </div>
    </div>
  )
}

function Th({
  children,
  className,
  filterControl,
}: {
  children: ReactNode
  className?: string
  filterControl?: ReactNode
}) {
  return (
    <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className ?? ""}`}>
      <span className="inline-flex items-center gap-1.5">
        {children}
        {filterControl}
      </span>
    </th>
  )
}

function HeaderSearchFilter({ query }: { query: URLSearchParams }) {
  const value = query.get("q") ?? ""
  return (
    <details className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center rounded border border-border p-1 text-muted-foreground hover:bg-muted" aria-label="Filter by search query">
        <Search className="h-3 w-3" />
      </summary>
      <form method="get" className="absolute left-0 z-20 mt-1 w-64 rounded-md border border-border bg-card p-2 shadow-md">
        <PreserveQuery query={query} omit={["q", "cursor"]} />
        <input
          name="q"
          defaultValue={value}
          placeholder="Search..."
          className="mb-2 h-8 w-full rounded border border-border bg-background px-2 text-xs"
        />
        <button type="submit" className="w-full rounded border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted">
          Apply
        </button>
      </form>
    </details>
  )
}

function HeaderSelectFilter({
  query,
  name,
  label,
  options,
}: {
  query: URLSearchParams
  name: string
  label: string
  options: Array<{ value: string; label: string }>
}) {
  const value = query.get(name) ?? (name === "previewState" ? "all" : "")
  return (
    <details className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center rounded border border-border p-1 text-muted-foreground hover:bg-muted" aria-label={`Filter by ${label}`}>
        <Filter className="h-3 w-3" />
      </summary>
      <form method="get" className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-card p-2 shadow-md">
        <PreserveQuery query={query} omit={[name, "cursor"]} />
        <select
          name={name}
          defaultValue={value}
          className="mb-2 h-8 w-full rounded border border-border bg-background px-2 text-xs"
        >
          {options.map((option) => (
            <option key={`${name}-${option.value || "all"}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" className="w-full rounded border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted">
          Apply
        </button>
      </form>
    </details>
  )
}

function ActiveFilterChips({ query }: { query: URLSearchParams }) {
  const chips = [
    chip("q", query.get("q"), "Search"),
    chip("status", query.get("status"), "Status"),
    chip("visibility", query.get("visibility"), "Visibility"),
    chip("previewState", query.get("previewState"), "Preview", "all"),
    chip("r2Exists", query.get("r2Exists"), "R2"),
    chip("categoryId", query.get("categoryId"), "Category"),
    chip("eventId", query.get("eventId"), "Event"),
    chip("contributorId", query.get("contributorId"), "Photographer"),
    chip("sort", query.get("sort"), "Sort", "newest"),
  ].filter((item): item is { key: string; label: string; value: string } => item !== null)

  if (!chips.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((item) => (
        <Link
          key={item.key}
          href={`/staff/assets?${withoutParam(query, item.key)}`}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs"
        >
          {item.label}: {item.value}
          <X className="h-3 w-3" />
        </Link>
      ))}
      <Link href="/staff/assets" className="text-xs text-muted-foreground hover:text-foreground">
        Clear filters
      </Link>
    </div>
  )
}

function PreserveQuery({ query, omit }: { query: URLSearchParams; omit: string[] }) {
  return (
    <>
      {[...query.entries()]
        .filter(([key]) => !omit.includes(key))
        .map(([key, value]) => (
          <input key={`${key}-${value}`} type="hidden" name={key} value={value} />
        ))}
    </>
  )
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: "ok" | "warn" | "danger" | "neutral" }) {
  const map = {
    ok: "bg-emerald-100 text-emerald-800 border-emerald-200",
    warn: "bg-amber-100 text-amber-800 border-amber-200",
    danger: "bg-rose-100 text-rose-800 border-rose-200",
    neutral: "bg-slate-100 text-slate-800 border-slate-200",
  } as const
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-medium ${map[tone]}`}>{children}</span>
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function toDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-IN")
}

function toQueryParams(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.trim()) {
      query.set(key, value)
    }
  }
  if (!query.has("limit")) query.set("limit", "50")
  return query
}

function withoutParam(query: URLSearchParams, key: string) {
  const next = new URLSearchParams(query)
  next.delete(key)
  next.delete("cursor")
  return next.toString()
}

function chip(key: string, value: string | null, label: string, ignoredValue?: string) {
  if (!value || value === ignoredValue) return null
  return { key, value, label }
}

function bestPreviewVariant(asset: {
  readyPreviewVariants?: Array<"thumb" | "card" | "detail">
}) {
  if (!asset.readyPreviewVariants) return null
  if (asset.readyPreviewVariants.includes("card")) return "card"
  if (asset.readyPreviewVariants.includes("detail")) return "detail"
  if (asset.readyPreviewVariants.includes("thumb")) return "thumb"
  return null
}
