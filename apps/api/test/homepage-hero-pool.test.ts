import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { HOMEPAGE_HERO_POOL_SIZE } from "../src/db/schema/public-homepage-hero-pool-items"
import { homepageHeroPoolReplaceSchema } from "../src/routes/internal/admin-homepage-hero-pool/validators"

describe("homepageHeroPoolReplaceSchema", () => {
  it("requires exactly 25 unique asset ids", () => {
    const assetIds = Array.from({ length: HOMEPAGE_HERO_POOL_SIZE }, (_, index) =>
      `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
    )

    const parsed = homepageHeroPoolReplaceSchema.safeParse({ assetIds })
    assert.equal(parsed.success, true)
  })

  it("rejects pools smaller than 25", () => {
    const parsed = homepageHeroPoolReplaceSchema.safeParse({
      assetIds: ["11111111-1111-4111-8111-111111111111"],
    })
    assert.equal(parsed.success, false)
  })
})
