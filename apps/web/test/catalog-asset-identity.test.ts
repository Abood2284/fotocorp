import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatCatalogFotokeyDisplay,
  getCatalogImportMatchName,
  isPhuploadLegacyCode,
} from "../src/lib/catalog-asset-identity"

describe("catalog asset identity helpers", () => {
  it("detects phupload legacy placeholders", () => {
    assert.equal(isPhuploadLegacyCode("PHUPLOAD-123"), true)
    assert.equal(isPhuploadLegacyCode("phupload-abc"), true)
    assert.equal(isPhuploadLegacyCode("FC2024-001"), false)
  })

  it("formats missing fotokey as not assigned", () => {
    assert.equal(formatCatalogFotokeyDisplay(null), "Not assigned")
    assert.equal(formatCatalogFotokeyDisplay("FC2024-001"), "FC2024-001")
  })

  it("prefers upload original filename for spreadsheet matching", () => {
    assert.equal(
      getCatalogImportMatchName({
        uploadOriginalFileName: "a114.JPG",
        originalFileName: "FC140626204.jpg",
        legacyImageCode: "PHUPLOAD-1",
        fotokey: "FC140626204",
      }),
      "a114.JPG",
    )
  })

  it("prefers canonical original filename when upload original is missing", () => {
    assert.equal(
      getCatalogImportMatchName({
        originalFileName: "DSC_001.jpg",
        legacyImageCode: "PHUPLOAD-1",
        fotokey: "FC2024-001",
      }),
      "DSC_001.jpg",
    )
  })
})
