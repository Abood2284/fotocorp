import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { validatePlatformNewPassword } from "../src/lib/platform-password-validation"

describe("validatePlatformNewPassword", () => {
  it("requires matching confirmation", () => {
    assert.equal(
      validatePlatformNewPassword("pass12", "pass98"),
      "New passwords do not match.",
    )
  })

  it("accepts a valid password pair", () => {
    assert.equal(validatePlatformNewPassword("pass12", "pass12"), null)
  })

  it("rejects passwords shorter than 6 characters", () => {
    assert.equal(validatePlatformNewPassword("short", "short"), "Password must be at least 6 characters.")
  })
})
