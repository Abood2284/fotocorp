"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"

import { fetchJobsPipelineSnapshot } from "@/lib/api/staff-pipeline-api"
import type {
  JobsPipelineActiveWorkItem,
  JobsPipelineQueueCounts,
  JobsPipelineSnapshot,
} from "@/lib/api/staff-pipeline-types"
import { WakeJobsWorkerButton } from "@/components/staff/pipeline/wake-jobs-worker-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"

interface StaffPipelineClientProps {
  initialAssetIdFilter?: string | null
}

const AUTO_REFRESH_MS = 15_000

export function StaffPipelineClient({ initialAssetIdFilter }: StaffPipelineClientProps) {
  const [snapshot, setSnapshot] = useState<JobsPipelineSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [assetIdFilter, setAssetIdFilter] = useState(initialAssetIdFilter ?? "")
  const [wakeMessage, setWakeMessage] = useState<string | null>(null)
  const [wakeError, setWakeError] = useState<string | null>(null)

  const loadSnapshot = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") setIsLoading(true)
    else setIsRefreshing(true)
    setError(null)
    try {
      const data = await fetchJobsPipelineSnapshot()
      setSnapshot(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load pipeline snapshot.")
    } finally {
      if (mode === "initial") setIsLoading(false)
      else setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadSnapshot("initial")
  }, [loadSnapshot])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => {
      void loadSnapshot("refresh")
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [autoRefresh, loadSnapshot])

  const filteredActiveWork = useMemo(() => {
    if (!snapshot) return []
    const filter = assetIdFilter.trim()
    if (!filter) return snapshot.activeWork
    return snapshot.activeWork.filter(
      (item) => item.imageAssetId === filter || item.caricatureAssetId === filter,
    )
  }, [assetIdFilter, snapshot])

  const totalQueued = useMemo(() => {
    if (!snapshot) return 0
    return (
      snapshot.queues.catalogPreviewRegen.queued
      + snapshot.queues.imagePublishItems.queued
      + snapshot.queues.caricaturePreview.queued
    )
  }, [snapshot])

  if (isLoading && !snapshot) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    )
  }

  if (error && !snapshot) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load pipeline"
        description={error}
        action={{ label: "Retry", onClick: () => void loadSnapshot("initial") }}
      />
    )
  }

  if (!snapshot) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadSnapshot("refresh")}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {isRefreshing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <WakeJobsWorkerButton
            label={totalQueued > 0 ? `Process queue now (${totalQueued})` : "Process queue now"}
            onWakeComplete={(message, ok, drainSummary) => {
              setWakeMessage(ok ? message : null)
              setWakeError(ok ? null : drainSummary
                ? `${message} (pending ${drainSummary.pendingAtStart} → ${drainSummary.pendingAtEnd}, processed ${drainSummary.processed}, stopReason=${drainSummary.stopReason})`
                : message)
              if (ok) void loadSnapshot("refresh")
            }}
          />
          <label className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="rounded border-input"
            />
            Auto-refresh every 15s
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Snapshot at {formatTimestamp(snapshot.generatedAt)}
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {wakeMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {wakeMessage}
        </div>
      ) : null}

      {wakeError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {wakeError}
        </div>
      ) : null}

      <WorkerStatusCard worker={snapshot.worker} queuedCount={totalQueued} />

      <div className="grid gap-4 md:grid-cols-3">
        <QueueSummaryCard title="Catalog preview regen" counts={snapshot.queues.catalogPreviewRegen} />
        <QueueSummaryCard title="Image publish items" counts={snapshot.queues.imagePublishItems} />
        <QueueSummaryCard title="Caricature preview" counts={snapshot.queues.caricaturePreview} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={assetIdFilter}
              onChange={(event) => setAssetIdFilter(event.target.value)}
              placeholder="Filter by asset ID"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-md"
            />
            {assetIdFilter.trim() ? (
              <button
                type="button"
                onClick={() => setAssetIdFilter("")}
                className="text-sm font-medium text-primary hover:underline"
              >
                Clear filter
              </button>
            ) : null}
          </div>

          {filteredActiveWork.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {assetIdFilter.trim()
                ? "No active jobs match this asset ID."
                : "No queued or running jobs right now."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Kind</th>
                    <th className="px-2 py-2 font-medium">Asset</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Queued</th>
                    <th className="px-2 py-2 font-medium">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActiveWork.map((item) => (
                    <ActiveWorkRow key={`${item.kind}-${item.jobId}-${item.itemId ?? "root"}`} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent derivative updates</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshot.recentDerivativeUpdates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent derivative activity recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Asset</th>
                    <th className="px-2 py-2 font-medium">Variant</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.recentDerivativeUpdates.map((row) => (
                    <tr key={`${row.assetId}-${row.variant}-${row.updatedAt ?? "na"}`} className="border-b border-border/60">
                      <td className="px-2 py-2">
                        <AssetIdentityLink
                          assetId={row.assetId}
                          fotokey={row.fotokey}
                          legacyImageCode={row.legacyImageCode}
                        />
                      </td>
                      <td className="px-2 py-2 uppercase">{row.variant}</td>
                      <td className="px-2 py-2">
                        <Badge variant={row.generationStatus === "READY" ? "success" : "muted"}>
                          {row.generationStatus}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{formatTimestamp(row.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function WorkerStatusCard({
  worker,
  queuedCount,
}: {
  worker: JobsPipelineSnapshot["worker"]
  queuedCount: number
}) {
  let label = "Worker status unknown"
  let detail = "Could not reach the jobs wake server health endpoint."
  let healthy = false

  if (worker.reachable) {
    if (worker.drainInProgress === true) {
      label = "Worker draining jobs"
      detail = "The jobs worker is actively processing queued work."
      healthy = true
    } else if (worker.drainInProgress === false) {
      label = queuedCount > 0 ? "Worker idle with queued jobs" : "Worker idle"
      detail = queuedCount > 0
        ? `${queuedCount} job(s) are queued but the worker is not draining. Use Process queue now to wake it. Regenerate previews only enqueues work — the VPS worker generates derivatives.`
        : "The jobs worker is reachable and not currently draining."
      healthy = true
    } else {
      label = "Worker reachable"
      detail = "Health endpoint responded without drain status."
      healthy = true
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Worker</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-2">
          {!healthy ? <AlertTriangle className="mt-0.5 text-amber-600" size={16} /> : null}
          <div>
            <p className="font-medium">{label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QueueSummaryCard({ title, counts }: { title: string; counts: JobsPipelineQueueCounts }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-semibold">{counts.queued}</p>
          <p className="text-xs text-muted-foreground">Queued</p>
        </div>
        <div>
          <p className="text-lg font-semibold">{counts.running}</p>
          <p className="text-xs text-muted-foreground">Running</p>
        </div>
        <div>
          <p className="text-lg font-semibold">{counts.failedLast24h}</p>
          <p className="text-xs text-muted-foreground">Failed (24h)</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ActiveWorkRow({ item }: { item: JobsPipelineActiveWorkItem }) {
  const assetId = item.imageAssetId ?? item.caricatureAssetId
  return (
    <tr className="border-b border-border/60">
      <td className="px-2 py-2">{formatWorkKind(item.kind)}</td>
      <td className="px-2 py-2">
        {assetId ? (
          <AssetIdentityLink
            assetId={assetId}
            fotokey={item.fotokey}
            legacyImageCode={item.legacyImageCode ?? item.importFileName}
            href={item.imageAssetId ? `/staff/catalog?asset=${item.imageAssetId}` : undefined}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-2">
        <Badge variant={item.status === "RUNNING" ? "warning" : "muted"}>{item.status}</Badge>
      </td>
      <td className="px-2 py-2 text-muted-foreground">{formatTimestamp(item.createdAt)}</td>
      <td className="px-2 py-2 text-muted-foreground">{formatTimestamp(item.startedAt)}</td>
    </tr>
  )
}

function AssetIdentityLink({
  assetId,
  fotokey,
  legacyImageCode,
  href,
}: {
  assetId: string
  fotokey: string | null
  legacyImageCode: string | null
  href?: string
}) {
  const label = fotokey ?? legacyImageCode ?? assetId.slice(0, 8)
  const linkHref = href ?? `/staff/pipeline?assetId=${encodeURIComponent(assetId)}`
  return (
    <Link href={linkHref} className="font-medium text-primary hover:underline">
      {label}
    </Link>
  )
}

function formatWorkKind(kind: JobsPipelineActiveWorkItem["kind"]): string {
  if (kind === "catalog_preview_regen") return "Catalog regen"
  if (kind === "image_publish_item") return "Publish item"
  return "Caricature preview"
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
