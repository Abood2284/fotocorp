import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import type { AdminCatalogAssetItem } from "@/features/assets/admin-catalog-types"
import {
  formatCatalogFotokeyDisplay,
  getCatalogImportMatchName,
} from "@/lib/catalog-asset-identity"
import { normalizeFileName } from "@/lib/contributor-upload-metadata-import"
import { getStaffCatalogPreviewUrl } from "@/lib/staff-catalog-preview"

export const CATALOG_METADATA_BATCH_ID = "catalog"

export interface CatalogBulkEditScope {
  ok: boolean
  eventId: string | null
  eventTitle: string | null
  blockReason: string | null
  duplicateMatchNames: string[]
}

function getCatalogAssetDisplayFileName(asset: AdminCatalogAssetItem): string {
  return formatCatalogFotokeyDisplay(asset.fotokey)
}

export function resolveCatalogBulkEventTitle(assets: AdminCatalogAssetItem[]): string {
  if (assets.length === 0) return ""
  const eventNames = new Set(
    assets.map((asset) => asset.event?.name?.trim() ?? "").filter(Boolean),
  )
  if (eventNames.size !== 1) return ""
  return [...eventNames][0]!
}

export function resolveCatalogBulkEditScope(assets: AdminCatalogAssetItem[]): CatalogBulkEditScope {
  if (assets.length === 0) {
    return {
      ok: false,
      eventId: null,
      eventTitle: null,
      blockReason: "Select at least one catalog asset.",
      duplicateMatchNames: [],
    }
  }

  const eventIds = new Set(
    assets.map((asset) => asset.event?.id?.trim() ?? "").filter(Boolean),
  )
  const assetsMissingEvent = assets.filter((asset) => !asset.event?.id?.trim())

  if (assetsMissingEvent.length > 0) {
    return {
      ok: false,
      eventId: null,
      eventTitle: null,
      blockReason: "Bulk metadata edit requires every asset to belong to an event.",
      duplicateMatchNames: [],
    }
  }

  if (eventIds.size !== 1) {
    return {
      ok: false,
      eventId: null,
      eventTitle: null,
      blockReason:
        "Bulk metadata edit requires a single event. Filter the catalog to one event, use bulk edit all in event, or clear your selection.",
      duplicateMatchNames: [],
    }
  }

  const eventId = [...eventIds][0]!
  const eventTitle = assets.find((asset) => asset.event?.id === eventId)?.event?.name?.trim() ?? null

  const matchNameCounts = new Map<string, { count: number; displayName: string }>()
  for (const asset of assets) {
    const displayName = getCatalogImportMatchName(asset)
    if (!displayName) continue
    const normalized = normalizeFileName(displayName)
    const existing = matchNameCounts.get(normalized)
    if (existing) {
      existing.count += 1
    } else {
      matchNameCounts.set(normalized, { count: 1, displayName })
    }
  }

  const duplicateMatchNames = [...matchNameCounts.values()]
    .filter((entry) => entry.count > 1)
    .map((entry) => entry.displayName)
    .sort((left, right) => left.localeCompare(right))

  if (duplicateMatchNames.length > 0) {
    return {
      ok: false,
      eventId,
      eventTitle,
      blockReason: `This selection has duplicate spreadsheet match names (${duplicateMatchNames.join(", ")}). Narrow the selection so each original filename maps to one asset.`,
      duplicateMatchNames,
    }
  }

  return {
    ok: true,
    eventId,
    eventTitle,
    blockReason: null,
    duplicateMatchNames: [],
  }
}

export function catalogAssetToTrackedFile(asset: AdminCatalogAssetItem): TrackedFile {
  const displayName = getCatalogAssetDisplayFileName(asset)
  const spreadsheetMatchName = getCatalogImportMatchName(asset)

  return {
    key: asset.id,
    file: null,
    fileName: displayName,
    sizeBytes: 0,
    status: "done",
    errorMessage: null,
    itemId: asset.id,
    imageAssetId: asset.id,
    instruction: null,
    uploadProgress: null,
    previewUrl: getStaffCatalogPreviewUrl(asset),
    whoIsInPicture: asset.whoIsInPicture ?? "",
    caption: asset.caption ?? "",
    keywords: asset.keywords ?? "",
    assetUpdatedAt: asset.updatedAt ?? null,
    saveState: "idle",
    saveHint: null,
    fotokey: asset.fotokey,
    legacyImageCode: asset.legacyImageCode,
    originalFileName: spreadsheetMatchName,
  }
}

export function catalogAssetsToTrackedFiles(assets: AdminCatalogAssetItem[]): TrackedFile[] {
  return assets.map(catalogAssetToTrackedFile)
}

export function trackedFilesToCatalogPatches(
  tracked: TrackedFile[],
): Record<string, Partial<AdminCatalogAssetItem>> {
  const patches: Record<string, Partial<AdminCatalogAssetItem>> = {}

  for (const row of tracked) {
    if (!row.imageAssetId) continue
    patches[row.imageAssetId] = {
      whoIsInPicture: row.whoIsInPicture.trim() || null,
      caption: row.caption.trim() || null,
      keywords: row.keywords.trim() || null,
      updatedAt: row.assetUpdatedAt ?? undefined,
    }
  }

  return patches
}
