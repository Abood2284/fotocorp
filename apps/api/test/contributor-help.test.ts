import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isContributorHelpArticleSlug, isContributorVisibleHelpArticleStatus } from "../src/lib/help-center/contributor-help"

describe("contributor help article allowlist", () => {
  it("allows contributor upload guide slugs", () => {
    assert.equal(isContributorHelpArticleSlug("how-to-upload-caricature-images"), true)
    assert.equal(isContributorHelpArticleSlug("how-to-upload-editorial-images"), true)
    assert.equal(isContributorHelpArticleSlug("how-to-upload-caricatures"), true)
    assert.equal(isContributorHelpArticleSlug("how-to-approve-contributor-uploads"), false)
    assert.equal(isContributorHelpArticleSlug("how-to-edit-an-asset-caption"), false)
  })

  it("lets contributors read draft and published guides, but not archived ones", () => {
    assert.equal(isContributorVisibleHelpArticleStatus("DRAFT"), true)
    assert.equal(isContributorVisibleHelpArticleStatus("PUBLISHED"), true)
    assert.equal(isContributorVisibleHelpArticleStatus("ARCHIVED"), false)
  })
})
