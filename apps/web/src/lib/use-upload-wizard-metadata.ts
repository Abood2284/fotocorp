"use client"

import { useCallback, type Dispatch, type RefObject, type SetStateAction } from "react"
import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import type { MetadataDraft } from "@/components/contributor/upload/contributor-upload-metadata-item"
import { keywordsToTags, normalizeWhoIsInPicture, tagsToKeywords } from "@/lib/contributor-upload-metadata"
import { refreshStoredPreviewUrlVersion } from "@/lib/upload-wizard-resume"
import {
  executeMetadataImport,
  type ImportOverwriteOptions,
  type MetadataImportSummary,
} from "@/lib/contributor-upload-metadata-import"

export interface MetadataConflictDetail {
  whoIsInPicture?: string | null
  caption?: string | null
  keywords?: string | null
  updatedAt?: string
}

export interface UploadWizardMetadataPatchBody {
  expectedUpdatedAt?: string
  whoIsInPicture?: string | null
  caption?: string | null
  keywords?: string | null
}

interface UseUploadWizardMetadataOptions {
  batchId: string | null
  trackedRef: RefObject<TrackedFile[]>
  updateTracked: (key: string, patch: Partial<TrackedFile>) => void
  setTracked: Dispatch<SetStateAction<TrackedFile[]>>
  patchMetadata: (
    batchId: string,
    imageAssetId: string,
    body: UploadWizardMetadataPatchBody,
  ) => Promise<{ updatedAt: string }>
  isConflictError: (error: unknown) => boolean
  getConflictDetail: (error: unknown) => MetadataConflictDetail | undefined
  getErrorMessage: (error: unknown) => string
  toast: (options: { message: string; variant: "success" | "error" }) => void
  setMetadataImportSummary: (summary: MetadataImportSummary | null) => void
  setMetadataImportError: (message: string | null) => void
  setMetadataImportBusy: (busy: boolean) => void
  /** Defaults to fill_empty_only for upload wizards; staff bulk edit passes overwrite. */
  importOverwriteOptions?: ImportOverwriteOptions
}

export function useUploadWizardMetadata({
  batchId,
  trackedRef,
  updateTracked,
  setTracked,
  patchMetadata,
  isConflictError,
  getConflictDetail,
  getErrorMessage,
  toast,
  setMetadataImportSummary,
  setMetadataImportError,
  setMetadataImportBusy,
  importOverwriteOptions,
}: UseUploadWizardMetadataOptions) {
  const bulkUpdateTracked = useCallback(
    (patches: Array<{ key: string; patch: Partial<TrackedFile> }>) => {
      if (patches.length === 0) return
      setTracked((prev) => {
        const map = new Map(prev.map((r) => [r.key, r]))
        for (const { key, patch } of patches) {
          const existing = map.get(key)
          if (existing) map.set(key, { ...existing, ...patch })
        }
        return Array.from(map.values())
      })
    },
    [setTracked],
  )

  const saveMetadataItem = useCallback(
    async (key: string, draft: MetadataDraft) => {
      const row = trackedRef.current.find((r) => r.key === key)
      if (!row?.imageAssetId || !batchId) return

      try {
        const res = await patchMetadata(batchId, row.imageAssetId, {
          expectedUpdatedAt: row.assetUpdatedAt ?? undefined,
          whoIsInPicture: normalizeWhoIsInPicture(draft.whoIsInPicture),
          caption: draft.caption.trim() || null,
          keywords: tagsToKeywords(keywordsToTags(draft.keywords)),
        })
        updateTracked(key, {
          whoIsInPicture: draft.whoIsInPicture,
          caption: draft.caption,
          keywords: draft.keywords,
          assetUpdatedAt: res.updatedAt,
          previewUrl: refreshStoredPreviewUrlVersion(row.previewUrl, row.imageAssetId, res.updatedAt),
          saveState: "saved",
          saveHint: null,
        })
      } catch (e) {
        if (isConflictError(e)) {
          const d = getConflictDetail(e)
          if (d) {
            updateTracked(key, {
              whoIsInPicture: d.whoIsInPicture ?? "",
              caption: d.caption ?? "",
              keywords: d.keywords ?? "",
              assetUpdatedAt: d.updatedAt ?? row.assetUpdatedAt,
              saveState: "error",
              saveHint: "Updated elsewhere — form refreshed.",
            })
          }
          throw new Error("Updated elsewhere — form refreshed.")
        }
        const message = getErrorMessage(e)
        updateTracked(key, { saveState: "error", saveHint: message })
        throw new Error(message)
      }
    },
    [batchId, getConflictDetail, getErrorMessage, isConflictError, patchMetadata, trackedRef, updateTracked],
  )

  const handleMetadataImportFile = useCallback(
    async (file: File) => {
      setMetadataImportError(null)
      setMetadataImportBusy(true)
      try {
        const summary = await executeMetadataImport({
          file,
          tracked: trackedRef.current,
          saveItem: saveMetadataItem,
          overwritePolicy: importOverwriteOptions?.overwritePolicy,
          treatPlaceholdersAsEmpty: importOverwriteOptions?.treatPlaceholdersAsEmpty,
          matchKey: importOverwriteOptions?.matchKey,
          onTrackedUpdate: (updater) => {
            setTracked((prev) => {
              const next = updater(prev)
              trackedRef.current = next
              return next
            })
          },
          onSaveSuccess: (key) => {
            updateTracked(key, { saveState: "saved", saveHint: null })
          },
          onSaveFailure: (key, message) => {
            updateTracked(key, { saveState: "error", saveHint: message })
          },
        })
        setMetadataImportSummary(summary)
        if (summary.updatedImageCount > 0 && summary.savedCount > 0) {
          toast({
            message: `Imported metadata for ${summary.savedCount} image${summary.savedCount === 1 ? "" : "s"}.`,
            variant: "success",
          })
        }
        if (summary.saveFailureCount > 0) {
          toast({
            message: `${summary.saveFailureCount} metadata save${summary.saveFailureCount === 1 ? "" : "s"} failed during import.`,
            variant: "error",
          })
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not import metadata file."
        setMetadataImportError(message)
        setMetadataImportSummary(null)
        toast({ message, variant: "error" })
      } finally {
        setMetadataImportBusy(false)
      }
    },
    [
      importOverwriteOptions?.overwritePolicy,
      importOverwriteOptions?.treatPlaceholdersAsEmpty,
      importOverwriteOptions?.matchKey,
      saveMetadataItem,
      setMetadataImportBusy,
      setMetadataImportError,
      setMetadataImportSummary,
      setTracked,
      toast,
      trackedRef,
      updateTracked,
    ],
  )

  return {
    bulkUpdateTracked,
    saveMetadataItem,
    handleMetadataImportFile,
  }
}
