"use client"

import { X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { ContributorUploadStepMetadata } from "@/components/contributor/upload/contributor-upload-step-metadata"
import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import { Button } from "@/components/ui/button"
import type {
  StaffContributorUploadBatchGroupDto,
  StaffContributorUploadDto,
} from "@/lib/api/staff-contributor-uploads-api"
import {
  patchStaffContributorUploadMetadata,
  staffUploadItemsToTrackedFiles,
  StaffContributorUploadMetadataError,
  trackedFilesToStaffUploadPatches,
} from "@/lib/staff-contributor-upload-metadata"
import { useUploadWizardMetadata } from "@/lib/use-upload-wizard-metadata"
import { useToastNotify } from "@/components/staff/shared/toast"
import type { MetadataImportSummary } from "@/lib/contributor-upload-metadata-import"

interface StaffContributorBatchMetadataEditorProps {
  batch: StaffContributorUploadBatchGroupDto
  open: boolean
  onClose: () => void
  onItemsPatch: (patches: Record<string, Partial<StaffContributorUploadDto>>) => void
}

export function StaffContributorBatchMetadataEditor({
  batch,
  open,
  onClose,
  onItemsPatch,
}: StaffContributorBatchMetadataEditorProps) {
  const { toast } = useToastNotify()
  const [tracked, setTracked] = useState<TrackedFile[]>([])
  const [metadataImportSummary, setMetadataImportSummary] = useState<MetadataImportSummary | null>(null)
  const [metadataImportError, setMetadataImportError] = useState<string | null>(null)
  const [metadataImportBusy, setMetadataImportBusy] = useState(false)

  const trackedRef = useRef(tracked)
  trackedRef.current = tracked

  const editableItems = batch.items.filter((item) => item.canApprove)
  const eventTitle = batch.event?.name ?? ""

  useEffect(() => {
    if (!open) return
    setTracked(staffUploadItemsToTrackedFiles(batch.items))
    setMetadataImportSummary(null)
    setMetadataImportError(null)
  }, [batch.batchId, batch.items, open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const updateTracked = useCallback((key: string, patch: Partial<TrackedFile>) => {
    setTracked((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }, [])

  const { bulkUpdateTracked, saveMetadataItem, handleMetadataImportFile } = useUploadWizardMetadata({
    batchId: batch.batchId,
    trackedRef,
    updateTracked,
    setTracked,
    patchMetadata: patchStaffContributorUploadMetadata,
    isConflictError: (error) =>
      error instanceof StaffContributorUploadMetadataError && error.code === "METADATA_CONFLICT",
    getConflictDetail: (error) => {
      if (!(error instanceof StaffContributorUploadMetadataError) || error.code !== "METADATA_CONFLICT") {
        return undefined
      }
      const d = error.detail as
        | {
            whoIsInPicture?: string | null
            caption?: string | null
            keywords?: string | null
            updatedAt?: string
          }
        | undefined
      return d
    },
    getErrorMessage: (error) =>
      error instanceof StaffContributorUploadMetadataError ? error.message : "Save failed.",
    toast,
    setMetadataImportSummary,
    setMetadataImportError,
    setMetadataImportBusy,
    importOverwriteOptions: { overwritePolicy: "overwrite" },
  })

  const handleClose = useCallback(() => {
    onItemsPatch(trackedFilesToStaffUploadPatches(trackedRef.current))
    onClose()
  }, [onClose, onItemsPatch])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Bulk edit metadata</h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {eventTitle || "Event"} · {editableItems.length} editable image
            {editableItems.length === 1 ? "" : "s"} · Batch {batch.batchId.slice(0, 8)}…
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleClose}>
          <X className="mr-1.5" size={16} />
          Done
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {editableItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No approvable images in this batch. Only submitted, private uploads can be bulk-edited.
          </p>
        ) : (
          <ContributorUploadStepMetadata
            active
            variant="staff-review"
            eventTitle={eventTitle}
            items={tracked}
            onSaveItem={saveMetadataItem}
            onBulkUpdate={bulkUpdateTracked}
            metadataImportSummary={metadataImportSummary}
            metadataImportError={metadataImportError}
            metadataImportBusy={metadataImportBusy}
            onImportMetadataFile={handleMetadataImportFile}
            onDone={handleClose}
            onSubmitBatch={() => undefined}
            submitDisabled
            submitBusy={false}
            submitError={null}
            onDismissSubmitError={() => undefined}
          />
        )}
      </div>
    </div>
  )
}
