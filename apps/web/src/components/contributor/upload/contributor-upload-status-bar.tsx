"use client"

import type { FileUiStatus } from "@/components/contributor/contributor-upload-types"
import { cn } from "@/lib/utils"

interface ContributorUploadStatusBarProps {
  fileCount: number
  totalBytes: number
  batchPhase: "idle" | "running"
  fileStatuses: FileUiStatus[]
  batchStatus?: string | null
  readyImageCount?: number
  className?: string
}

export function ContributorUploadStatusBar({
  fileCount,
  totalBytes,
  batchPhase,
  fileStatuses,
  batchStatus,
  readyImageCount,
  className,
}: ContributorUploadStatusBarProps) {
  const aggregate = aggregateBatchState(fileCount, batchPhase, fileStatuses)

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground sm:px-4 sm:py-3 sm:text-base",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="tabular-nums">
          {fileCount > 0 ? (
            <>
              {fileCount} {fileCount === 1 ? "file" : "files"} · {formatFileSize(totalBytes)}
            </>
          ) : readyImageCount !== undefined ? (
            <>{readyImageCount} {readyImageCount === 1 ? "image" : "images"} ready</>
          ) : (
            "No files yet"
          )}
        </span>
        <span className={cn("font-semibold uppercase tracking-wide", stateTone(aggregate))}>{aggregate}</span>
      </div>
      {batchStatus ? (
        <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">Batch · {batchStatus}</p>
      ) : null}
    </div>
  )
}

function aggregateBatchState(
  fileCount: number,
  batchPhase: "idle" | "running",
  statuses: FileUiStatus[],
): string {
  if (fileCount === 0) return "Waiting"
  if (batchPhase === "running" || statuses.some((s) => s === "uploading" || s === "finalizing" || s === "preparing")) {
    if (statuses.some((s) => s === "uploading")) return "Uploading"
    if (statuses.some((s) => s === "finalizing")) return "Finalizing"
    if (statuses.some((s) => s === "preparing")) return "Preparing"
    return "Uploading"
  }
  if (statuses.every((s) => s === "done")) return "Ready"
  if (statuses.some((s) => s === "ready")) return "Ready"
  if (statuses.some((s) => s === "failed")) return "Needs attention"
  return "Waiting"
}

function stateTone(state: string) {
  if (state === "Uploading" || state === "Preparing" || state === "Finalizing") return "text-primary"
  if (state === "Ready") return "text-foreground"
  if (state === "Needs attention") return "text-destructive"
  return "text-muted-foreground"
}

function formatFileSize(bytes: number) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes > 0) return `${(bytes / 1024).toFixed(1)} KB`
  return "0 KB"
}
