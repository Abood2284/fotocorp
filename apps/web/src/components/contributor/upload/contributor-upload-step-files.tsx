"use client"

import { Loader2 } from "lucide-react"
import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import { ContributorUploadStepCard } from "@/components/contributor/upload/contributor-upload-layout"
import { formatFileSize, labelForStatus } from "@/components/contributor/upload/contributor-upload-utils"
import { getTrackedDisplayName, getTrackedSizeBytes } from "@/lib/upload-wizard-resume"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ContributorUploadStepFilesProps {
  active: boolean
  tracked: TrackedFile[]
  rejectedFiles: { file: File; reason: string }[]
  phase: "idle" | "running"
  onFilesPicked: (list: FileList | null) => void
  onRemoveFile: (key: string) => void
  onClearAll: () => void
  onRetryFailed: () => void
}

export function ContributorUploadStepFiles({
  active,
  tracked,
  rejectedFiles,
  phase,
  onFilesPicked,
  onRemoveFile,
  onClearAll,
  onRetryFailed,
}: ContributorUploadStepFilesProps) {
  const doneCount = tracked.filter((t) => t.status === "done").length
  const hasRetryableFailed = tracked.some((t) => t.status === "failed")

  return (
    <ContributorUploadStepCard active={active}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Images</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <input
              type="file"
              accept=".jpg,.jpeg,image/jpeg"
              multiple
              className="sr-only"
              disabled={phase === "running"}
              onChange={(e) => {
                onFilesPicked(e.target.files)
                e.target.value = ""
              }}
            />
            Add JPG files
          </label>
          {tracked.length > 0 ? (
            <Button type="button" variant="outline" size="sm" disabled={phase === "running"} onClick={onClearAll}>
              Clear
            </Button>
          ) : null}
          {hasRetryableFailed ? (
            <Button type="button" variant="secondary" size="sm" disabled={phase === "running"} onClick={onRetryFailed}>
              Retry failed
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "mb-4 flex min-h-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-colors",
          phase !== "running" && "hover:border-primary/40 hover:bg-muted/30",
        )}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (phase === "running") return
          onFilesPicked(e.dataTransfer.files)
        }}
      >
        <p className="text-sm font-medium text-foreground">Drop JPG files here</p>
        <p className="mt-1 text-xs text-muted-foreground">JPEG only · up to 50 MB each</p>
      </div>

      {rejectedFiles.length > 0 ? (
        <ul className="mb-4 space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {rejectedFiles.map((r) => (
            <li key={`${r.file.name}-${r.file.size}`}>
              <span className="font-medium">{r.file.name}</span> — {r.reason}
            </li>
          ))}
        </ul>
      ) : null}

      {tracked.length > 0 ? (
        <>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              {doneCount} of {tracked.length} uploaded
            </span>
            <span>Max 100 per batch</span>
          </div>
          <div className="max-h-[320px] overflow-y-auto rounded-lg border border-border">
            <ul className="divide-y divide-border">
              {tracked.map((row) => (
                <li
                  key={row.key}
                  className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="truncate font-medium text-foreground">{getTrackedDisplayName(row)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {formatFileSize(getTrackedSizeBytes(row))} · {labelForStatus(row.status)}
                    </p>
                    {row.status === "uploading" && row.uploadProgress !== null ? (
                      <div
                        className="mt-2 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-muted"
                        aria-label={`Upload ${row.uploadProgress}%`}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                          style={{ width: `${row.uploadProgress}%` }}
                        />
                      </div>
                    ) : null}
                    {row.errorMessage ? (
                      <p className="mt-1 text-[0.65rem] font-semibold text-destructive">{row.errorMessage}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {phase === "running" && row.status !== "done" && row.status !== "failed" ? (
                      <Loader2 className="animate-spin text-primary" aria-hidden size={16} />
                    ) : null}
                    {phase !== "running" && row.status !== "done" ? (
                      <button
                        type="button"
                        className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveFile(row.key)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </ContributorUploadStepCard>
  )
}
