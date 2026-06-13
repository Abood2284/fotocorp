import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getDefaultStaffLandingPath,
  staffCanAccessContributorUploads,
  staffRoleCanAccessPath,
  staffRoleIsWorkspaceOnly,
} from "../src/lib/staff/staff-route-access"

describe("staff-route-access", () => {
  it("CAPTION_WRITER can access uploads and captions", () => {
    assert.equal(staffCanAccessContributorUploads("CAPTION_WRITER"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/contributor-uploads"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/contributor-uploads/new"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/captions"), true)
    assert.equal(getDefaultStaffLandingPath("CAPTION_WRITER"), "/staff/contributor-uploads")
  })

  it("CATALOG_MANAGER and REVIEWER cannot access contributor uploads", () => {
    assert.equal(staffCanAccessContributorUploads("CATALOG_MANAGER"), false)
    assert.equal(staffCanAccessContributorUploads("REVIEWER"), false)
    assert.equal(staffRoleCanAccessPath("CATALOG_MANAGER", "/staff/contributor-uploads"), false)
    assert.equal(staffRoleCanAccessPath("REVIEWER", "/staff/contributor-uploads"), false)
  })

  it("CATALOG_MANAGER keeps catalog access with new landing path", () => {
    assert.equal(staffRoleCanAccessPath("CATALOG_MANAGER", "/staff/catalog"), true)
    assert.equal(getDefaultStaffLandingPath("CATALOG_MANAGER"), "/staff/catalog")
  })

  it("SUPER_ADMIN remains unrestricted", () => {
    assert.equal(staffRoleCanAccessPath("SUPER_ADMIN", "/staff/contributor-uploads"), true)
    assert.equal(staffRoleCanAccessPath("SUPER_ADMIN", "/staff/captions"), true)
    assert.equal(staffRoleCanAccessPath("SUPER_ADMIN", "/staff/catalog"), true)
    assert.equal(staffRoleCanAccessPath("SUPER_ADMIN", "/staff/audit"), true)
    assert.equal(staffRoleCanAccessPath("SUPER_ADMIN", "/staff/team-performance"), true)
  })

  it("non-super-admin roles cannot access audit or team performance", () => {
    assert.equal(staffRoleCanAccessPath("CATALOG_MANAGER", "/staff/audit"), false)
    assert.equal(staffRoleCanAccessPath("SUPPORT", "/staff/audit"), false)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/audit"), false)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/team-performance"), false)
  })

  it("CAPTION_WRITER is workspace-only", () => {
    assert.equal(staffRoleIsWorkspaceOnly("CAPTION_WRITER"), true)
    assert.equal(staffRoleIsWorkspaceOnly("SUPER_ADMIN"), false)
  })
})
