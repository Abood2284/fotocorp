import type { HelpArticleListItem } from "@/lib/api/staff-help-api"
import { HelpArticleCard } from "@/components/staff/help/help-article-card"

interface HelpArticleListProps {
  items: HelpArticleListItem[]
}

export function HelpArticleList({ items }: HelpArticleListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
      {items.map((article) => (
        <HelpArticleCard key={article.id} article={article} />
      ))}
    </div>
  )
}
