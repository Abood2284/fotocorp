import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { canManageHelpContent, isArticleVisibleToStaffRole } from "../src/lib/help-center/constants"
import { HELP_CONTEXT_KEYS, isValidHelpContextKey } from "../src/lib/help-center/help-contexts"
import { HELP_CONTEXTUAL_LINK_SEEDS } from "../src/lib/help-center/help-contextual-link-seeds"
import {
  assertValidHelpContextKey,
  isContextualLinkVisibleToStaff,
  resolveContextualLinkDescription,
  resolveContextualLinkLabel,
} from "../src/lib/help-center/help-contextual-links-service"
import {
  createContextualHelpLinkBodySchema,
  listContextualHelpLinksQuerySchema,
  updateContextualHelpLinkBodySchema,
} from "../src/routes/staff/help/validators"

describe("help contextual context keys", () => {
  it("validates known context key format", () => {
    assert.equal(isValidHelpContextKey("staff.assets.upload"), true)
    assert.equal(isValidHelpContextKey("Staff.Assets.Upload"), false)
    assert.equal(HELP_CONTEXT_KEYS.includes("staff.uploads.review"), true)
  })

  it("rejects invalid context keys in service guard", () => {
    assert.throws(
      () => assertValidHelpContextKey("invalid key"),
      (error: unknown) => error instanceof Error && error.message.includes("Context key must use lowercase"),
    )
  })
})

describe("help contextual link visibility", () => {
  it("shows only active published role-visible links to staff", () => {
    assert.equal(
      isContextualLinkVisibleToStaff({
        linkActive: true,
        articleStatus: "PUBLISHED",
        audienceRoles: [],
        staffRole: "REVIEWER",
      }),
      true,
    )
    assert.equal(
      isContextualLinkVisibleToStaff({
        linkActive: true,
        articleStatus: "DRAFT",
        audienceRoles: [],
        staffRole: "REVIEWER",
      }),
      false,
    )
    assert.equal(
      isContextualLinkVisibleToStaff({
        linkActive: false,
        articleStatus: "PUBLISHED",
        audienceRoles: [],
        staffRole: "REVIEWER",
      }),
      false,
    )
    assert.equal(
      isContextualLinkVisibleToStaff({
        linkActive: true,
        articleStatus: "PUBLISHED",
        audienceRoles: ["CAPTION_WRITER"],
        staffRole: "REVIEWER",
      }),
      false,
    )
  })

  it("reuses article audience role visibility rules", () => {
    assert.equal(isArticleVisibleToStaffRole(["CAPTION_WRITER"], "CAPTION_WRITER"), true)
    assert.equal(canManageHelpContent("REVIEWER"), false)
  })
})

describe("help contextual link presentation helpers", () => {
  it("falls back to article title and summary", () => {
    assert.equal(resolveContextualLinkLabel(null, "Article title"), "Article title")
    assert.equal(resolveContextualLinkLabel("Custom label", "Article title"), "Custom label")
    assert.equal(resolveContextualLinkDescription(null, "Article summary"), "Article summary")
  })
})

describe("help contextual link validators", () => {
  it("accepts staff contextual link list query", () => {
    const parsed = listContextualHelpLinksQuerySchema.safeParse({
      contextKey: "staff.assets.upload",
      limit: "5",
    })
    assert.equal(parsed.success, true)
  })

  it("requires article and context for create payload", () => {
    const parsed = createContextualHelpLinkBodySchema.safeParse({
      contextKey: "staff.assets.upload",
      articleId: "11111111-1111-4111-8111-111111111111",
      displayOrder: 10,
      isActive: true,
    })
    assert.equal(parsed.success, true)
  })

  it("rejects empty update payloads", () => {
    const parsed = updateContextualHelpLinkBodySchema.safeParse({})
    assert.equal(parsed.success, false)
  })
})

describe("help contextual link seeds", () => {
  it("defines slug-based mappings without hardcoded article ids", () => {
    assert.ok(HELP_CONTEXTUAL_LINK_SEEDS.length >= 3)
    for (const seed of HELP_CONTEXTUAL_LINK_SEEDS) {
      assert.match(seed.contextKey, /^[a-z0-9]+(\.[a-z0-9-]+)+$/)
      assert.ok(seed.articleSlug.length > 0)
    }
  })
})
