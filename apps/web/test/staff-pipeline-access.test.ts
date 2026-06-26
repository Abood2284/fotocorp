import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { staffRoleCanAccessPath } from "../src/lib/staff/staff-route-access"

describe("staff pipeline route access", () => {
  it("allows SUPER_ADMIN and CATALOG_MANAGER", () => {
    assert.equal(staffRoleCanAccessPath("SUPER_ADMIN", "/staff/pipeline"), true)
    assert.equal(staffRoleCanAccessPath("CATALOG_MANAGER", "/staff/pipeline"), true)
    assert.equal(staffRoleCanAccessPath("SUPER_ADMIN", "/staff/pipeline?assetId=abc"), true)
  })

  it("denies other staff roles", () => {
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/pipeline"), false)
    assert.equal(staffRoleCanAccessPath("REVIEWER", "/staff/pipeline"), false)
    assert.equal(staffRoleCanAccessPath("SUPPORT", "/staff/pipeline"), false)
  })
})
