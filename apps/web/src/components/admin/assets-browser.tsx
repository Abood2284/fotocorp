"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Search, LayoutGrid, Table2, ArrowRight } from "lucide-react"
import type { AdminAssetRecord } from "@/lib/fixtures/admin"
import { AssetStatusChip } from "@/components/admin/status-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface AssetsBrowserProps {
  records: AdminAssetRecord[]
  initialQuery?: string
}

type ViewMode = "table" | "grid"

export function AssetsBrowser({ records, initialQuery = "" }: AssetsBrowserProps) {
  const [query, setQuery] = useState(initialQuery)
  const [viewMode, setViewMode] = useState<ViewMode>("table")

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    if (!normalized) return records
    return records.filter((record) => {
      const haystack = [
        record.asset.id,
        record.asset.filename,
        record.asset.title ?? "",
        record.asset.category ?? "",
        ...record.asset.keywords,
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [records, query])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by id, filename, title or keyword"
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-medium ${viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <Table2 className="h-3.5 w-3.5" />
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-medium ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
        {records.length} assets
      </p>

      {viewMode === "table" ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Asset</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Mapped</th>
                <th className="px-3 py-2 text-left font-medium">Missing fields</th>
                <th className="px-3 py-2 text-left font-medium">Bucket key</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr key={record.asset.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div>
                      <p className="font-medium">{record.asset.title ?? record.asset.filename}</p>
                      <p className="text-xs text-muted-foreground">{record.asset.filename}</p>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <AssetStatusChip status={record.status} />
                  </td>
                  <td className="px-3 py-2">{record.mappedFields}/12</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {record.missingFields.length > 0 ? record.missingFields.join(", ") : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{record.bucketKey}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/assets/${record.asset.id}`}>
                      <Button variant="ghost" size="sm" className="gap-1">
                        Inspect <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((record) => (
            <Link key={record.asset.id} href={`/admin/assets/${record.asset.id}`} className="rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium leading-tight">{record.asset.title ?? record.asset.filename}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{record.asset.id}</p>
                </div>
                <AssetStatusChip status={record.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {record.asset.keywords.slice(0, 3).map((keyword, keywordIndex) => (
                  <Badge key={`${keyword}-${keywordIndex}`} variant="muted" className="text-[10px] capitalize">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
