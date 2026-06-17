"use client"

import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import { ContributorUploadStepCard } from "@/components/contributor/upload/contributor-upload-layout"
import { formatFileSize } from "@/components/contributor/upload/contributor-upload-utils"
import { getTrackedDisplayName, getTrackedSizeBytes } from "@/lib/upload-wizard-resume"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ContributorUploadStepCaricatureFilesProps {
  active: boolean
  tracked: TrackedFile[]
  rejectedFiles: { file: File; reason: string }[]
  onFilePicked: (list: FileList | null) => void
  onRemoveFile: () => void
}

export function ContributorUploadStepCaricatureFiles({
  active,
  tracked,
  rejectedFiles,
  onFilePicked,
  onRemoveFile,
}: ContributorUploadStepCaricatureFilesProps) {
  const row = tracked[0] ?? null

  return (
    <ContributorUploadStepCard active={active}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Caricature image</h2>
          <p className="mt-1 text-xs text-muted-foreground">Upload one JPG, PNG, or WebP file.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={!active}
            onChange={(event) => {
              onFilePicked(event.target.files)
              event.target.value = ""
            }}
          />
          {row ? "Replace file" : "Choose file"}
        </label>
      </div>

      <div
        className={cn(
          "mb-4 flex min-h-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-colors",
          active && "hover:border-primary/40 hover:bg-muted/30",
        )}
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (!active) return
          onFilePicked(event.dataTransfer.files)
        }}
      >
        {row ? (
          <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{getTrackedDisplayName(row)}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(getTrackedSizeBytes(row))}</p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={!active} onClick={onRemoveFile}>
              Remove
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">Drop a caricature file here</p>
            <p className="mt-1 text-xs text-muted-foreground">Original storage upload completes in the next release.</p>
          </>
        )}
      </div>

      {rejectedFiles.length > 0 ? (
        <ul className="space-y-1 text-xs text-destructive">
          {rejectedFiles.map((entry) => (
            <li key={`${entry.file.name}-${entry.reason}`}>{entry.reason}</li>
          ))}
        </ul>
      ) : null}
    </ContributorUploadStepCard>
  )
}
