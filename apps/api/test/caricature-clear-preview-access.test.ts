import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { AppError } from "../src/lib/errors"

describe("caricature clear preview access helpers", () => {
  it("exports entitlement and publish guard helpers", async () => {
    const mod = await import("../src/lib/caricatures/caricature-clear-preview-access")
    assert.equal(typeof mod.assertSubscriberHasActiveCaricatureAccess, "function")
    assert.equal(typeof mod.assertCaricatureIsPubliclyPublished, "function")
  })

  it("AppError codes used by clear preview remain stable", () => {
    const entitlement = new AppError(403, "ENTITLEMENT_REQUIRED", "Caricature access is required.")
    const missing = new AppError(404, "CARICATURE_NOT_FOUND", "Caricature was not found.")
    assert.equal(entitlement.code, "ENTITLEMENT_REQUIRED")
    assert.equal(missing.code, "CARICATURE_NOT_FOUND")
  })
})
