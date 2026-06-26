"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

import type { AdminCatalogAssetItem, AdminCatalogPreviewRegenerationJob } from "@/features/assets/admin-catalog-types"
import { Badge } from "@/components/ui/badge"
import { WakeJobsWorkerButton } from "@/components/staff/pipeline/wake-jobs-worker-button"
import {
  getCatalogRegenerationTargetVariants,
  isCatalogPreviewRegenerationActive,
  isCatalogPreviewRegenerationFailed,
  isStaleQueuedRegeneration,
} from "@/lib/staff-catalog-preview-status"

interface CatalogPreviewRegenerationProgressProps {
  asset: AdminCatalogAssetItem
}

export function CatalogPreviewRegenerationProgress({ asset }: CatalogPreviewRegenerationProgressProps) {
  const job = asset.previewRegenerationJob
  const isActive = isCatalogPreviewRegenerationActive(asset)
  const isFailed = isCatalogPreviewRegenerationFailed(asset)
  const [wakeMessage, setWakeMessage] = useState<string | null>(null)
  const [wakeError, setWakeError] = useState<string | null>(null)

  if (!job && !isActive && !isFailed) return null
  if (!job && isActive) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Regeneration progress</p>
        <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
          <Loader2 className="animate-spin" size={14} />
          Processing…
        </p>
      </div>
    )
  }
  if (!job) return null

  const targetVariants = getCatalogRegenerationTargetVariants(asset)
  const staleQueued = job.status === "QUEUED" && isStaleQueuedRegeneration(job.createdAt)
  const pipelineHref = `/staff/pipeline?assetId=${encodeURIComponent(asset.id)}`

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Regeneration progress</p>
        <RegenerationStatusBadge status={job.status} />
      </div>

      {job.status === "QUEUED" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Queued for the jobs worker — derivatives are not generated in the browser.
            {job.createdAt ? (
              <span className="block text-xs mt-0.5">Queued {formatRelativeTime(job.createdAt)}</span>
            ) : null}
          </p>
          <WakeJobsWorkerButton
            label="Start worker for this queue"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            onWakeComplete={(message, ok) => {
              setWakeMessage(ok ? message : null)
              setWakeError(ok ? null : message)
            }}
          />
        </div>
      ) : null}

      {wakeMessage ? (
        <p className="text-xs text-emerald-700">{wakeMessage}</p>
      ) : null}
      {wakeError ? (
        <p className="text-xs text-rose-700">{wakeError}</p>
      ) : null}

      {job.status === "RUNNING" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <Loader2 className="animate-spin" size={14} />
            Worker processing this asset
          </p>
          <p className="text-xs text-muted-foreground">
            Variants update together when the worker finishes this job.
          </p>
        </div>
      ) : null}

      {(isActive || isFailed) && targetVariants.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Target variants</p>
          {targetVariants.map((variant) => (
            <VariantProgressRow
              key={variant}
              variant={variant}
              derivativeState={asset.derivatives[variant].state}
              jobStatus={job.status}
            />
          ))}
        </div>
      ) : null}

      {isFailed ? (
        <div className="rounded border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-800">
          {job.failureMessage ?? "Preview regeneration failed."}
        </div>
      ) : null}

      {staleQueued ? (
        <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={14} />
          <div>
            <p>Queued for over 2 minutes — the worker may be busy or offline.</p>
            <Link href={pipelineHref} className="mt-1 inline-block font-medium text-primary hover:underline">
              Open Pipeline
            </Link>
          </div>
        </div>
      ) : isActive || isFailed ? (
        <Link href={pipelineHref} className="text-xs font-medium text-primary hover:underline">
          View in Pipeline
        </Link>
      ) : null}
    </div>
  )
}

function RegenerationStatusBadge({ status }: { status: AdminCatalogPreviewRegenerationJob["status"] }) {
  if (status === "QUEUED") return <Badge variant="warning">Queued</Badge>
  if (status === "RUNNING") return <Badge variant="warning">Running</Badge>
  if (status === "FAILED") return <Badge variant="destructive">Failed</Badge>
  if (status === "COMPLETED") return <Badge variant="success">Completed</Badge>
  return <Badge variant="muted">{String(status)}</Badge>
}

function VariantProgressRow({
  variant,
  derivativeState,
  jobStatus,
}: {
  variant: "thumb" | "card" | "detail"
  derivativeState: AdminCatalogAssetItem["derivatives"]["thumb"]["state"]
  jobStatus: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED"
}) {
  const label = variant.toUpperCase()
  if (derivativeState === "READY") {
    return (
      <div className="flex items-center justify-between rounded border border-border bg-background px-2.5 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        <Badge variant="success">Ready</Badge>
      </div>
    )
  }
  if (derivativeState === "FAILED") {
    return (
      <div className="flex items-center justify-between rounded border border-border bg-background px-2.5 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        <Badge variant="destructive">Failed</Badge>
      </div>
    )
  }
  const pendingLabel = jobStatus === "QUEUED" ? "Waiting" : "Pending"
  return (
    <div className="flex items-center justify-between rounded border border-border bg-background px-2.5 py-1.5">
      <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        {jobStatus === "RUNNING" ? <Loader2 className="animate-spin" size={12} /> : null}
        {pendingLabel}
      </span>
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  const deltaSec = Math.round((Date.now() - ms) / 1000)
  if (deltaSec < 60) return `${Math.max(deltaSec, 1)}s ago`
  const deltaMin = Math.round(deltaSec / 60)
  if (deltaMin < 60) return `${deltaMin}m ago`
  const deltaHr = Math.round(deltaMin / 60)
  return `${deltaHr}h ago`
}
