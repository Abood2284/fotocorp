import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildHelpArticlePayload,
  buildStaffHelpManageHref,
  createEmptyHelpArticleFormValues,
  deriveSlugFromTitle,
  slugifyHelpText,
  validateHelpArticleForm,
} from "../src/lib/staff/help-form"

describe("help-form helpers", () => {
  it("slugifies titles for create flows", () => {
    assert.equal(slugifyHelpText("How to Edit a Caption"), "how-to-edit-a-caption")
  })

  it("auto-generates slug until manually edited", () => {
    assert.equal(deriveSlugFromTitle("Upload Assets", "", false), "upload-assets")
    assert.equal(deriveSlugFromTitle("Upload Assets", "custom-slug", true), "custom-slug")
  })

  it("validates required article fields", () => {
    const errors = validateHelpArticleForm(createEmptyHelpArticleFormValues())
    assert.ok(errors.title)
    assert.ok(errors.slug)
    assert.ok(errors.summary)
    assert.ok(errors.bodyMarkdown)
    assert.ok(errors.categoryId)
  })

  it("builds status-specific article payloads", () => {
    const values = {
      ...createEmptyHelpArticleFormValues(),
      title: "Upload guide",
      slug: "upload-guide",
      summary: "How to upload assets.",
      bodyMarkdown: "## Steps\n\nUpload files.",
      categoryId: "11111111-1111-4111-8111-111111111111",
      audienceRoles: ["CAPTION_WRITER"],
      estimatedMinutes: "5",
      sortOrder: "2",
    }

    const draftPayload = buildHelpArticlePayload(values, "DRAFT")
    assert.equal(draftPayload.status, "DRAFT")
    assert.equal(draftPayload.estimatedMinutes, 5)
    assert.equal(draftPayload.sortOrder, 2)

    const publishPayload = buildHelpArticlePayload(values, "PUBLISHED")
    assert.equal(publishPayload.status, "PUBLISHED")
  })

  it("builds management list hrefs with filters", () => {
    assert.equal(buildStaffHelpManageHref({ q: "caption", status: "DRAFT" }), "/staff/help/manage?q=caption&status=DRAFT")
    assert.equal(buildStaffHelpManageHref({}), "/staff/help/manage")
  })
})
