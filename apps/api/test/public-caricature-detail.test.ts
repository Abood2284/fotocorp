import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { AppError } from "../src/lib/errors"
import { getPublicCaricatureDetail } from "../src/lib/caricatures/public-caricature-assets"

describe("public caricature detail", () => {
  it("rejects invalid asset ids before querying", async () => {
    await assert.rejects(
      () => getPublicCaricatureDetail(createDbStub(), "not-a-uuid"),
      (error: unknown) => {
        assert.ok(error instanceof AppError)
        assert.equal(error.code, "INVALID_CARICATURE_ID")
        return true
      },
    )
  })
})

function createDbStub() {
  return {
    execute: async () => {
      throw new Error("db should not be queried for invalid ids")
    },
  }
}
