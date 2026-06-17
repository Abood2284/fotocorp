"use client"

import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import type { MetadataDraft } from "@/components/contributor/upload/contributor-upload-metadata-item"
import type { MetadataImportSummary } from "@/lib/contributor-upload-metadata-import"
import { buildFillAllMetadataDraft, isFillAllDisabled } from "@/lib/upload-metadata-fill-all"
import { MetadataStickyToolbar } from "@/components/contributor/upload/contributor-upload-metadata-toolbar"
import { MetadataGridPanel } from "@/components/contributor/upload/contributor-upload-metadata-grid"
import { MetadataEditorPanel } from "@/components/contributor/upload/contributor-upload-metadata-editor"

/** Max concurrent API saves for bulk operations (fill-all / sync propagation). */
const BULK_SAVE_CONCURRENCY = 5

interface ContributorUploadStepMetadataProps {
  active: boolean
  variant?: "upload-wizard" | "staff-review" | "staff-catalog"
  /** Event title used by Fill All for caption, keywords, and who-is-in-picture. */
  eventTitle: string
  items: TrackedFile[]
  onSaveItem: (key: string, draft: MetadataDraft) => Promise<void>
  /** Bulk-update multiple tracked files locally (optimistic state before saves). */
  onBulkUpdate: (patches: Array<{ key: string; patch: Partial<TrackedFile> }>) => void
  /** Import-related */
  metadataImportSummary?: MetadataImportSummary | null
  metadataImportError?: string | null
  metadataImportBusy?: boolean
  onImportMetadataFile?: (file: File) => Promise<void>
  /** Submit */
  onSubmitBatch: () => void
  submitDisabled: boolean
  submitBusy: boolean
  submitError: string | null
  onDismissSubmitError: () => void
  /** Staff review: closes bulk editor (toolbar Done). */
  onDone?: () => void
}

