import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getDefaultStaffLandingPath,
  staffCanAccessContributorUploads,
  staffRoleCanAccessPath,
  staffRoleIsWorkspaceOnly,
} from "../src/lib/staff/staff-route-access"

describe("staff-route-access", () => {
  it("CAPTION_WRITER can access uploads, captions, catalog, homepage hero, and events", () => {
    assert.equal(staffCanAccessContributorUploads("CAPTION_WRITER"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/contributor-uploads"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/contributor-uploads/new"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/caricatures"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/captions"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/catalog"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/catalog/asset-id-123"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/homepage-hero"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/events"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/events/event-id-123"), true)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/events/event-id-123/upload"), true)
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
    assert.equal(staffRoleCanAccessPath("SUPER_ADMIN", "/staff/team-performance/30d94c5c-4d65-483f-b8b6-dcd246827a77"), true)
  })

  it("non-super-admin roles cannot access audit or team performance", () => {
    assert.equal(staffRoleCanAccessPath("CATALOG_MANAGER", "/staff/audit"), false)
    assert.equal(staffRoleCanAccessPath("SUPPORT", "/staff/audit"), false)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/audit"), false)
    assert.equal(staffRoleCanAccessPath("CAPTION_WRITER", "/staff/team-performance"), false)
    assert.equal(
      staffRoleCanAccessPath("CAPTION_WRITER", "/staff/team-performance/30d94c5c-4d65-483f-b8b6-dcd246827a77"),
      false,
    )
  })

  it("CAPTION_WRITER is workspace-only", () => {
    assert.equal(staffRoleIsWorkspaceOnly("CAPTION_WRITER"), true)
    assert.equal(staffRoleIsWorkspaceOnly("SUPER_ADMIN"), false)
  })

  it("all staff roles can access Help Center routes", () => {
    for (const role of ["CAPTION_WRITER", "CATALOG_MANAGER", "REVIEWER", "SUPPORT", "FINANCE"] as const) {
      assert.equal(staffRoleCanAccessPath(role, "/staff/help"), true)
      assert.equal(staffRoleCanAccessPath(role, "/staff/help/how-to-edit-an-asset-caption"), true)
    }
  })

  it("only help managers can access help management routes", () => {
    assert.equal(staffRoleCanAccessPath("SUPER_ADMIN", "/staff/help/manage"), true)
    assert.equal(staffRoleCanAccessPath("SUPER_ADMIN", "/staff/help/manage/new"), true)
    assert.equal(staffRoleCanAccessPath("CATALOG_MANAGER", "/staff/help/manage"), true)
    assert.equal(staffRoleCanAccessPath("CATALOG_MANAGER", "/staff/help/manage/categories"), true)

    for (const role of ["REVIEWER", "CAPTION_WRITER", "SUPPORT", "FINANCE", "CAPTION_MANAGER"] as const) {
      assert.equal(staffRoleCanAccessPath(role, "/staff/help/manage"), false)
      assert.equal(staffRoleCanAccessPath(role, "/staff/help/manage/new"), false)
    }
  })
})
