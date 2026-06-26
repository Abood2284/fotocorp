import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolvePreviewObjectId } from "../src/lib/media/preview-object-id"

describe("resolvePreviewObjectId", () => {
  it("prefers legacy image code", () => {
    assert.equal(
      resolvePreviewObjectId({
        assetId: "asset-1",
        legacyImageCode: "LEG001",
        originalStorageKey: "originals/005.jpg",
      }),
      "LEG001",
    )
  })

  it("falls back to original filename stem", () => {
    assert.equal(
      resolvePreviewObjectId({
        assetId: "asset-1",
        legacyImageCode: null,
        originalStorageKey: "FCfolder/005.jpg",
      }),
      "005",
    )
  })

  it("throws when no preview object id can be resolved", () => {
    assert.throws(() =>
      resolvePreviewObjectId({
        assetId: "asset-1",
        legacyImageCode: null,
        originalStorageKey: null,
      }),
    )
  })
})
