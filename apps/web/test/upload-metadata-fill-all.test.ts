import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildFillAllMetadataDraft,
  isFillAllDisabled,
} from "../src/lib/upload-metadata-fill-all"

describe("upload metadata fill-all helpers", () => {
  it("builds draft from trimmed event title for all three fields", () => {
    const draft = buildFillAllMetadataDraft("  IPL Final 2026  ")
    assert.deepEqual(draft, {
      caption: "IPL Final 2026",
      keywords: "IPL Final 2026",
      whoIsInPicture: "IPL Final 2026",
    })
  })

  it("returns null when event title is empty or whitespace", () => {
    assert.equal(buildFillAllMetadataDraft(""), null)
    assert.equal(buildFillAllMetadataDraft("   "), null)
  })

  it("disables fill-all when event title is empty", () => {
    assert.equal(isFillAllDisabled(""), true)
    assert.equal(isFillAllDisabled("   "), true)
    assert.equal(isFillAllDisabled("Event Name"), false)
  })
})
