import { HelpArticleMarkdown } from "@/components/staff/help/help-article-markdown"
import { getHelpMediaDisplayUrl } from "@/lib/staff/help-media"
import { isHelpArticleHtmlContent, sanitizeHelpArticleHtml } from "@/lib/staff/help-article-content"
import { cn } from "@/lib/utils"

interface HelpArticleBodyProps {
  content: string
  className?: string
  mediaDisplayUrl?: (mediaId: string) => string
}

export function HelpArticleBody({
  content,
  className,
  mediaDisplayUrl = getHelpMediaDisplayUrl,
}: HelpArticleBodyProps) {
  const trimmed = content.trim()
  if (!trimmed) return null

  if (isHelpArticleHtmlContent(trimmed)) {
    const sanitized = rewriteHelpMediaUrls(sanitizeHelpArticleHtml(trimmed), mediaDisplayUrl)
    return (
      <div
        className={cn("help-article-body space-y-4 text-sm leading-7 text-foreground-body", className)}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    )
  }

  return <HelpArticleMarkdown content={rewriteHelpMediaUrls(trimmed, mediaDisplayUrl)} className={className} />
}

function rewriteHelpMediaUrls(html: string, mediaDisplayUrl: (mediaId: string) => string) {
  return html.replace(/(<(?:img|video)\b[^>]*\ssrc=")([^"]+)(")/gi, (match, prefix, src, suffix) => {
    const mediaId = readMediaIdFromSrc(src)
    if (!mediaId) return match
    return `${prefix}${mediaDisplayUrl(mediaId)}${suffix}`
  }).replace(/\/api\/(?:staff|contributor)\/help\/media\/([^/?#"'\s]+)/gi, (_match, mediaId: string) => {
    return mediaDisplayUrl(decodeURIComponent(mediaId))
  })
}

function readMediaIdFromSrc(src: string) {
  const trimmed = src.trim()
  if (!trimmed) return null

  const helpMatch = trimmed.match(/\/api\/(?:staff|contributor)\/help\/media\/([^/?#]+)/i)
  if (helpMatch?.[1]) return decodeURIComponent(helpMatch[1])

  const uuidMatch = trimmed.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
  if (uuidMatch?.[0]) return uuidMatch[0]

  return null
}
