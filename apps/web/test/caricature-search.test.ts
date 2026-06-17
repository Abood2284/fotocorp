import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildCaricatureSearchQueryParams,
  hasCaricatureSearchIntent,
  mapCaricatureSearchItemToGridItem,
} from "../src/lib/search/caricature-search"

test("buildCaricatureSearchQueryParams defaults browse-all query", () => {
  assert.deepEqual(
    buildCaricatureSearchQueryParams({ page: 2 }),
    {
      q: "*",
      categoryId: undefined,
      category: undefined,
      language: undefined,
      credit: undefined,
      hasVisibleText: undefined,
      depictedSubject: undefined,
      page: 2,
      limit: 50,
      sort: "newest",
      includeFacets: false,
    },
  )
})

test("mapCaricatureSearchItemToGridItem prefers card preview metadata", () => {
  const item = mapCaricatureSearchItemToGridItem({
    id: "caricature-1",
    headline: "Election satire",
    description: "Description",
    credit: "Artist Name",
    categoryId: "category-1",
    categoryName: "Politics",
    language: "ENGLISH",
    hasVisibleText: false,
    keywords: ["politics"],
    depictedSubjects: ["politician"],
    publishedAt: "2025-12-14T00:00:00.000Z",
    createdAt: "2025-12-13T00:00:00.000Z",
    previewUrl: null,
    width: null,
    height: null,
    previews: {
      card: { url: "https://cdn.example.test/card.webp", width: 612, height: 408 },
      detail: null,
    },
  })

  assert.equal(item.headline, "Election satire")
  assert.equal(item.preview?.url, "https://cdn.example.test/card.webp")
  assert.equal(item.credit, "Artist Name")
})

test("hasCaricatureSearchIntent treats filters and paging as intent", () => {
  assert.equal(hasCaricatureSearchIntent({ q: "food" }), true)
  assert.equal(hasCaricatureSearchIntent({ language: "MARATHI" }), true)
  assert.equal(hasCaricatureSearchIntent({ page: 2 }), true)
  assert.equal(hasCaricatureSearchIntent({}), false)
})
