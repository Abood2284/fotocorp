import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasHelpArticleBodyContent,
  isHelpArticleHtmlContent,
  markdownToHelpArticleHtml,
  normalizeHelpArticleHtmlForSave,
  prepareHelpBodyForEditor,
  sanitizeHelpArticleHtml,
} from "../src/lib/staff/help-article-content"

describe("help article content helpers", () => {
  it("detects html vs markdown content", () => {
    assert.equal(isHelpArticleHtmlContent("<p>Hello</p>"), true)
    assert.equal(isHelpArticleHtmlContent("## Steps\n\nUpload files."), false)
  })

  it("accepts video-only html bodies", () => {
    const html =
      '<div data-help-video="true" data-media-id="11111111-1111-4111-8111-111111111111"><video controls></video></div>'
    assert.equal(hasHelpArticleBodyContent(html), true)
  })

  it("converts legacy markdown for the editor", () => {
    const html = prepareHelpBodyForEditor("## Upload\n\nSave your draft.")
    assert.match(html, /<h2>Upload<\/h2>/)
  })

  it("sanitizes unsafe html while keeping media embeds", () => {
    const sanitized = sanitizeHelpArticleHtml(
      '<p onclick="alert(1)">Safe</p><img src="/api/staff/help/media/abc" data-media-id="abc" alt="Shot" /><script>alert(1)</script>',
    )
    assert.match(sanitized, /<p>Safe<\/p>/)
    assert.match(sanitized, /data-media-id="abc"/)
    assert.doesNotMatch(sanitized, /script/)
    assert.doesNotMatch(sanitized, /onclick/)
  })

  it("normalizes markdown to html on save path", () => {
    const markdownHtml = markdownToHelpArticleHtml("**Bold** text")
    assert.match(normalizeHelpArticleHtmlForSave(markdownHtml), /<strong>Bold<\/strong>/)
  })
})
