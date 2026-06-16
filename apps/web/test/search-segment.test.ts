import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applySearchSegmentChange,
  buildHomeHeroSearchHref,
  buildSearchPageHref,
  parseSearchSegment,
  stripEditorialOnlySearchParams,
} from "../src/lib/search/search-segment"

test("parseSearchSegment defaults invalid values to editorial", () => {
  assert.equal(parseSearchSegment(undefined), "editorial")
  assert.equal(parseSearchSegment(""), "editorial")
  assert.equal(parseSearchSegment("editorial"), "editorial")
  assert.equal(parseSearchSegment("caricature"), "caricature")
  assert.equal(parseSearchSegment("video"), "editorial")
})

test("stripEditorialOnlySearchParams removes editorial filters", () => {
  assert.deepEqual(
    stripEditorialOnlySearchParams({
      q: "politics",
      categoryId: "cat-1",
      eventId: "event-1",
      city: "Mumbai",
      contributorId: "contrib-1",
      year: 2024,
      month: 3,
      mode: "events",
      segment: "caricature",
    }),
    {
      q: "politics",
      categoryId: undefined,
      eventId: undefined,
      city: undefined,
      contributorId: undefined,
      year: undefined,
      month: undefined,
      mode: "images",
      segment: "caricature",
    },
  )
})

test("applySearchSegmentChange keeps query when switching to caricature", () => {
  assert.deepEqual(
    applySearchSegmentChange(
      {
        q: "satire",
        categoryId: "cat-1",
        eventId: "event-1",
        segment: "editorial",
      },
      "caricature",
    ),
    {
      q: "satire",
      categoryId: undefined,
      eventId: undefined,
      city: undefined,
      contributorId: undefined,
      year: undefined,
      month: undefined,
      mode: "images",
      segment: "caricature",
    },
  )
})

test("buildSearchPageHref omits default editorial segment", () => {
  assert.equal(buildSearchPageHref({ q: "food" }), "/search?q=food")
  assert.equal(
    buildSearchPageHref({ q: "food", segment: "caricature" }),
    "/search?q=food&segment=caricature",
  )
})

test("buildHomeHeroSearchHref always targets editorial segment", () => {
  assert.equal(buildHomeHeroSearchHref("  eating food  "), "/search?q=eating%20food&segment=editorial")
  assert.equal(buildHomeHeroSearchHref(""), "/search?segment=editorial")
})
