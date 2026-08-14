import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { AppError } from "../src/lib/errors"

describe("caricature clear preview access helpers", () => {
  it("exports entitlement, publish, and owner guard helpers", async () => {
    const mod = await import("../src/lib/caricatures/caricature-clear-preview-access")
    assert.equal(typeof mod.assertSubscriberHasActiveCaricatureAccess, "function")
    assert.equal(typeof mod.assertCaricatureIsPubliclyPublished, "function")
    assert.equal(typeof mod.assertContributorOwnsPublishedCaricature, "function")
    assert.equal(typeof mod.resolveCaricatureClearPreviewActor, "function")
    assert.equal(typeof mod.normalizeCaricatureClearPreviewContributorId, "function")
  })

  it("resolves preview actors with staff taking precedence", async () => {
    const { resolveCaricatureClearPreviewActor } = await import(
      "../src/lib/caricatures/caricature-clear-preview-access"
    )

    assert.equal(
      resolveCaricatureClearPreviewActor({
        staffActorId: "staff-1",
        authUserId: "user-1",
        contributorId: "contributor-1",
      }),
      "staff",
    )
    assert.equal(
      resolveCaricatureClearPreviewActor({
        staffActorId: null,
        authUserId: "user-1",
        contributorId: "contributor-1",
      }),
      "subscriber",
    )
    assert.equal(
      resolveCaricatureClearPreviewActor({
        staffActorId: null,
        authUserId: null,
        contributorId: "contributor-1",
      }),
      "contributor",
    )
    assert.equal(
      resolveCaricatureClearPreviewActor({
        staffActorId: null,
        authUserId: null,
        contributorId: null,
      }),
      null,
    )
  })

  it("normalizes contributor ids used for owner clear previews", async () => {
    const { normalizeCaricatureClearPreviewContributorId } = await import(
      "../src/lib/caricatures/caricature-clear-preview-access"
    )

    assert.equal(
      normalizeCaricatureClearPreviewContributorId("11111111-1111-4111-8111-111111111111"),
      "11111111-1111-4111-8111-111111111111",
    )
    assert.equal(normalizeCaricatureClearPreviewContributorId("not-a-uuid"), null)
    assert.equal(normalizeCaricatureClearPreviewContributorId("  "), null)
  })

  it("AppError codes used by clear preview remain stable", () => {
    const entitlement = new AppError(403, "ENTITLEMENT_REQUIRED", "Caricature access is required.")
    const owner = new AppError(403, "CARICATURE_OWNER_REQUIRED", "You can only view clear previews of your own caricatures.")
    const missing = new AppError(404, "CARICATURE_NOT_FOUND", "Caricature was not found.")
    assert.equal(entitlement.code, "ENTITLEMENT_REQUIRED")
    assert.equal(owner.code, "CARICATURE_OWNER_REQUIRED")
    assert.equal(missing.code, "CARICATURE_NOT_FOUND")
  })
})
