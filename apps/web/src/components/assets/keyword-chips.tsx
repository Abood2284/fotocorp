"use client"

import Link from "next/link"
import { useState } from "react"

interface KeywordChipsProps {
  keywords: string[]
  initialLimit?: number
}

export function KeywordChips({ keywords, initialLimit = 12 }: KeywordChipsProps) {
  const [expanded, setExpanded] = useState(false)
  const visibleKeywords = expanded ? keywords : keywords.slice(0, initialLimit)
  const hiddenCount = Math.max(0, keywords.length - visibleKeywords.length)

  if (keywords.length === 0) return null

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-background p-4 sm:p-5">
      <h2 className="text-base font-semibold text-foreground">Keywords</h2>
      <div className="flex flex-wrap gap-2">
        {visibleKeywords.map((keyword) => (
          <Link
            key={keyword}
            href={`/search?q=${encodeURIComponent(keyword)}`}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {keyword}
          </Link>
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
          >
            Show {hiddenCount} more
          </button>
        )}
        {expanded && keywords.length > initialLimit && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
          >
            Show less
          </button>
        )}
      </div>
    </section>
  )
}
