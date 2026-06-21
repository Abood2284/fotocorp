import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildCaricatureCategoryFilterItems,
  buildCaricatureDepictedSubjectFilterItems,
  buildCaricatureFilterChips,
  buildCaricatureLanguageFilterItems,
  buildCaricatureSearchQueryParams,
  hasCaricatureSearchIntent,
  mapCaricatureSearchItemToGridItem,
  mapHomepageCaricatureToGridItem,
  resolveCaricatureCategoryLabel,
  resolveCaricatureFilterUpdates,
  resolveCaricatureSubmitSort,
} from "../src/lib/search/caricature-search"
import { buildSearchPageHref } from "../src/lib/search/search-segment"

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
    hasTranslation: false,
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
  assert.equal(item.description, "Description")
  assert.equal(item.publishedAt, "2025-12-14T00:00:00.000Z")
  assert.deepEqual(item.depictedSubjects, ["politician"])
})

test("mapHomepageCaricatureToGridItem sanitizes placeholders and maps card metadata", () => {
  const item = mapHomepageCaricatureToGridItem({
    id: "caricature-2",
    headline: "WhatsApp Image 2026-06-14 at 17.13.51",
    description: "A satire on tourist behaviour.",
    credit: "Shaielesh Mule",
    categoryName: "Politics",
    language: "MARATHI",
    hasVisibleText: true,
    hasTranslation: true,
    depictedSubjects: ["Arshid Tiwari", "Bollywood"],
    publishedAt: "2026-06-21T10:00:00.000Z",
    previewUrl: "https://cdn.example.test/card.webp",
    previewWidth: 480,
    previewHeight: 640,
  })

  assert.equal(item.headline, "Untitled caricature")
  assert.equal(item.description, "A satire on tourist behaviour.")
  assert.equal(item.hasTranslation, true)
  assert.deepEqual(item.depictedSubjects, ["Arshid Tiwari", "Bollywood"])
})

test("mapCaricatureSearchItemToGridItem drops placeholder description and credit", () => {
  const item = mapCaricatureSearchItemToGridItem({
    id: "caricature-3",
    headline: "Election satire",
    description: "N/A",
    credit: "null",
    categoryId: "category-1",
    categoryName: "Politics",
    language: "ENGLISH",
    hasVisibleText: false,
    hasTranslation: false,
    keywords: [],
    depictedSubjects: [],
    publishedAt: null,
    createdAt: null,
    previewUrl: null,
    width: null,
    height: null,
    previews: { card: null, detail: null },
  })

  assert.equal(item.description, null)
  assert.equal(item.credit, null)
})

test("hasCaricatureSearchIntent treats filters and paging as intent", () => {
  assert.equal(hasCaricatureSearchIntent({ q: "food" }), true)
  assert.equal(hasCaricatureSearchIntent({ language: "MARATHI" }), true)
  assert.equal(hasCaricatureSearchIntent({ credit: "Shaielesh Mule" }), true)
  assert.equal(hasCaricatureSearchIntent({ hasVisibleText: true }), true)
  assert.equal(hasCaricatureSearchIntent({ depictedSubject: "Bollywood" }), true)
  assert.equal(hasCaricatureSearchIntent({ page: 2 }), true)
  assert.equal(hasCaricatureSearchIntent({}), false)
})

test("buildCaricatureFilterChips includes credit, language, and visible text filters", () => {
  const removed: string[] = []
  const chips = buildCaricatureFilterChips(
    {
      q: "election",
      credit: "Shaielesh Mule",
      language: "MARATHI",
      hasVisibleText: false,
      depictedSubject: "Bollywood",
      categoryId: "Politics",
    },
    { categoryName: "Politics" },
    (next) => {
      removed.push(Object.keys(next).join(","))
    },
  )

  assert.deepEqual(
    chips.map((chip) => chip.label),
    ["election", "Politics", "Marathi", "Shaielesh Mule", "No visible text", "Bollywood"],
  )

  chips.find((chip) => chip.key === "credit")?.remove()
  assert.equal(removed.at(-1), "credit")
})

test("resolveCaricatureCategoryLabel prefers facet and item names over raw ids", () => {
  const facets = {
    categories: [{ value: "Politics", count: 3, name: "Politics", assetCount: 3 }],
    languages: [],
    credits: [],
    hasVisibleText: [],
    depictedSubjects: [],
  }

  assert.equal(resolveCaricatureCategoryLabel("Politics", facets, []), "Politics")
  assert.equal(
    resolveCaricatureCategoryLabel("category-uuid", facets, [{
      id: "1",
      headline: "Headline",
      description: null,
      credit: null,
      categoryId: "category-uuid",
      categoryName: "Politics",
      language: null,
      hasVisibleText: null,
      hasTranslation: null,
      keywords: [],
      depictedSubjects: [],
      publishedAt: null,
      createdAt: null,
      previewUrl: null,
      width: null,
      height: null,
      previews: { card: null, detail: null },
    }]),
    "Politics",
  )
})

test("buildCaricatureLanguageFilterItems excludes NO_VISIBLE_TEXT and zero counts", () => {
  const items = buildCaricatureLanguageFilterItems({
    categories: [],
    languages: [
      { value: "MARATHI", count: 2, name: "MARATHI", assetCount: 2 },
      { value: "NO_VISIBLE_TEXT", count: 5, name: "NO_VISIBLE_TEXT", assetCount: 5 },
      { value: "ENGLISH", count: 0, name: "ENGLISH", assetCount: 0 },
    ],
    credits: [],
    hasVisibleText: [],
    depictedSubjects: [],
  })

  assert.deepEqual(items, [{ id: "MARATHI", label: "Marathi", count: 2 }])
})

test("buildCaricatureCategoryFilterItems and depicted subject helpers drop empty counts", () => {
  const facets = {
    categories: [{ value: "category-1", count: 2, name: "Politics", assetCount: 2 }],
    languages: [],
    credits: [],
    hasVisibleText: [],
    depictedSubjects: [{ value: "Bollywood", count: 1, name: "Bollywood", assetCount: 1 }],
  }

  assert.deepEqual(buildCaricatureCategoryFilterItems(facets), [
    { id: "category-1", label: "Politics", count: 2 },
  ])
  assert.deepEqual(buildCaricatureDepictedSubjectFilterItems(facets), [
    { id: "Bollywood", label: "Bollywood", count: 1 },
  ])
})

test("resolveCaricatureFilterUpdates clears language when visible text is disabled", () => {
  assert.deepEqual(
    resolveCaricatureFilterUpdates(
      { language: "MARATHI" },
      { hasVisibleText: false },
    ),
    { hasVisibleText: false, language: undefined, page: 1 },
  )
  assert.deepEqual(
    resolveCaricatureFilterUpdates({}, { language: "HINDI" }),
    { language: "HINDI", hasVisibleText: true, page: 1 },
  )
})

test("resolveCaricatureSubmitSort prefers relevance when query exists", () => {
  assert.equal(resolveCaricatureSubmitSort("food"), "relevance")
  assert.equal(resolveCaricatureSubmitSort(""), "newest")
})

test("buildSearchPageHref includes caricature depictedSubject param", () => {
  const href = buildSearchPageHref({
    segment: "caricature",
    depictedSubject: "Bollywood",
    sort: "newest",
  })

  assert.match(href, /depictedSubject=Bollywood/)
  assert.match(href, /segment=caricature/)
})
