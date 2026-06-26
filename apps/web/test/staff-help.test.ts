import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildStaffHelpHref } from "../src/lib/api/staff-help-api"

describe("staff help href builder", () => {
  it("builds query strings for search and filters", () => {
    assert.equal(buildStaffHelpHref({ q: "caption" }), "/staff/help?q=caption")
    assert.equal(
      buildStaffHelpHref({ q: "upload", category: "asset-management", tag: "upload" }),
      "/staff/help?q=upload&category=asset-management&tag=upload",
    )
    assert.equal(buildStaffHelpHref({}), "/staff/help")
  })
})
