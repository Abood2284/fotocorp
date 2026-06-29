import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCaptionQueueHrefFromCatalogQuery,
  catalogQueryHasMetadataGapFilter,
  formatCatalogStatusFilterLabel,
  isMissingWhoIsInPicture,
} from "../src/lib/staff-catalog-filters"

describe("staff catalog filter helpers", () => {
  it("formats metadata status filter labels", () => {
    assert.equal(formatCatalogStatusFilterLabel("MISSING_CAPTION"), "Missing Caption")
    assert.equal(formatCatalogStatusFilterLabel("MISSING_WHO_IS_IN_PICTURE"), "Missing Who is in picture")
    assert.equal(formatCatalogStatusFilterLabel("ACTIVE"), "ACTIVE")
  })

  it("treats empty, whitespace, and dot-only who is in picture values as missing", () => {
    assert.equal(isMissingWhoIsInPicture(null), true)
    assert.equal(isMissingWhoIsInPicture(""), true)
    assert.equal(isMissingWhoIsInPicture("   "), true)
    assert.equal(isMissingWhoIsInPicture("."), true)
    assert.equal(isMissingWhoIsInPicture(" . "), true)
    assert.equal(isMissingWhoIsInPicture("Nita Ambani"), false)
  })

  it("detects metadata gap filters in catalog query params", () => {
    assert.equal(
      catalogQueryHasMetadataGapFilter(new URLSearchParams({ status: "MISSING_WHO_IS_IN_PICTURE" })),
      true,
    )
    assert.equal(
      catalogQueryHasMetadataGapFilter(new URLSearchParams({ status: "ACTIVE" })),
      false,
    )
  })

  it("builds caption queue links from catalog metadata filters", () => {
    assert.equal(
      buildCaptionQueueHrefFromCatalogQuery(new URLSearchParams({ status: "MISSING_CAPTION", eventId: "evt-1" })),
      "/staff/captions?missingCaption=true&eventId=evt-1",
    )
    assert.equal(
      buildCaptionQueueHrefFromCatalogQuery(new URLSearchParams({ status: "MISSING_WHO_IS_IN_PICTURE" })),
      "/staff/captions?missingWhoIsInPicture=true",
    )
  })
})
