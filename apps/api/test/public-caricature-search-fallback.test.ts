import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isUnfilteredCaricatureBrowseQuery,
  mapPostgresFacetItem,
  shouldTryCaricatureSqlFallback,
  shouldUseCaricatureSqlFallback,
} from "../src/lib/caricatures/public-caricature-assets"
import { parseTypesenseCaricatureSearchQuery } from "../src/lib/search/typesense-caricatures"

describe("caricature SQL search fallback", () => {
  it("detects unfiltered browse queries", () => {
    const query = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=*&page=1&limit=50"))
    assert.equal(isUnfilteredCaricatureBrowseQuery(query), true)
  })

  it("falls back on empty Typesense browse results without filters", () => {
    const query = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=*&page=1&limit=50"))
    assert.equal(shouldUseCaricatureSqlFallback(query, 0, 3), true)
    assert.equal(shouldTryCaricatureSqlFallback(query, 0), true)
  })

  it("falls back when Postgres has more published caricatures than Typesense", () => {
    const query = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=*"))
    assert.equal(shouldUseCaricatureSqlFallback(query, 2, 3), true)
  })

  it("does not fall back when Typesense and Postgres counts match", () => {
    const query = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=*"))
    assert.equal(shouldUseCaricatureSqlFallback(query, 2, 2), false)
    assert.equal(shouldUseCaricatureSqlFallback(query, 3, 3), false)
  })

  it("does not fall back for filtered or text searches", () => {
    const textQuery = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=politics"))
    const filteredQuery = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=*&language=MARATHI"))

    assert.equal(shouldUseCaricatureSqlFallback(textQuery, 0, 3), false)
    assert.equal(shouldUseCaricatureSqlFallback(filteredQuery, 0, 3), false)
  })

  it("maps postgres facet rows into search facet items", () => {
    assert.deepEqual(mapPostgresFacetItem("category-1", "Politics", "4"), {
      value: "category-1",
      name: "Politics",
      count: 4,
      assetCount: 4,
    })
  })
})
