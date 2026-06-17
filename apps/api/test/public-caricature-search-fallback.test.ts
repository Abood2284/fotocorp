import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { shouldTryCaricatureSqlFallback } from "../src/lib/caricatures/public-caricature-assets"
import { parseTypesenseCaricatureSearchQuery } from "../src/lib/search/typesense-caricatures"

describe("caricature SQL search fallback", () => {
  it("falls back on empty Typesense browse results without filters", () => {
    const query = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=*&page=1&limit=50"))
    assert.equal(shouldTryCaricatureSqlFallback(query, 0), true)
  })

  it("does not fall back when Typesense already returned matches", () => {
    const query = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=*"))
    assert.equal(shouldTryCaricatureSqlFallback(query, 2), false)
  })

  it("does not fall back for filtered or text searches", () => {
    const textQuery = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=politics"))
    const filteredQuery = parseTypesenseCaricatureSearchQuery(new URLSearchParams("q=*&language=MARATHI"))

    assert.equal(shouldTryCaricatureSqlFallback(textQuery, 0), false)
    assert.equal(shouldTryCaricatureSqlFallback(filteredQuery, 0), false)
  })
})