export function ContributorUploadStepMetadata({
  active,
  variant = "upload-wizard",
  eventTitle,
  items,
  onSaveItem,
  onBulkUpdate,
  metadataImportSummary,
  metadataImportError,
  metadataImportBusy = false,
  onImportMetadataFile,
  onSubmitBatch,
  submitDisabled,
  submitBusy,
  submitError,
  onDismissSubmitError,
  onDone,
}: ContributorUploadStepMetadataProps) {
  const isStaffReview = variant === "staff-review" || variant === "staff-catalog"
  const isStaffCatalog = variant === "staff-catalog"
  /* ---- derived ---- */
  const completed = useMemo(
    () => items.filter((row) => row.status === "done" && row.imageAssetId),
    [items],
  )

  const hasAnyMetadata = useMemo(() => {
    const set = new Set<string>()
    for (const item of completed) {
      if (item.caption.trim() || item.keywords.trim() || item.whoIsInPicture.trim()) {
        set.add(item.key)
      }
    }
    return set
  }, [completed])

  /* ---- editor remount key: bumped when Fill All / sync targets the selected image ---- */
  const [editorResetKey, setEditorResetKey] = useState(0)

  /* ---- selection ---- */
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Auto-select first completed image when arriving at this step
  const didAutoSelect = useRef(false)
  useEffect(() => {
    if (!active) return
    if (didAutoSelect.current) return
    if (completed.length > 0) {
      setSelectedKey(completed[0]!.key)
      didAutoSelect.current = true
    }
  }, [active, completed])

  // Keep selectedKey valid if items change (e.g., image removed)
  useEffect(() => {
    if (selectedKey && !completed.some((r) => r.key === selectedKey)) {
      setSelectedKey(completed.length > 0 ? completed[0]!.key : null)
    }
  }, [completed, selectedKey])

  const selectedRow = useMemo(
    () => completed.find((r) => r.key === selectedKey) ?? null,
    [completed, selectedKey],
  )

  /* ---- sync mode ---- */
  const [syncMode, setSyncMode] = useState(false)

  const bulkSaveItems = useCallback(
    async (keys: string[], draft: MetadataDraft) => {
      const tasks = keys.map((key) => async () => {
        try {
          await onSaveItem(key, draft)
        } catch {
          // Surfaces via saveState per item
        }
      })
      await runWithConcurrency(tasks, BULK_SAVE_CONCURRENCY)
    },
    [onSaveItem],
  )

  /** Called by the metadata item on keystroke when sync mode is active. */
  const handleSyncDraftChange = useCallback(
    (draft: MetadataDraft) => {
      if (!selectedKey) return

      const otherKeys = completed
        .filter((r) => r.key !== selectedKey)
        .map((r) => r.key)

      if (otherKeys.length === 0) return

      const patches: Array<{ key: string; patch: Partial<TrackedFile> }> = otherKeys.map((key) => {
        const row = completed.find((r) => r.key === key)
        return {
          key,
          patch: {
            caption: draft.caption,
            keywords: draft.keywords,
            whoIsInPicture: draft.whoIsInPicture,
            metadataRevision: (row?.metadataRevision ?? 0) + 1,
          },
        }
      })

      onBulkUpdate(patches)
      void bulkSaveItems(otherKeys, draft)
    },
    [bulkSaveItems, completed, onBulkUpdate, selectedKey],
  )

  /* ---- fill-all ---- */
  const [fillAllBusy, setFillAllBusy] = useState(false)
  const fillAllValue = eventTitle.trim()
  const fillAllDisabled = isFillAllDisabled(eventTitle)

  const handleFillAll = useCallback(async () => {
    if (completed.length === 0 || fillAllDisabled) return

    setFillAllBusy(true)
    try {
      const draft = buildFillAllMetadataDraft(eventTitle)
      if (!draft) return

      const patches: Array<{ key: string; patch: Partial<TrackedFile> }> = completed.map((row) => ({
        key: row.key,
        patch: {
          caption: draft.caption,
          keywords: draft.keywords,
          whoIsInPicture: draft.whoIsInPicture,
          metadataRevision: (row.metadataRevision ?? 0) + 1,
        },
      }))

      onBulkUpdate(patches)

      if (selectedKey && completed.some((row) => row.key === selectedKey)) {
        setEditorResetKey((k) => k + 1)
      }

      const tasks = completed.map((row) => async () => {
        try {
          await onSaveItem(row.key, draft)
        } catch {
          // Individual save failures are surfaced by onSaveItem (sets saveState: error on the item)
        }
      })
      await runWithConcurrency(tasks, BULK_SAVE_CONCURRENCY)
    } finally {
      setFillAllBusy(false)
    }
  }, [completed, eventTitle, fillAllDisabled, onBulkUpdate, onSaveItem, selectedKey])

  /* ---- import summary helpers ---- */
  const skippedExistingCount = metadataImportSummary
    ? metadataImportSummary.skippedFields.filter((field) => field.reason === "existing_value").length
    : 0

  /* ---- submit gate ---- */
  const metadataCount = hasAnyMetadata.size
  const allHaveMetadata = completed.length > 0 && metadataCount === completed.length

  if (!active) return null

  return (
    <section className="relative mx-auto w-full max-w-6xl">
      {submitBusy ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-background/70 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
          aria-label="Submitting batch"
        >
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground shadow-sm">
            <Loader2 className="animate-spin text-primary" size={18} aria-hidden />
            Submitting batch…
          </div>
        </div>
      ) : null}

      {/* Header with import info */}
      <header className="mb-4 text-center">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Image metadata</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isStaffCatalog ? (
            <>
              Bulk-edit live catalog metadata. Spreadsheet import{" "}
              <span className="font-medium">overwrites</span> existing values. Put{" "}
              <span className="font-medium">original upload filenames</span> in{" "}
              <code className="text-xs">image_codes</code> (e.g.{" "}
              <span className="font-medium">a114.JPG</span>). Fotokey is only a fallback for legacy assets without an
              upload filename. Bulk edit must stay within one event so filenames stay unique. Changes save automatically
              after you pause typing.
            </>
          ) : isStaffReview ? (
            <>
              Bulk-edit captions before approval. Spreadsheet import <span className="font-medium">overwrites</span>{" "}
              existing values. Changes save automatically after you pause typing.
            </>
          ) : (
            <>
              Add details for each upload. Changes save automatically after you pause typing.
              {fillAllValue ? (
                <>
                  {" "}
                  Fill All prefills from event: <span className="font-medium text-foreground">{fillAllValue}</span>.
                </>
              ) : null}
            </>
          )}
        </p>
      </header>

      {/* Import error */}
      {metadataImportError ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {metadataImportError}
        </div>
      ) : null}

      {/* Import summary */}
      {metadataImportSummary ? (
        <MetadataImportSummaryCard
          summary={metadataImportSummary}
          skippedExistingCount={skippedExistingCount}
        />
      ) : null}

      {/* Sticky toolbar */}
      <MetadataStickyToolbar
        variant={variant}
        imageCount={completed.length}
        metadataCount={metadataCount}
        onFillAll={() => void handleFillAll()}
        fillAllBusy={fillAllBusy}
        fillAllDisabled={fillAllDisabled}
        syncMode={syncMode}
        onToggleSync={() => setSyncMode((v) => !v)}
        onImportMetadataFile={onImportMetadataFile}
        metadataImportBusy={metadataImportBusy}
        submitDisabled={
          isStaffReview ? false : submitDisabled || (completed.length > 0 && !allHaveMetadata)
        }
        submitBusy={submitBusy}
        submitError={submitError}
        onSubmit={onSubmitBatch}
        onDismissSubmitError={onDismissSubmitError}
        onDone={onDone}
      />

      {/* Two-panel layout */}
      {completed.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {isStaffCatalog ? "No assets available for metadata editing." : "Upload at least one image to add metadata."}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-12">
          {/* Left: Thumbnail grid */}
          <div className="lg:col-span-5 xl:col-span-4">
            <MetadataGridPanel
              items={completed}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              hasAnyMetadata={hasAnyMetadata}
            />
          </div>

          {/* Right: Metadata editor */}
          <div className="lg:col-span-7 xl:col-span-8" id="metadata-editor-panel">
            <MetadataEditorPanel
              key={`${selectedRow?.key ?? 'none'}--r${editorResetKey}`}
              selectedRow={selectedRow}
              onSave={(draft) => onSaveItem(selectedRow!.key, draft)}
              syncMode={syncMode}
              onImmediateDraftChange={syncMode ? handleSyncDraftChange : undefined}
            />
          </div>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Run async tasks with a concurrency limit. */
async function runWithConcurrency(tasks: Array<() => Promise<void>>, limit: number) {
  const queue = [...tasks]
  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift()
      if (task) await task()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
}

/* ------------------------------------------------------------------ */
/* Import summary card (carried over from old implementation)           */
/* ------------------------------------------------------------------ */

function MetadataImportSummaryCard({
  summary,
  skippedExistingCount,
}: {
  summary: MetadataImportSummary
  skippedExistingCount: number
}) {
  const previewNotFound = summary.notFoundCodes.slice(0, 10)
  const remainingNotFound = summary.notFoundCodes.length - previewNotFound.length

  return (
    <div className="mb-4 rounded-xl border border-border bg-card px-4 py-4 text-sm shadow-sm sm:px-5">
      <p className="font-semibold text-foreground">Import summary</p>
      <p className="mt-1 truncate text-muted-foreground" title={summary.fileName}>
        {summary.fileName}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <SummaryStat label="Matched" value={summary.matchedImageCount} />
        <SummaryStat label="Updated" value={summary.updatedImageCount} />
        <SummaryStat label="Saved" value={summary.savedCount} />
        <SummaryStat label="Not found" value={summary.notFoundCodes.length} />
        <SummaryStat label="Skipped existing" value={skippedExistingCount} />
        <SummaryStat label="Duplicate codes" value={summary.duplicateCodes.length} />
        <SummaryStat label="Ambiguous codes" value={summary.ambiguousCodes.length} />
        <SummaryStat label="Save failures" value={summary.saveFailureCount} />
      </dl>

      {summary.notFoundCodes.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Not found image codes</p>
          <ul className="mt-2 space-y-1 text-xs text-foreground">
            {previewNotFound.map((entry) => (
              <li key={`${entry.sourceRowNumber}-${entry.imageCode}`}>
                Row {entry.sourceRowNumber}: {entry.imageCode}
              </li>
            ))}
            {remainingNotFound > 0 ? <li className="text-muted-foreground">+{remainingNotFound} more</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
