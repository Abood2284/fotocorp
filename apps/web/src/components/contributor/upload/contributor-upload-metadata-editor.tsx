"use client"

import { ContributorUploadMetadataItem, type MetadataDraft } from "@/components/contributor/upload/contributor-upload-metadata-item"
import type { TrackedFile } from "@/components/contributor/contributor-upload-types"

interface MetadataEditorPanelProps {
  /** The currently selected tracked file, or null if nothing is selected */
  selectedRow: TrackedFile | null
  /** Called by the metadata item on save (debounced) */
  onSave: (draft: MetadataDraft) => Promise<void>
  /** Whether sync mode is active */
  syncMode: boolean
  /** Called immediately on keystroke when sync mode is active */
  onImmediateDraftChange?: (draft: MetadataDraft) => void
}

export function MetadataEditorPanel({
  selectedRow,
  onSave,
  syncMode,
  onImmediateDraftChange,
}: MetadataEditorPanelProps) {
  if (!selectedRow) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-border bg-card p-12">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Select an image to edit metadata</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Click a thumbnail in the grid to view and edit its details
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <ContributorUploadMetadataItem
        key={selectedRow.key}
        row={selectedRow}
        onSave={onSave}
        syncMode={syncMode}
        onImmediateDraftChange={onImmediateDraftChange}
      />
    </div>
  )
}
