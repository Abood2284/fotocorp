import Link from "next/link"
import type { HelpArticleListItem } from "@/lib/api/staff-help-api"
import { formatHelpMetaLine } from "@/lib/staff/help-format"
import { cn } from "@/lib/utils"

interface HelpArticleCardProps {
  article: HelpArticleListItem
}

export function HelpArticleCard({ article }: HelpArticleCardProps) {
  const metaLine = formatHelpMetaLine({
    difficulty: article.difficulty,
    estimatedMinutes: article.estimatedMinutes,
    updatedAt: article.updatedAt,
    publishedAt: article.publishedAt,
  })

  return (
    <Link
      href={`/staff/help/${article.slug}`}
      className="group block rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-accent-wash/40"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">{article.category.name}</p>
        {article.status !== "PUBLISHED" ? <StatusBadge status={article.status} /> : null}
      </div>

      <h3 className="mt-2 font-serif text-lg font-semibold text-foreground group-hover:text-primary">
        {article.title}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{article.summary}</p>

      {article.tags.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex rounded-none border border-border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      {metaLine ? <p className="mt-4 text-xs text-muted-foreground">{metaLine}</p> : null}
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-none border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        status === "DRAFT"
          ? "border-border bg-muted text-muted-foreground"
          : "border-border bg-surface-stone text-foreground",
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  )
}
