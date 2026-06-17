"use client"

import { X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { ContributorUploadStepMetadata } from "@/components/contributor/upload/contributor-upload-step-metadata"
import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import { Button } from "@/components/ui/button"
import { updateAdminAssetEditorialAction } from "@/app/(staff)/staff/(workspace)/catalog/actions"
import type { AdminCatalogAssetItem } from "@/features/assets/admin-catalog-types"
import type { MetadataImportSummary } from "@/lib/contributor-upload-metadata-import"
import { keywordsToTags } from "@/lib/contributor-upload-metadata"
import {
  CATALOG_METADATA_BATCH_ID,
  catalogAssetsToTrackedFiles,
  resolveCatalogBulkEditScope,
  resolveCatalogBulkEventTitle,
  trackedFilesToCatalogPatches,
} from "@/lib/staff-catalog-metadata"
import { useUploadWizardMetadata, type UploadWizardMetadataPatchBody } from "@/lib/use-upload-wizard-metadata"
import { useToastNotify } from "@/components/staff/shared/toast"

async function patchCatalogAssetMetadata(
  asset: AdminCatalogAssetItem,
  body: UploadWizardMetadataPatchBody,
): Promise<{ updatedAt: string }> {
  const result = await updateAdminAssetEditorialAction(asset.id, {
    whoIsInPicture: body.whoIsInPicture ?? null,
    headline: asset.headline,
    caption: body.caption ?? null,
    description: asset.description,
    keywords: body.keywords ? keywordsToTags(body.keywords) : null,
    categoryId: asset.category?.id ?? null,
    eventId: asset.event?.id ?? null,
    contributorId: asset.contributor?.id ?? null,
  })

  return { updatedAt: result.asset.updatedAt ?? new Date().toISOString() }
}

interface StaffCatalogBulkMetadataEditorProps {
  assets: AdminCatalogAssetItem[]
  open: boolean
  onClose: () => void
  onAssetsPatch: (patches: Record<string, Partial<AdminCatalogAssetItem>>) => void
}

export function StaffCatalogBulkMetadataEditor({
  assets,
  open,
  onClose,
  onAssetsPatch,
}: StaffCatalogBulkMetadataEditorProps) {
  const { toast } = useToastNotify()
  const [tracked, setTracked] = useState<TrackedFile[]>([])
  const [metadataImportSummary, setMetadataImportSummary] = useState<MetadataImportSummary | null>(null)
  const [metadataImportError, setMetadataImportError] = useState<string | null>(null)
  const [metadataImportBusy, setMetadataImportBusy] = useState(false)

  const trackedRef = useRef(tracked)
  trackedRef.current = tracked

  const assetSnapshotRef = useRef<Map<string, AdminCatalogAssetItem>>(new Map())
  const bulkEditScope = resolveCatalogBulkEditScope(assets)
  const eventTitle = bulkEditScope.eventTitle ?? resolveCatalogBulkEventTitle(assets)

  useEffect(() => {
    if (!open) return
    const snapshot = new Map<string, AdminCatalogAssetItem>()
    for (const asset of assets) snapshot.set(asset.id, asset)
    assetSnapshotRef.current = snapshot
    setTracked(catalogAssetsToTrackedFiles(assets))
    setMetadataImportSummary(null)
    setMetadataImportError(null)
  }, [assets, open])

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

  const patchMetadata = useCallback(
    async (_batchId: string, imageAssetId: string, body: Parameters<typeof patchCatalogAssetMetadata>[1]) => {
      const asset = assetSnapshotRef.current.get(imageAssetId)
      if (!asset) throw new Error("Asset not found.")
      const result = await patchCatalogAssetMetadata(asset, body)
      assetSnapshotRef.current.set(imageAssetId, {
        ...asset,
        whoIsInPicture: body.whoIsInPicture ?? null,
        caption: body.caption ?? null,
        keywords: body.keywords ?? null,
        updatedAt: result.updatedAt,
      })
      return result
    },
    [],
  )

  const { bulkUpdateTracked, saveMetadataItem, handleMetadataImportFile } = useUploadWizardMetadata({
    batchId: CATALOG_METADATA_BATCH_ID,
    trackedRef,
    updateTracked,
    setTracked,
    patchMetadata,
    isConflictError: () => false,
    getConflictDetail: () => undefined,
    getErrorMessage: (error) => (error instanceof Error ? error.message : "Save failed."),
    toast,
    setMetadataImportSummary,
    setMetadataImportError,
    setMetadataImportBusy,
    importOverwriteOptions: {
      overwritePolicy: "overwrite",
      treatPlaceholdersAsEmpty: true,
      matchKey: "original_filename_first",
    },
  })

  const handleClose = useCallback(() => {
    onAssetsPatch(trackedFilesToCatalogPatches(trackedRef.current))
    onClose()
  }, [onAssetsPatch, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Bulk edit metadata</h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            Catalog · {assets.length} selected asset{assets.length === 1 ? "" : "s"}
            {eventTitle ? ` · ${eventTitle}` : ""}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleClose}>
          <X className="mr-1.5" size={16} />
          Done
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Select at least one catalog asset to bulk-edit metadata.</p>
        ) : !bulkEditScope.ok ? (
          <div
            role="alert"
            className="mx-auto max-w-2xl rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-foreground"
          >
            <p className="font-medium">Bulk metadata edit is blocked for this selection.</p>
            <p className="mt-2 text-muted-foreground">{bulkEditScope.blockReason}</p>
            <p className="mt-3 text-muted-foreground">
              Spreadsheet import matches on original upload filenames (for example <span className="font-medium">a114.JPG</span>
              ). Those names can repeat across events, so bulk edit must stay within one event with unique match names.
            </p>
          </div>
        ) : (
          <ContributorUploadStepMetadata
            active
            variant="staff-catalog"
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
