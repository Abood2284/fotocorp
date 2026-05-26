"use client"

import { SquareCheck, ChevronLeft, ChevronRight, ImageOff, Square, X, Filter, Search, Ellipsis, FileImage } from "lucide-react"
import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import type { AdminCatalogAssetItem, AdminCatalogAssetsResponse, AdminCatalogFilters, AdminCatalogStats } from "@/features/assets/admin-catalog-types"
import { updateAdminAssetStateBulkAction } from "@/app/(staff)/staff/(workspace)/catalog/actions"
import { PreviewImage } from "@/components/assets/preview-image"
import { StaffCatalogDetailSidebar } from "./staff-catalog-detail-sidebar"
import { ConfirmDialog } from "@/components/staff/shared/confirm-dialog"
import { cn } from "@/lib/utils"

interface StaffCatalogClientProps {
  initialResponse: AdminCatalogAssetsResponse
  filters: AdminCatalogFilters
  stats: AdminCatalogStats
  initialQuery: Record<string, string>
}

export function StaffCatalogClient({ initialResponse, filters, stats, initialQuery }: StaffCatalogClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [inspectAssetId, setInspectAssetId] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string
    description: string
    variant: "default" | "destructive"
    action: () => void
  } | null>(null)
  
  const queryParams = new URLSearchParams(initialQuery)
  const previousQuery = new URLSearchParams(queryParams)
  previousQuery.delete("cursor")
  const nextQuery = new URLSearchParams(queryParams)
  if (initialResponse.nextCursor) nextQuery.set("cursor", initialResponse.nextCursor)

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = () => {
    if (selectedIds.size === initialResponse.items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(initialResponse.items.map(i => i.id)))
    }
  }

  const refreshData = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const handleBulkArchive = async () => {
    if (!selectedIds.size) return
    setPendingConfirm({
      title: "Archive assets",
      description: `Are you sure you want to archive ${selectedIds.size} assets?`,
      variant: "destructive",
      action: async () => {
        try {
          await updateAdminAssetStateBulkAction({
            assetIds: Array.from(selectedIds),
            status: "REJECTED",
            visibility: "PRIVATE"
          })
          setSelectedIds(new Set())
          refreshData()
        } catch (e) {
          alert("Failed to archive some assets")
        }
      },
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!inspectAssetId) return
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "SELECT") {
        return
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        const currentIndex = initialResponse.items.findIndex(a => a.id === inspectAssetId)
        if (currentIndex === -1) return
        if (e.key === "ArrowDown" && currentIndex < initialResponse.items.length - 1) {
          setInspectAssetId(initialResponse.items[currentIndex + 1].id)
        } else if (e.key === "ArrowUp" && currentIndex > 0) {
          setInspectAssetId(initialResponse.items[currentIndex - 1].id)
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [inspectAssetId, initialResponse.items])

  return (
    <div className="space-y-5 relative">
      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description ?? ""}
        variant={pendingConfirm?.variant ?? "default"}
        onConfirm={() => {
          pendingConfirm?.action()
          setPendingConfirm(null)
        }}
        onCancel={() => setPendingConfirm(null)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Catalog</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage assets, curate metadata, and review contributor uploads.
          </p>
        </div>
      </div>

      <div className="flex w-full items-start gap-4">
        <div className={cn("space-y-5 transition-all duration-300", inspectAssetId ? "w-[60%]" : "w-full")}>
          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="sticky top-16 z-30 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleBulkArchive} className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted text-rose-600">
                  Bulk Archive
                </button>
              </div>
            </div>
          )}

          {/* Filter Chips */}
          <ActiveFilterChips query={queryParams} />

          {/* Main Grid */}
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-3 py-2 text-left w-10">
                <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                  {selectedIds.size === initialResponse.items.length && initialResponse.items.length > 0 ? (
                    <SquareCheck size={16} />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <Th>Preview</Th>
              <Th filterControl={<HeaderSearchFilter query={queryParams} />}>Asset</Th>
              <Th filterControl={
                <HeaderSelectFilter 
                  query={queryParams} 
                  name="status" 
                  options={[{value:"",label:"All"}, ...filters.statuses.map(s => ({value: s.status, label: s.status}))]} 
                />
              }>Status</Th>
              <Th filterControl={
                <HeaderSelectFilter 
                  query={queryParams} 
                  name="visibility" 
                  options={[{value:"",label:"All"}, {value:"PUBLIC",label:"PUBLIC"}, {value:"PRIVATE",label:"PRIVATE"}, {value:"UNLISTED",label:"UNLISTED"}]} 
                />
              }>Visibility</Th>
              <Th filterControl={
                <HeaderSelectFilter 
                  query={queryParams} 
                  name="categoryId" 
                  options={[{value:"",label:"All"}, {value:"none",label:"No Category"}, ...filters.categories.map(c => ({value: c.id, label: c.name}))]} 
                />
              }>Category</Th>
              <Th filterControl={
                <HeaderSelectFilter 
                  query={queryParams} 
                  name="eventId" 
                  options={[{value:"",label:"All"}, {value:"none",label:"No Event"}, ...filters.events.map(e => ({value: e.id, label: e.name || "Untitled"}))]} 
                />
              }>Event</Th>
              <Th filterControl={
                <HeaderSelectFilter 
                  query={queryParams} 
                  name="sort" 
                  options={[
                    { value: "newest", label: "Newest" },
                    { value: "oldest", label: "Oldest" },
                    { value: "imageDateDesc", label: "Image date newest" },
                    { value: "recentlyUpdated", label: "Recently updated" }
                  ]} 
                />
              }>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {initialResponse.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No assets found matching filters.
                </td>
              </tr>
            ) : (
              initialResponse.items.map(asset => (
                <tr 
                  key={asset.id} 
                  onClick={() => setInspectAssetId(prev => prev === asset.id ? null : asset.id)}
                  className={`border-t border-border align-middle transition-colors hover:bg-muted/30 cursor-pointer ${selectedIds.has(asset.id) || inspectAssetId === asset.id ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleSelection(asset.id)} className="text-muted-foreground hover:text-foreground">
                      {selectedIds.has(asset.id) ? <SquareCheck size={16} /> : <Square size={16} />}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    {bestPreviewVariant(asset) ? (
                      <div className="h-12 w-20 overflow-hidden rounded border border-border bg-muted">
                        <PreviewImage
                          src={`/staff/catalog/${asset.id}/preview-image?variant=${bestPreviewVariant(asset)}`}
                          alt={asset.headline || asset.caption || "Preview"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-20 flex items-center justify-center rounded border border-border bg-muted text-muted-foreground">
                        <FileImage size={20} />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[200px]">
                    <p className="font-mono text-xs">{asset.legacyImageCode ?? asset.id.split('-')[0]}</p>
                    <p className="mt-0.5 truncate font-medium" title={asset.headline || asset.whoIsInPicture || "Untitled"}>{asset.headline || asset.whoIsInPicture || "Untitled"}</p>
                    {(!asset.headline && !asset.whoIsInPicture) && <span className="text-[10px] text-amber-600 font-medium">Missing who is in picture</span>}
                    {!asset.caption && <span className="text-[10px] text-amber-600 font-medium ml-2">Missing caption</span>}
                  </td>
                  <td className="px-3 py-2"><StatusBadge tone="neutral">{asset.status}</StatusBadge></td>
                  <td className="px-3 py-2"><StatusBadge tone={asset.visibility === "PUBLIC" ? "ok" : "warn"}>{asset.visibility}</StatusBadge></td>
                  <td className="px-3 py-2 max-w-[150px] truncate" title={asset.category?.name || ""}>{asset.category?.name ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[150px] truncate" title={asset.event?.name || ""}>{asset.event?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{toDate(asset.updatedAt ?? asset.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

          <div className="flex items-center justify-between gap-3">
            <Link href={`/staff/catalog?${previousQuery.toString()}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronLeft size={14} />
              Reset cursor
            </Link>
            {initialResponse.nextCursor ? (
              <Link href={`/staff/catalog?${nextQuery.toString()}`} className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                Load more
                <ChevronRight size={14} />
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">End of results</span>
            )}
          </div>
        </div>

        {inspectAssetId && (
          <div className="w-[40%] shrink-0">
            <StaffCatalogDetailSidebar
              assetId={inspectAssetId}
              onClose={() => setInspectAssetId(null)}
              onUpdate={refreshData}
              filters={filters}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" | "danger" | "neutral" }) {
  const map = {
    ok: "bg-emerald-100 text-emerald-800 border-emerald-200",
    warn: "bg-amber-100 text-amber-800 border-amber-200",
    danger: "bg-rose-100 text-rose-800 border-rose-200",
    neutral: "bg-slate-100 text-slate-800 border-slate-200",
  }
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[tone]}`}>{children}</span>
}

function bestPreviewVariant(asset: AdminCatalogAssetItem) {
  if (!asset.readyPreviewVariants) return null
  if (asset.readyPreviewVariants.includes("card")) return "card"
  if (asset.readyPreviewVariants.includes("detail")) return "detail"
  if (asset.readyPreviewVariants.includes("thumb")) return "thumb"
  return null
}

function toDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-IN", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// -----------------------------------------------------
// Filter Components
// -----------------------------------------------------

function Th({ children, className, filterControl }: { children: React.ReactNode; className?: string; filterControl?: React.ReactNode }) {
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
      <summary className="inline-flex cursor-pointer list-none items-center rounded p-1 hover:bg-muted/50" aria-label="Search">
        <Search size={14} />
      </summary>
      <form method="get" className="absolute left-0 z-20 mt-1 w-64 rounded-md border border-border bg-card p-3 shadow-xl">
        <PreserveQuery query={query} omit={["q", "cursor"]} />
        <input name="q" defaultValue={value} placeholder="Search terms..." className="mb-2 h-8 w-full rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
        <div className="flex items-center gap-2 mb-3 mt-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="missingWhoIsInPicture" value="true" defaultChecked={query.has("missingWhoIsInPicture")} /> Missing who is in picture
          </label>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="missingCaption" value="true" defaultChecked={query.has("missingCaption")} /> Missing Caption
          </label>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="contributorUploads" value="true" defaultChecked={query.has("contributorUploads")} /> Contributor Uploads
          </label>
        </div>
        <button type="submit" className="w-full rounded bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          Apply Filters
        </button>
      </form>
    </details>
  )
}

function HeaderSelectFilter({ query, name, options }: { query: URLSearchParams; name: string; options: Array<{ value: string; label: string }> }) {
  const value = query.get(name) ?? ""
  return (
    <details className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center rounded p-1 hover:bg-muted/50">
        <Filter size={14} />
      </summary>
      <form method="get" className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-card p-2 shadow-xl">
        <PreserveQuery query={query} omit={[name, "cursor"]} />
        <select name={name} defaultValue={value} className="mb-2 h-8 w-full rounded border border-border bg-background px-2 text-xs">
          {options.map((option) => (
            <option key={`${name}-${option.value || "all"}`} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button type="submit" className="w-full rounded bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
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
    chip("categoryId", query.get("categoryId"), "Category"),
    chip("eventId", query.get("eventId"), "Event"),
    chip("missingWhoIsInPicture", query.has("missingWhoIsInPicture") ? "true" : null, "Missing who is in picture"),
    chip("missingCaption", query.has("missingCaption") ? "true" : null, "Missing Caption"),
    chip("noEvent", query.has("noEvent") ? "true" : null, "No Event"),
    chip("noCategory", query.has("noCategory") ? "true" : null, "No Category"),
    chip("contributorUploads", query.has("contributorUploads") ? "true" : null, "Contributor Uploads"),
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  if (!chips.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((item) => (
        <Link
          key={item.key}
          href={`/staff/catalog?${withoutParam(query, item.key)}`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs transition-colors hover:bg-muted"
        >
          <span className="font-medium text-muted-foreground">{item.label}:</span> {item.value}
          <X className="ml-1" size={12} />
        </Link>
      ))}
      <Link href="/staff/catalog" className="text-xs font-medium text-primary hover:underline">
        Clear all
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

function withoutParam(query: URLSearchParams, key: string) {
  const next = new URLSearchParams(query)
  next.delete(key)
  next.delete("cursor")
  return next.toString()
}

function chip(key: string, value: string | null, label: string) {
  if (!value) return null
  return { key, value, label }
}
