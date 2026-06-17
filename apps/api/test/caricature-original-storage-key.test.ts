import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildCaricatureOriginalStorageKey,
  extensionFromCaricatureFileNameAndMime,
  isAllowedCaricatureUploadExtension,
} from "../src/lib/caricature-original-storage-key"

describe("caricature original storage key", () => {
  it("builds deterministic keys under caricatures/{assetId}/original.{ext}", () => {
    const assetId = "11111111-1111-4111-8111-111111111111"
    assert.equal(
      buildCaricatureOriginalStorageKey({ assetId, extension: "jpg" }),
      `caricatures/${assetId}/original.jpg`,
    )
    assert.equal(
      buildCaricatureOriginalStorageKey({ assetId, extension: "jpeg" }),
      `caricatures/${assetId}/original.jpg`,
    )
    assert.equal(
      buildCaricatureOriginalStorageKey({ assetId, extension: "png" }),
      `caricatures/${assetId}/original.png`,
    )
  })

  it("rejects unsupported extensions", () => {
    assert.throws(
      () =>
        buildCaricatureOriginalStorageKey({
          assetId: "11111111-1111-4111-8111-111111111111",
          extension: "gif",
        }),
      /INVALID_CARICATURE_UPLOAD_EXTENSION/,
    )
  })

  it("resolves extensions from filename and mime", () => {
    assert.equal(extensionFromCaricatureFileNameAndMime("art.webp", "image/webp"), "webp")
    assert.equal(extensionFromCaricatureFileNameAndMime("art.JPG", "application/octet-stream"), "jpg")
    assert.equal(extensionFromCaricatureFileNameAndMime("art", "image/png"), "png")
    assert.equal(extensionFromCaricatureFileNameAndMime("art.gif", "image/gif"), null)
  })

  it("allows jpg jpeg png webp only", () => {
    assert.equal(isAllowedCaricatureUploadExtension("jpg"), true)
    assert.equal(isAllowedCaricatureUploadExtension("webp"), true)
    assert.equal(isAllowedCaricatureUploadExtension("gif"), false)
  })
})
