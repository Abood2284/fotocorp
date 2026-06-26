"use client"

import { useEffect, useState } from "react"
import { ContextualHelpLinks, type ContextualHelpLinkItem } from "@/components/staff/help/contextual-help-links"
import type { HelpContextKey } from "@/lib/staff/help-context-keys"

interface ContextualHelpPanelClientProps {
  contextKey: HelpContextKey
  placement?: "PAGE_HEADER" | "SIDEBAR_CARD" | "INLINE_PANEL"
  title?: string
  compact?: boolean
  className?: string
}

export function ContextualHelpPanelClient({
  contextKey,
  placement = "PAGE_HEADER",
  title,
  compact = false,
  className,
}: ContextualHelpPanelClientProps) {
  const [items, setItems] = useState<ContextualHelpLinkItem[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadLinks() {
      try {
        const params = new URLSearchParams({
          contextKey,
          limit: "5",
        })
        if (placement) params.set("placement", placement)

        const response = await fetch(`/api/staff/help/contextual-links?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        })
        if (!response.ok) return

        const payload = (await response.json()) as {
          ok?: boolean
          items?: Array<{
            id: string
            label: string
            description?: string
            article: { slug: string }
          }>
        }

        if (!payload.ok || !payload.items?.length || cancelled) return

        setItems(
          payload.items.map((item) => ({
            id: item.id,
            label: item.label,
            description: item.description,
            article: { slug: item.article.slug },
          })),
        )
      } catch {
        // Fail silently — contextual help must not block workflows.
      }
    }

    void loadLinks()
    return () => {
      cancelled = true
    }
  }, [contextKey, placement])

  return <ContextualHelpLinks items={items} title={title} compact={compact} className={className} />
}
