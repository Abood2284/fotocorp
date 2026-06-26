import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCatalogPreviewStorageKey,
  isCatalogDerivativeReady,
  listCatalogVariantsToRegenerate,
  resolveCatalogPreviewObjectId,
} from "../src/media/regenerateCatalogPreviewDerivatives"

describe("regenerateCatalogPreviewDerivatives", () => {
  it("builds stable preview storage keys", () => {
    assert.equal(
      buildCatalogPreviewStorageKey("CARD", "005"),
      "previews/watermarked/card/005.webp",
    )
  })

  it("lists variants that are not fully ready", () => {
    const existing = new Map([
      [
        "CARD" as const,
        {
          variant: "CARD" as const,
          generationStatus: "READY",
          isWatermarked: false,
          watermarkProfile: "fotocorp_card_light_preview_v1",
          width: 400,
          height: 300,
          mimeType: "image/webp",
        },
      ],
    ])

    const variants = listCatalogVariantsToRegenerate(existing)
    assert.deepEqual(variants.sort(), ["CARD", "DETAIL", "THUMB"].sort())
    assert.equal(isCatalogDerivativeReady("CARD", existing.get("CARD")), false)
  })

  it("resolves preview object id from original storage key", () => {
    assert.equal(
      resolveCatalogPreviewObjectId({
        assetId: "asset-1",
        legacyImageCode: null,
        originalStorageKey: "005.jpg",
      }),
      "005",
    )
  })
})
