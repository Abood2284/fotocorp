import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { canDeleteIncompleteCatalogUpload } from "../src/lib/assets/catalog-incomplete-upload-delete"

describe("canDeleteIncompleteCatalogUpload", () => {
  it("allows orphan staging uploads without a linked upload item", () => {
    assert.equal(
      canDeleteIncompleteCatalogUpload({
        fotokey: null,
        source: "FOTOCORP",
        originalStorageKey: "staging/photographer/event/batch/item.jpg",
        uploadLinked: false,
      }),
      true,
    )
  })

  it("blocks assets with a Fotokey", () => {
    assert.equal(
      canDeleteIncompleteCatalogUpload({
        fotokey: "FC260626003",
        source: "FOTOCORP",
        originalStorageKey: "staging/photographer/event/batch/item.jpg",
        uploadLinked: false,
      }),
      false,
    )
  })

  it("blocks assets with a completed contributor upload link", () => {
    assert.equal(
      canDeleteIncompleteCatalogUpload({
        fotokey: null,
        source: "FOTOCORP",
        originalStorageKey: "staging/photographer/event/batch/item.jpg",
        uploadLinked: true,
      }),
      false,
    )
  })

  it("blocks canonical originals even without a Fotokey", () => {
    assert.equal(
      canDeleteIncompleteCatalogUpload({
        fotokey: null,
        source: "FOTOCORP",
        originalStorageKey: "FC260626003.jpg",
        uploadLinked: false,
      }),
      false,
    )
  })
})
