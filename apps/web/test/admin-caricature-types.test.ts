import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  caricatureLanguageRequiresVisibleText,
  caricatureLanguageShowsTranslation,
  formatCaricatureStringList,
  parseCaricatureStringList,
} from "../src/lib/caricatures/caricature-upload-metadata"

describe("admin caricature types", () => {
  it("parses comma-separated string lists", () => {
    assert.deepEqual(parseCaricatureStringList("election, politics; satire"), [
      "election",
      "politics",
      "satire",
    ])
  })

  it("formats string lists for textarea defaults", () => {
    assert.equal(formatCaricatureStringList(["a", "b"]), "a, b")
  })

  it("hides visible text for NO_VISIBLE_TEXT", () => {
    assert.equal(caricatureLanguageRequiresVisibleText("NO_VISIBLE_TEXT"), false)
    assert.equal(caricatureLanguageShowsTranslation("ENGLISH"), false)
    assert.equal(caricatureLanguageShowsTranslation("HINDI"), true)
  })
})
