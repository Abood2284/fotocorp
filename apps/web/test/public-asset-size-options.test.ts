import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildPublicAssetSizeOptions } from "../src/lib/assets/public-asset-size-options"
import type { PublicAssetTechnicalMetadata } from "../src/features/assets/types"

function baseMetadata(
  overrides: Partial<PublicAssetTechnicalMetadata> = {},
): PublicAssetTechnicalMetadata {
  return {
    scanStatus: "SUCCESS",
    displayWidth: 4000,
    displayHeight: 2842,
    originalLongEdge: 4000,
    originalDpi: 300,
    originalMegapixels: "11.3680",
    canGenerateLow: true,
    canGenerateMedium: true,
    downloadQualityCeiling: "HIGH",
    ...overrides,
  }
}

describe("buildPublicAssetSizeOptions", () => {
  it("builds tier labels with scaled WxH and output DPI from scanned metadata", () => {
    const options = buildPublicAssetSizeOptions(baseMetadata())

    assert.equal(options[0]?.dimensions, "1,200 × 853 px • 72 dpi")
    assert.equal(options[1]?.dimensions, "2,400 × 1,705 px • 300 dpi")
    assert.equal(options[2]?.dimensions, "4,000 × 2,842 px • 300 dpi • 11.4 MP")
    assert.equal(options[0]?.description, "Web & Screen")
    assert.equal(options[1]?.description, "Digital & Editorial")
    assert.equal(options[2]?.description, "Print & publication")
  })

  it("caps low and medium edges to the source long edge", () => {
    const options = buildPublicAssetSizeOptions(
      baseMetadata({
        displayWidth: 1400,
        displayHeight: 933,
        originalLongEdge: 1400,
        originalDpi: 72,
        originalMegapixels: "1.3050",
      }),
    )

    assert.equal(options[0]?.dimensions, "1,200 × 800 px • 72 dpi")
    assert.equal(options[1]?.dimensions, "1,400 × 933 px • 300 dpi")
    assert.equal(options[2]?.dimensions, "1,400 × 933 px • 72 dpi • 1.30 MP")
  })

  it("leaves all dimensions empty when metadata has not been scanned", () => {
    const options = buildPublicAssetSizeOptions(null)

    assert.equal(options[0]?.dimensions, null)
    assert.equal(options[1]?.dimensions, null)
    assert.equal(options[2]?.dimensions, null)
  })

  it("omits missing high-tier fields instead of inventing values", () => {
    const options = buildPublicAssetSizeOptions(
      baseMetadata({
        originalDpi: null,
        originalMegapixels: null,
      }),
    )

    assert.equal(options[2]?.dimensions, "4,000 × 2,842 px")
  })
})
