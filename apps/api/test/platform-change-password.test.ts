import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hashPhotographerPortalPassword,
  validatePhotographerPortalPasswordStrength,
  verifyPhotographerPortalPassword,
} from "../src/lib/auth/contributor-password"

describe("platform change password password rules", () => {
  it("rejects passwords shorter than 6 characters", () => {
    assert.equal(validatePhotographerPortalPasswordStrength("short"), "Password must be at least 6 characters.")
  })

  it("accepts a 6-character password", () => {
    assert.equal(validatePhotographerPortalPasswordStrength("pass12"), null)
  })

  it("accepts a longer password and verifies after hash", async () => {
    const plain = "pass12"
    const hash = await hashPhotographerPortalPassword(plain)
    assert.equal(await verifyPhotographerPortalPassword(plain, hash), true)
    assert.equal(await verifyPhotographerPortalPassword("wrong1", hash), false)
  })
})
