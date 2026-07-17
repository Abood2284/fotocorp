import { marked } from "marked"
import sanitizeHtml from "sanitize-html"

marked.setOptions({ gfm: true, breaks: true })

const HTML_CONTENT_PATTERN = /^<(p|h[1-6]|ul|ol|li|blockquote|div|img|video|figure|pre|hr)\b/i

export function isHelpArticleHtmlContent(content: string) {
  const trimmed = content.trim()
  if (!trimmed) return false
  return HTML_CONTENT_PATTERN.test(trimmed)
}

export function stripHelpArticleHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function hasHelpArticleBodyContent(content: string) {
  const trimmed = content.trim()
  if (!trimmed) return false

  if (isHelpArticleHtmlContent(trimmed)) {
    if (stripHelpArticleHtml(trimmed)) return true
    if (/<(img|video)\b/i.test(trimmed)) return true
    if (/data-media-id\s*=/i.test(trimmed)) return true
    return false
  }

  return trimmed.length > 0
}

export function markdownToHelpArticleHtml(markdown: string) {
  const trimmed = markdown.trim()
  if (!trimmed) return "<p></p>"
  return marked.parse(trimmed, { async: false }) as string
}

export function prepareHelpBodyForEditor(content: string) {
  const trimmed = content.trim()
  if (!trimmed) return "<p></p>"
  if (isHelpArticleHtmlContent(trimmed)) return trimmed
  return markdownToHelpArticleHtml(trimmed)
}

const HELP_ARTICLE_ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "a",
  "blockquote",
  "code",
  "pre",
  "hr",
  "br",
  "img",
  "video",
  "source",
  "div",
  "span",
]

const HELP_ARTICLE_ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "title",
  "controls",
  "preload",
  "class",
  "data-media-id",
  "data-help-video",
]

const HELP_ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: HELP_ARTICLE_ALLOWED_TAGS,
  allowedAttributes: {
    "*": HELP_ARTICLE_ALLOWED_ATTR,
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https"],
    video: ["http", "https"],
    source: ["http", "https"],
  },
  allowProtocolRelative: false,
}

export function sanitizeHelpArticleHtml(html: string) {
  return sanitizeHtml(html, HELP_ARTICLE_SANITIZE_OPTIONS)
}

export function normalizeHelpArticleHtmlForSave(html: string) {
  return sanitizeHelpArticleHtml(html.trim())
}
