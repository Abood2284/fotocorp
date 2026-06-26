import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildContextualHelpArticleHref, getStaffHelpContextLabel, STAFF_HELP_CONTEXTS } from "../src/lib/staff/help-contexts"
import { HELP_CONTEXT_KEYS } from "../src/lib/staff/help-context-keys"
import { staffRoleCanAccessPath } from "../src/lib/staff/staff-route-access"

describe("staff help context constants", () => {
  it("includes labels for all known context keys", () => {
    assert.equal(STAFF_HELP_CONTEXTS.length, HELP_CONTEXT_KEYS.length)
    assert.equal(getStaffHelpContextLabel("staff.assets.upload"), "Asset upload")
    assert.ok(STAFF_HELP_CONTEXTS.some((context) => context.key === "staff.uploads.review"))
  })

  it("builds help article hrefs under /staff/help", () => {
    assert.equal(
      buildContextualHelpArticleHref("how-to-upload-editorial-images"),
      "/staff/help/how-to-upload-editorial-images",
    )
  })
})

describe("staff contextual help route access", () => {
  it("restricts contextual link management to help managers", () => {
    assert.equal(staffRoleCanAccessPath("SUPER_ADMIN", "/staff/help/manage/contextual-links"), true)
    assert.equal(staffRoleCanAccessPath("CATALOG_MANAGER", "/staff/help/manage/contextual-links"), true)
    assert.equal(staffRoleCanAccessPath("REVIEWER", "/staff/help/manage/contextual-links"), false)
  })
})

describe("contextual help panel rendering contract", () => {
  it("uses article slug paths for contextual links", () => {
    const slug = "how-to-edit-an-asset-caption"
    assert.equal(buildContextualHelpArticleHref(slug), `/staff/help/${slug}`)
  })
})
