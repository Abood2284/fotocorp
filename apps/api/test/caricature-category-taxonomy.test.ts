import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildCaricatureCategorySeeds,
  CARICATURE_CATEGORY_SEEDS,
  slugifyCaricatureCategoryName,
} from "../src/lib/caricatures/caricature-category-taxonomy"

describe("caricature category taxonomy", () => {
  it("defines eight MVP categories in display order", () => {
    assert.equal(CARICATURE_CATEGORY_SEEDS.length, 8)
    assert.deepEqual(
      CARICATURE_CATEGORY_SEEDS.map((item) => item.name),
      [
        "Politics",
        "Society",
        "Culture",
        "Sports",
        "Entertainment",
        "International",
        "Business",
        "General",
      ],
    )
  })

  it("slugifies category names for stable keys", () => {
    assert.equal(slugifyCaricatureCategoryName("International"), "international")
    assert.equal(slugifyCaricatureCategoryName("  Business  "), "business")
  })

  it("builds sequential sort order for custom seed lists", () => {
    const seeds = buildCaricatureCategorySeeds(["Alpha", "Beta"])
    assert.deepEqual(seeds, [
      { name: "Alpha", slug: "alpha", sortOrder: 1 },
      { name: "Beta", slug: "beta", sortOrder: 2 },
    ])
  })
})
