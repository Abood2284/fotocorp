import { listContextualHelpLinks } from "@/lib/api/staff-help-api"
import { ContextualHelpLinks, type ContextualHelpLinkItem } from "@/components/staff/help/contextual-help-links"
import type { HelpContextKey } from "@/lib/staff/help-context-keys"

interface ContextualHelpPanelProps {
  contextKey: HelpContextKey
  placement?: "PAGE_HEADER" | "SIDEBAR_CARD" | "INLINE_PANEL"
  title?: string
  compact?: boolean
  className?: string
  cookieHeader?: string
}

export async function ContextualHelpPanel({
  contextKey,
  placement = "PAGE_HEADER",
  title,
  compact = false,
  className,
  cookieHeader,
}: ContextualHelpPanelProps) {
  let items: ContextualHelpLinkItem[] = []

  try {
    const response = await listContextualHelpLinks(contextKey, {
      placement,
      limit: 5,
      cookieHeader,
    })
    items = response.items.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      article: { slug: item.article.slug },
    }))
  } catch {
    return null
  }

  return <ContextualHelpLinks items={items} title={title} compact={compact} className={className} />
}
