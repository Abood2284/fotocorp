import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildContributorHelpArticleHref,
  getContributorHelpLinkItems,
  getContributorHelpMediaDisplayUrl,
  isContributorHelpArticleSlug,
} from "../src/lib/contributor-help"

describe("contributor help links", () => {
  it("allows only contributor upload guide slugs", () => {
    assert.equal(isContributorHelpArticleSlug("how-to-upload-caricature-images"), true)
    assert.equal(isContributorHelpArticleSlug("how-to-upload-editorial-images"), true)
    assert.equal(isContributorHelpArticleSlug("how-to-approve-contributor-uploads"), false)
  })

  it("builds portal help hrefs instead of staff help paths", () => {
    assert.equal(
      buildContributorHelpArticleHref("how-to-upload-caricature-images"),
      "/contributor/help/how-to-upload-caricature-images",
    )
    assert.equal(
      getContributorHelpMediaDisplayUrl("11111111-1111-4111-8111-111111111111"),
      "/api/contributor/help/media/11111111-1111-4111-8111-111111111111",
    )
  })

  it("shows editorial and caricature guides from allowed upload types", () => {
    const editorial = getContributorHelpLinkItems(["EDITORIAL"])
    assert.equal(editorial.length, 1)
    assert.equal(editorial[0]?.label, "How to upload editorial images")
    assert.equal(editorial[0]?.href, "/contributor/help/how-to-upload-editorial-images")

    const caricature = getContributorHelpLinkItems(["CARICATURE"])
    assert.equal(caricature.length, 1)
    assert.equal(caricature[0]?.label, "How to upload caricature images")
    assert.equal(caricature[0]?.href, "/contributor/help/how-to-upload-caricature-images")

    const both = getContributorHelpLinkItems(["EDITORIAL", "CARICATURE"])
    assert.equal(both.length, 2)
  })
})
