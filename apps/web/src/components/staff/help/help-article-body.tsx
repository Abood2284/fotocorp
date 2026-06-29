import { HelpArticleMarkdown } from "@/components/staff/help/help-article-markdown"
import { getHelpMediaDisplayUrl } from "@/lib/staff/help-media"
import { isHelpArticleHtmlContent, sanitizeHelpArticleHtml } from "@/lib/staff/help-article-content"
import { cn } from "@/lib/utils"

interface HelpArticleBodyProps {
  content: string
  className?: string
}

export function HelpArticleBody({ content, className }: HelpArticleBodyProps) {
  const trimmed = content.trim()
  if (!trimmed) return null

  if (isHelpArticleHtmlContent(trimmed)) {
    const sanitized = rewriteHelpMediaUrls(sanitizeHelpArticleHtml(trimmed))
    return (
      <div
        className={cn("help-article-body space-y-4 text-sm leading-7 text-foreground-body", className)}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    )
  }

  return <HelpArticleMarkdown content={trimmed} className={className} />
}

function rewriteHelpMediaUrls(html: string) {
  return html.replace(/(<(?:img|video)\b[^>]*\ssrc=")([^"]+)(")/gi, (match, prefix, src, suffix) => {
    const mediaId = readMediaIdFromSrc(src)
    if (!mediaId) return match
    return `${prefix}${getHelpMediaDisplayUrl(mediaId)}${suffix}`
  })
}

function readMediaIdFromSrc(src: string) {
  const trimmed = src.trim()
  if (!trimmed) return null

  const staffMatch = trimmed.match(/\/api\/staff\/help\/media\/([^/?#]+)/i)
  if (staffMatch?.[1]) return decodeURIComponent(staffMatch[1])

  const uuidMatch = trimmed.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
  if (uuidMatch?.[0]) return uuidMatch[0]

  return null
}
