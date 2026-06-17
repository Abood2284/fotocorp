import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildCaricatureDetailHref,
  buildCaricatureSearchBackHref,
  formatCaricatureLanguageLabel,
} from "../src/lib/search/caricature-search"

test("buildCaricatureDetailHref links to public detail page", () => {
  assert.equal(
    buildCaricatureDetailHref("11111111-1111-4111-8111-111111111111"),
    "/caricatures/11111111-1111-4111-8111-111111111111",
  )
})

test("buildCaricatureSearchBackHref preserves caricature segment and query", () => {
  assert.equal(
    buildCaricatureSearchBackHref("politics"),
    "/search?segment=caricature&q=politics",
  )
  assert.equal(buildCaricatureSearchBackHref(), "/search?segment=caricature")
})

test("formatCaricatureLanguageLabel maps known language codes", () => {
  assert.equal(formatCaricatureLanguageLabel("MARATHI"), "Marathi")
  assert.equal(formatCaricatureLanguageLabel("unknown"), "UNKNOWN")
})
