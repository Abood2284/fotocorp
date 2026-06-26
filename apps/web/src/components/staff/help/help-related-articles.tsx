import Link from "next/link"
import type { HelpRelatedArticle } from "@/lib/api/staff-help-api"

interface HelpRelatedArticlesProps {
  articles: HelpRelatedArticle[]
}

export function HelpRelatedArticles({ articles }: HelpRelatedArticlesProps) {
  if (!articles.length) return null

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Related articles</h2>
      <ul className="mt-4 space-y-3">
        {articles.map((article) => (
          <li key={article.id}>
            <Link href={`/staff/help/${article.slug}`} className="group block">
              <p className="font-medium text-foreground group-hover:text-primary">{article.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{article.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
