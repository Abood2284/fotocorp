import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildAdminEventSearchIndexStatus } from "../src/lib/search/typesense-event-search-index"

describe("Admin event search index status", () => {
  it("reports in sync when catalog and typesense counts match", () => {
    const status = buildAdminEventSearchIndexStatus({
      eventId: "event-1",
      catalogSearchEligibleCount: 59,
      typesenseIndexedCount: 59,
      typesenseConfigured: true,
    })

    assert.equal(status.inSync, true)
    assert.equal(status.missingCount, 0)
  })

  it("reports missing images when typesense count is lower", () => {
    const status = buildAdminEventSearchIndexStatus({
      eventId: "event-1",
      catalogSearchEligibleCount: 59,
      typesenseIndexedCount: 48,
      typesenseConfigured: true,
    })

    assert.equal(status.inSync, false)
    assert.equal(status.missingCount, 11)
  })

  it("does not claim in sync when typesense is not configured", () => {
    const status = buildAdminEventSearchIndexStatus({
      eventId: "event-1",
      catalogSearchEligibleCount: 3,
      typesenseIndexedCount: null,
      typesenseConfigured: false,
    })

    assert.equal(status.inSync, false)
    assert.equal(status.missingCount, null)
  })
})
