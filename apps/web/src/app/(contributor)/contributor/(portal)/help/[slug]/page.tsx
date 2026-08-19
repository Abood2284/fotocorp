import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { HelpArticleBody } from "@/components/staff/help/help-article-body"
import { ContributorApiError, getContributorHelpArticleBySlug } from "@/lib/api/contributor-api"
import { getContributorHelpMediaDisplayUrl, isContributorHelpArticleSlug } from "@/lib/contributor-help"
import { getContributorCookieHeader, requireContributorPasswordReady } from "@/lib/contributor-session"
import { formatHelpMetaLine } from "@/lib/staff/help-format"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  return {
    title: `${decodeURIComponent(slug).replaceAll("-", " ")} — Contributor help`,
  }
}

export default async function ContributorHelpArticlePage({ params }: PageProps) {
  await requireContributorPasswordReady()
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug)
  if (!isContributorHelpArticleSlug(decodedSlug)) notFound()

  const cookieHeader = await getContributorCookieHeader()

  try {
    const response = await getContributorHelpArticleBySlug(decodedSlug, { cookieHeader })
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
            href="/contributor/uploads"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back to uploads
          </Link>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {article.category.name}
          </p>
        </nav>

        <header className="space-y-4 border-b border-border pb-6">
          <h1 className="font-serif text-3xl font-semibold text-foreground">{article.title}</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{article.summary}</p>
          {metaLine ? <p className="text-sm text-muted-foreground">{metaLine}</p> : null}
        </header>

        <HelpArticleBody content={article.bodyMarkdown} mediaDisplayUrl={getContributorHelpMediaDisplayUrl} />
      </div>
    )
  } catch (caught) {
    if (caught instanceof ContributorApiError && caught.status === 404) {
      notFound()
    }
    if (caught instanceof ContributorApiError) {
      return (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">This help article could not be loaded right now.</p>
          <Link href="/contributor/uploads" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            Back to uploads
          </Link>
        </div>
      )
    }
    throw caught
  }
}
