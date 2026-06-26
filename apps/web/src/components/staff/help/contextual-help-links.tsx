import Link from "next/link"
import { CircleHelp } from "lucide-react"
import { cn } from "@/lib/utils"
import { buildContextualHelpArticleHref } from "@/lib/staff/help-contexts"

export interface ContextualHelpLinkItem {
  id: string
  label: string
  description?: string
  article: {
    slug: string
  }
}

interface ContextualHelpLinksProps {
  items: ContextualHelpLinkItem[]
  title?: string
  compact?: boolean
  className?: string
}

export function ContextualHelpLinks({
  items,
  title = "Need help?",
  compact = false,
  className,
}: ContextualHelpLinksProps) {
  if (!items.length) return null

  return (
    <aside
      className={cn(
        "rounded-lg border border-border/70 bg-muted/20 px-4 py-3",
        compact ? "text-sm" : "",
        className,
      )}
      aria-label="Contextual help links"
    >
      <div className="flex items-start gap-2">
        <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="font-medium text-foreground">{title}</p>
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={buildContextualHelpArticleHref(item.article.slug)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {item.label}
                </Link>
                {!compact && item.description ? (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}
