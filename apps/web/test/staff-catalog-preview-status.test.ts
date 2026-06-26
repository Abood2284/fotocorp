import type { AdminCatalogAssetItem } from "@/features/assets/admin-catalog-types"
import {
  canRegenerateCatalogPreviews,
  getCatalogPreviewPlaceholderMessage,
  isCatalogPreviewRegenerationActive,
  isStaleQueuedRegeneration,
  shouldStopCatalogPreviewPolling,
} from "../src/lib/staff-catalog-preview-status"
import test from "node:test"
import assert from "node:assert/strict"

function baseAsset(overrides: Partial<AdminCatalogAssetItem> = {}): AdminCatalogAssetItem {
  return {
    id: "asset-1",
    fotokey: null,
    legacyImageCode: "005.jpg",
    originalFileName: "005.jpg",
    uploadOriginalFileName: null,
    whoIsInPicture: null,
    caption: null,
    headline: null,
    description: null,
    keywords: null,
    status: "DRAFT",
    visibility: "PRIVATE",
    r2Exists: true,
    r2CheckedAt: null,
    createdAt: null,
    imageDate: null,
    category: null,
    event: null,
    contributor: null,
    hasPreview: false,
    previewReady: false,
    previewState: "MISSING",
    previewRegenerationStatus: null,
    previewRegenerationJob: null,
    readyPreviewVariants: [],
    missingPreviewVariants: ["thumb", "card", "detail"],
    preview: null,
    derivatives: {
      thumb: { state: "MISSING", width: null, height: null, isWatermarked: false },
      card: { state: "MISSING", width: null, height: null, isWatermarked: false },
      detail: { state: "MISSING", width: null, height: null, isWatermarked: false },
    },
    ...overrides,
  }
}

const regenJob = (status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED", overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  status,
  createdAt: new Date().toISOString(),
  startedAt: null,
  completedAt: null,
  failureCode: null,
  failureMessage: null,
  ...overrides,
})

test("getCatalogPreviewPlaceholderMessage explains missing original", () => {
  const message = getCatalogPreviewPlaceholderMessage(baseAsset({ r2Exists: false }))
  assert.equal(message, "Original not verified in R2")
})

test("getCatalogPreviewPlaceholderMessage explains queued regeneration", () => {
  const message = getCatalogPreviewPlaceholderMessage(
    baseAsset({
      previewRegenerationStatus: "QUEUED",
      previewRegenerationJob: regenJob("QUEUED"),
    }),
  )
  assert.equal(message, "Preview regeneration queued")
})

test("getCatalogPreviewPlaceholderMessage explains running regeneration", () => {
  const message = getCatalogPreviewPlaceholderMessage(
    baseAsset({
      previewRegenerationStatus: "RUNNING",
      previewRegenerationJob: regenJob("RUNNING"),
    }),
  )
  assert.equal(message, "Worker generating previews")
})

test("getCatalogPreviewPlaceholderMessage explains failed regeneration job", () => {
  const message = getCatalogPreviewPlaceholderMessage(
    baseAsset({
      previewRegenerationJob: regenJob("FAILED", { failureMessage: "Sharp failed" }),
    }),
  )
  assert.equal(message, "Preview regeneration failed")
})

test("getCatalogPreviewPlaceholderMessage explains failed derivatives", () => {
  const message = getCatalogPreviewPlaceholderMessage(
    baseAsset({
      derivatives: {
        thumb: { state: "FAILED", width: null, height: null, isWatermarked: false },
        card: { state: "MISSING", width: null, height: null, isWatermarked: false },
        detail: { state: "MISSING", width: null, height: null, isWatermarked: false },
      },
    }),
  )
  assert.equal(message, "Preview generation failed")
})

test("canRegenerateCatalogPreviews requires r2 and incomplete previews", () => {
  assert.equal(canRegenerateCatalogPreviews(baseAsset()), true)
  assert.equal(canRegenerateCatalogPreviews(baseAsset({ previewReady: true })), false)
  assert.equal(canRegenerateCatalogPreviews(baseAsset({ r2Exists: false })), false)
  assert.equal(
    canRegenerateCatalogPreviews(
      baseAsset({
        previewRegenerationStatus: "QUEUED",
        previewRegenerationJob: regenJob("QUEUED"),
      }),
    ),
    false,
  )
})

test("shouldStopCatalogPreviewPolling stops when previewReady", () => {
  assert.equal(shouldStopCatalogPreviewPolling(baseAsset({ previewReady: true })), true)
})

test("shouldStopCatalogPreviewPolling stops when regen job failed", () => {
  assert.equal(
    shouldStopCatalogPreviewPolling(
      baseAsset({ previewRegenerationJob: regenJob("FAILED", { failureMessage: "boom" }) }),
    ),
    true,
  )
})

test("shouldStopCatalogPreviewPolling stops when regen job completed", () => {
  assert.equal(
    shouldStopCatalogPreviewPolling(
      baseAsset({ previewRegenerationJob: regenJob("COMPLETED") }),
    ),
    true,
  )
})

test("isCatalogPreviewRegenerationActive uses job status", () => {
  assert.equal(
    isCatalogPreviewRegenerationActive(
      baseAsset({ previewRegenerationJob: regenJob("RUNNING") }),
    ),
    true,
  )
  assert.equal(
    isCatalogPreviewRegenerationActive(
      baseAsset({ previewRegenerationJob: regenJob("FAILED") }),
    ),
    false,
  )
})

test("isStaleQueuedRegeneration detects old queued jobs", () => {
  const old = new Date(Date.now() - 3 * 60 * 1000).toISOString()
  assert.equal(isStaleQueuedRegeneration(old), true)
  assert.equal(isStaleQueuedRegeneration(new Date().toISOString()), false)
})
