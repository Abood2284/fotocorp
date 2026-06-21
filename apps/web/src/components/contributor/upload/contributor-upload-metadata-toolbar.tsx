"use client"

import { CheckCircle, Globe, Link2, Loader2, Upload } from "lucide-react"
import { useRef } from "react"
import { cn } from "@/lib/utils"

interface MetadataStickyToolbarProps {
  variant?: "upload-wizard" | "staff-review" | "staff-catalog"
  /** Total number of completed (uploaded) images */
  imageCount: number
  /** Number of images that have at least one metadata field filled */
  metadataCount: number
  /** Fill-all handler */
  onFillAll: () => void
  fillAllBusy: boolean
  fillAllDisabled?: boolean
  /** Sync mode */
  syncMode: boolean
  onToggleSync: () => void
  /** Import */
  onImportMetadataFile?: (file: File) => Promise<void>
  metadataImportBusy?: boolean
  /** Submit */
  submitDisabled: boolean
  submitBusy: boolean
  submitError: string | null
  onSubmit: () => void
  onDismissSubmitError: () => void
  onDone?: () => void
}

export function MetadataStickyToolbar({
  variant = "upload-wizard",
  imageCount,
  metadataCount,
  onFillAll,
  fillAllBusy,
  fillAllDisabled = false,
  syncMode,
  onToggleSync,
  onImportMetadataFile,
  metadataImportBusy = false,
  submitDisabled,
  submitBusy,
  submitError,
  onSubmit,
  onDismissSubmitError,
  onDone,
}: MetadataStickyToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const missingCount = imageCount - metadataCount
  const isStaffReview = variant === "staff-review" || variant === "staff-catalog"

  return (
    <div className="space-y-3">
      {/* Main toolbar row */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
        {/* Import CSV/XLSX */}
        {onImportMetadataFile ? (
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/40",
              metadataImportBusy && "cursor-not-allowed opacity-60",
            )}
          >
            {metadataImportBusy ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Upload size={14} />
            )}
            {metadataImportBusy ? "Importing…" : "Import CSV/XLSX"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              disabled={metadataImportBusy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onImportMetadataFile(file)
                e.target.value = ""
              }}
            />
          </label>
        ) : null}

        {/* Fill All */}
        <button
          type="button"
          onClick={onFillAll}
          disabled={fillAllBusy || fillAllDisabled || imageCount === 0}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/40",
            (fillAllBusy || fillAllDisabled || imageCount === 0) && "cursor-not-allowed opacity-60",
          )}
        >
          {fillAllBusy ? <Loader2 className="animate-spin" size={14} /> : <Globe size={14} />}
          {fillAllBusy ? "Filling…" : `Fill All (${imageCount})`}
        </button>

        {/* Sync Mode */}
        <button
          type="button"
          onClick={onToggleSync}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            syncMode
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-foreground hover:bg-muted/40",
          )}
        >
          <Link2 size={14} />
          Sync Mode
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Metadata progress */}
        <div className="flex items-center gap-1.5 text-xs">
          {missingCount === 0 ? (
            <CheckCircle size={14} className="text-emerald-500" />
          ) : (
            <span className="inline-block  rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
              {metadataCount}/{imageCount}
            </span>
          )}
          <span className={cn("text-muted-foreground", missingCount === 0 && "text-emerald-600")}>
            {missingCount === 0 ? "All images have metadata" : `${metadataCount} of ${imageCount} have metadata`}
          </span>
        </div>

        {/* Primary action */}
        {isStaffReview ? (
          <button
            type="button"
            onClick={onDone}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            disabled={submitDisabled || submitBusy}
            aria-busy={submitBusy}
            onClick={() => {
              onDismissSubmitError()
              onSubmit()
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors",
              submitBusy
                ? "cursor-wait bg-primary text-primary-foreground opacity-90"
                : submitDisabled
                  ? "cursor-not-allowed bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {submitBusy ? (
              <>
                <Loader2 className="animate-spin" size={14} aria-hidden />
                Submitting…
              </>
            ) : (
              <>
                Submit batch
                {missingCount > 0 ? ` (${missingCount} missing)` : ""}
              </>
            )}
          </button>
        )}
      </div>

      {/* Submit error */}
      {submitError ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
          <button
            type="button"
            onClick={onDismissSubmitError}
            className="ml-2 text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Sync mode banner */}
      {syncMode && imageCount > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary">
          <Link2 size={14} />
          Sync mode active — editing any field copies its value to caption, keywords, and who is in picture on the selected image only
        </div>
      ) : null}
    </div>
  )
}
