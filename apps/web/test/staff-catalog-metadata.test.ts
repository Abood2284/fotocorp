import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { AdminCatalogAssetItem } from "../src/features/assets/admin-catalog-types"
import {
  catalogAssetToTrackedFile,
  catalogAssetsToTrackedFiles,
  resolveCatalogBulkEditScope,
  resolveCatalogBulkEventTitle,
  trackedFilesToCatalogPatches,
} from "../src/lib/staff-catalog-metadata"

function mockCatalogAsset(patch: Partial<AdminCatalogAssetItem> = {}): AdminCatalogAssetItem {
  return {
    id: "asset-1",
    fotokey: "FK-001",
    legacyImageCode: "PHUPLOAD-123",
    originalFileName: "FC140626204.jpg",
    uploadOriginalFileName: null,
    whoIsInPicture: "Person",
    caption: "Caption",
    headline: null,
    description: null,
    keywords: "one, two",
    status: "APPROVED",
    visibility: "PUBLIC",
    r2Exists: true,
    r2CheckedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    imageDate: null,
    category: { id: "cat-1", name: "Sports" },
    event: { id: "evt-1", name: "Grand Prix", eventDate: null },
    contributor: { id: "c-1", displayName: "Photographer" },
    hasPreview: true,
    preview: { url: "/preview/asset-1", width: 100, height: 100 },
    updatedAt: "2026-01-02T00:00:00.000Z",
    derivatives: {
      thumb: { state: "READY", width: 100, height: 100, isWatermarked: true },
      card: { state: "READY", width: 200, height: 200, isWatermarked: true },
      detail: { state: "READY", width: 400, height: 400, isWatermarked: true },
    },
    ...patch,
  }
}

describe("staff catalog metadata helpers", () => {
  it("maps catalog assets to done tracked rows with upload original for spreadsheet matching", () => {
    const tracked = catalogAssetsToTrackedFiles([
      mockCatalogAsset({ uploadOriginalFileName: "a114.JPG" }),
    ])

    assert.equal(tracked.length, 1)
    assert.equal(tracked[0]?.fileName, "FK-001")
    assert.equal(tracked[0]?.fotokey, "FK-001")
    assert.equal(tracked[0]?.originalFileName, "a114.JPG")
    assert.equal(tracked[0]?.status, "done")
  })

  it("falls back to canonical filename when upload original is missing", () => {
    const row = catalogAssetToTrackedFile(mockCatalogAsset())
    assert.equal(row.originalFileName, "FC140626204.jpg")
  })

  it("ignores phupload legacy codes when upload original is missing", () => {
    const row = catalogAssetToTrackedFile(
      mockCatalogAsset({ originalFileName: null, legacyImageCode: "PHUPLOAD-999", fotokey: null }),
    )
    assert.equal(row.originalFileName, null)
  })

  it("returns a shared event title only when all assets share one event", () => {
    assert.equal(
      resolveCatalogBulkEventTitle([
        mockCatalogAsset(),
        mockCatalogAsset({ id: "asset-2", fotokey: "FK-002" }),
      ]),
      "Grand Prix",
    )
    assert.equal(
      resolveCatalogBulkEventTitle([
        mockCatalogAsset(),
        mockCatalogAsset({ id: "asset-2", event: { id: "evt-2", name: "Other", eventDate: null } }),
      ]),
      "",
    )
  })

  it("blocks bulk edit when multiple events are selected", () => {
    const scope = resolveCatalogBulkEditScope([
      mockCatalogAsset(),
      mockCatalogAsset({ id: "asset-2", event: { id: "evt-2", name: "Other", eventDate: null } }),
    ])

    assert.equal(scope.ok, false)
    assert.match(scope.blockReason ?? "", /single event/i)
  })

  it("blocks bulk edit when duplicate spreadsheet match names exist in one event", () => {
    const scope = resolveCatalogBulkEditScope([
      mockCatalogAsset({ id: "asset-1", uploadOriginalFileName: "a002.JPG" }),
      mockCatalogAsset({ id: "asset-2", fotokey: "FK-002", uploadOriginalFileName: "a002.JPG" }),
    ])

    assert.equal(scope.ok, false)
    assert.match(scope.blockReason ?? "", /duplicate spreadsheet match names/i)
  })

  it("allows bulk edit for a single event with unique match names", () => {
    const scope = resolveCatalogBulkEditScope([
      mockCatalogAsset({ id: "asset-1", uploadOriginalFileName: "a001.JPG" }),
      mockCatalogAsset({ id: "asset-2", fotokey: "FK-002", uploadOriginalFileName: "a002.JPG" }),
    ])

    assert.equal(scope.ok, true)
    assert.equal(scope.eventId, "evt-1")
    assert.equal(scope.eventTitle, "Grand Prix")
  })

  it("converts tracked rows back to catalog patches", () => {
    const tracked = catalogAssetsToTrackedFiles([mockCatalogAsset()])
    const patches = trackedFilesToCatalogPatches(tracked)

    assert.deepEqual(patches["asset-1"], {
      whoIsInPicture: "Person",
      caption: "Caption",
      keywords: "one, two",
      updatedAt: "2026-01-02T00:00:00.000Z",
    })
  })
})
