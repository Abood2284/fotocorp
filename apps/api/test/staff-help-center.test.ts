import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canManageHelpContent,
  isArticleVisibleToStaffRole,
  slugifyHelpText,
} from "../src/lib/help-center/constants"
import {
  decodeHelpArticleCursor,
  encodeHelpArticleCursor,
} from "../src/lib/help-center/help-center-service"
import { HELP_CATEGORY_SEEDS, HELP_TAG_SEEDS } from "../src/lib/help-center/help-center-taxonomy"
import {
  createHelpArticleBodySchema,
  helpArticleFeedbackBodySchema,
  listHelpArticlesQuerySchema,
} from "../src/routes/staff/help/validators"

describe("help center constants", () => {
  it("allows managers to manage help content", () => {
    assert.equal(canManageHelpContent("SUPER_ADMIN"), true)
    assert.equal(canManageHelpContent("CATALOG_MANAGER"), true)
    assert.equal(canManageHelpContent("REVIEWER"), false)
  })

  it("treats empty audience roles as visible to all staff", () => {
    assert.equal(isArticleVisibleToStaffRole([], "REVIEWER"), true)
    assert.equal(isArticleVisibleToStaffRole(["CAPTION_WRITER"], "REVIEWER"), false)
    assert.equal(isArticleVisibleToStaffRole(["CAPTION_WRITER"], "CAPTION_WRITER"), true)
  })

  it("slugifies titles for article creation", () => {
    assert.equal(slugifyHelpText("How to Edit a Caption"), "how-to-edit-a-caption")
  })
})

describe("help center validators", () => {
  it("accepts bounded article list query params", () => {
    const parsed = listHelpArticlesQuerySchema.safeParse({
      q: "caption",
      category: "captions-metadata",
      tag: "caption",
      limit: "25",
    })
    assert.equal(parsed.success, true)
    if (parsed.success) assert.equal(parsed.data.limit, 25)
  })

  it("rejects invalid article slugs", () => {
    const parsed = createHelpArticleBodySchema.safeParse({
      categoryId: "11111111-1111-4111-8111-111111111111",
      title: "Test",
      slug: "Bad Slug",
      summary: "Summary",
      bodyMarkdown: "Body",
      status: "DRAFT",
      audienceRoles: ["SUPER_ADMIN"],
    })
    assert.equal(parsed.success, false)
  })

  it("requires at least one audience role when creating articles", () => {
    const parsed = createHelpArticleBodySchema.safeParse({
      categoryId: "11111111-1111-4111-8111-111111111111",
      title: "Test",
      summary: "Summary",
      bodyMarkdown: "Body",
      status: "DRAFT",
      audienceRoles: [],
    })
    assert.equal(parsed.success, false)
  })

  it("caps feedback comment length", () => {
    const parsed = helpArticleFeedbackBodySchema.safeParse({
      wasHelpful: true,
      comment: "x".repeat(1001),
    })
    assert.equal(parsed.success, false)
  })
})

describe("help center cursor encoding", () => {
  it("round-trips article list cursors", () => {
    const cursor = {
      categoryDisplayOrder: 30,
      sortOrder: 10,
      publishedAt: "2026-06-26T12:00:00.000Z",
      title: "How to edit an asset caption",
      id: "11111111-1111-4111-8111-111111111111",
    }
    const encoded = encodeHelpArticleCursor(cursor)
    assert.deepEqual(decodeHelpArticleCursor(encoded), cursor)
  })
})

describe("help center taxonomy seeds", () => {
  it("includes the expected starter categories and tags", () => {
    assert.equal(HELP_CATEGORY_SEEDS.length, 10)
    assert.ok(HELP_CATEGORY_SEEDS.some((row) => row.slug === "getting-started"))
    assert.equal(HELP_TAG_SEEDS.length, 17)
    assert.ok(HELP_TAG_SEEDS.some((row) => row.slug === "troubleshooting"))
  })
})
