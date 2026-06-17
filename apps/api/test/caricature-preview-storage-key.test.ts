import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildCaricaturePreviewStorageKey,
  caricatureDerivativeTypeFromPreviewVariant,
} from "../src/lib/caricature-preview-storage-key"

describe("caricature preview storage key", () => {
  it("builds stable preview keys per asset and variant", () => {
    const assetId = "11111111-1111-4111-8111-111111111111"
    assert.equal(
      buildCaricaturePreviewStorageKey({ assetId, variant: "card" }),
      `caricatures/${assetId}/blurred-card.webp`,
    )
    assert.equal(
      buildCaricaturePreviewStorageKey({ assetId, variant: "detail" }),
      `caricatures/${assetId}/blurred-detail.webp`,
    )
  })

  it("maps preview variants to derivative types", () => {
    assert.equal(caricatureDerivativeTypeFromPreviewVariant("card"), "BLURRED_CARD")
    assert.equal(caricatureDerivativeTypeFromPreviewVariant("detail"), "BLURRED_DETAIL")
  })
})
