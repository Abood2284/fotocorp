import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hasActiveCatalogFilters } from "../src/lib/staff-catalog-filters"
import { getStaffCatalogPreviewUrl } from "../src/lib/staff-catalog-preview"
import type { AdminCatalogAssetItem } from "../src/features/assets/admin-catalog-types"

describe("staff catalog list helpers", () => {
  it("treats event filter as active catalog filtering", () => {
    const query = new URLSearchParams({ eventId: "evt-1", limit: "50" })
    assert.equal(hasActiveCatalogFilters(query), true)
  })

  it("ignores pagination-only query params", () => {
    const query = new URLSearchParams({ limit: "50", sort: "newest" })
    assert.equal(hasActiveCatalogFilters(query), false)
  })
})

describe("staff catalog preview helpers", () => {
  it("builds same-origin staff preview URLs for bulk metadata thumbnails", () => {
    const asset = {
      id: "asset-1",
      updatedAt: "2026-01-02T00:00:00.000Z",
      readyPreviewVariants: ["card"],
    } as AdminCatalogAssetItem

    assert.equal(
      getStaffCatalogPreviewUrl(asset),
      "/staff/catalog/asset-1/preview-image?variant=card&v=2026-01-02T00%3A00%3A00.000Z",
    )
  })
})
