import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { HelpArticleFeedback } from "@/components/staff/help/help-article-feedback"
import { HelpArticleMarkdown } from "@/components/staff/help/help-article-markdown"
import { HelpArticleMediaSection } from "@/components/staff/help/help-article-media-section"
import { HelpContentLoadError } from "@/components/staff/help/help-empty-state"
import { HelpRelatedArticles } from "@/components/staff/help/help-related-articles"
import { getStaffHelpArticleBySlug, StaffApiError } from "@/lib/api/staff-help-api"
import { formatHelpMetaLine } from "@/lib/staff/help-format"
import { getStaffCookieHeader, requireStaff } from "@/lib/staff-session"

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  return {
    title: `${decodeURIComponent(slug).replaceAll("-", " ")} — Help Center`,
  }
}

export default async function StaffHelpArticlePage({ params, searchParams }: PageProps) {
  await requireStaff()
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const searchQuery = readString(resolvedSearchParams.fromSearch)
  const cookieHeader = await getStaffCookieHeader()

  try {
    const response = await getStaffHelpArticleBySlug(slug, {
      cookieHeader,
      searchQuery,
    })
    const article = response.article
    const metaLine = formatHelpMetaLine({
      difficulty: article.difficulty,
      estimatedMinutes: article.estimatedMinutes,
      updatedAt: article.updatedAt,
      publishedAt: article.publishedAt,
    })

    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <nav aria-label="Breadcrumb">
          <Link
            href="/staff/help"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Help Center
          </Link>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {article.category.name}
          </p>
        </nav>

        <header className="space-y-4 border-b border-border pb-6">
          <h1 className="font-serif text-3xl font-semibold text-foreground">{article.title}</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{article.summary}</p>

          {article.tags.length ? (
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex rounded-none border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}

          {metaLine ? <p className="text-sm text-muted-foreground">{metaLine}</p> : null}
        </header>

        <HelpArticleMarkdown content={article.bodyMarkdown} />

        <HelpArticleMediaSection media={article.media} />

        <HelpRelatedArticles articles={article.relatedArticles} />

        <HelpArticleFeedback articleId={article.id} />
      </div>
    )
  } catch (caught) {
    if (caught instanceof StaffApiError && caught.status === 404) {
      notFound()
    }
    if (caught instanceof StaffApiError) {
      return <HelpContentLoadError />
    }
    throw caught
  }
}

function readString(value: string | string[] | undefined) {
  if (typeof value === "string" && value.trim()) return value.trim()
  return undefined
}
