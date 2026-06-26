import Link from "next/link"
import { notFound } from "next/navigation"
import { HelpArticleForm } from "@/components/staff/help/manage/help-article-form"
import { helpArticleToFormValues } from "@/lib/staff/help-form"
import { HelpManageHeader } from "@/components/staff/help/manage/help-manage-header"
import { HelpEmptyState } from "@/components/staff/help/help-empty-state"
import {
  getStaffHelpArticleForEdit,
  getStaffHelpCategoriesForManage,
  getStaffHelpTags,
  listStaffHelpArticlesForManage,
  StaffApiError,
} from "@/lib/api/staff-help-api"
import { getStaffCookieHeader, requireStaffHelpManager } from "@/lib/staff-session"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Edit Help Article — Fotocorp Staff",
}

interface PageProps {
  params: Promise<{ articleId: string }>
}

export default async function StaffHelpManageEditPage({ params }: PageProps) {
  await requireStaffHelpManager()
  const { articleId } = await params
  const cookieHeader = await getStaffCookieHeader()

  try {
    const [articleResponse, categoriesResponse, tagsResponse, publishedArticlesResponse] = await Promise.all([
      getStaffHelpArticleForEdit(articleId, { cookieHeader }),
      getStaffHelpCategoriesForManage({ cookieHeader }),
      getStaffHelpTags({ cookieHeader }),
      listStaffHelpArticlesForManage({ cookieHeader, status: "PUBLISHED", limit: 100 }),
    ])

    const article = articleResponse.article
    const relatedArticleOptions = publishedArticlesResponse.items.map((item) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
    }))

    return (
      <div className="space-y-6">
        <HelpManageHeader
          title={`Edit: ${article.title}`}
          description="Update article content, audience, and publishing status."
          showDefaultActions={false}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost">
            <Link href="/staff/help/manage">Back to management</Link>
          </Button>
          {article.status !== "ARCHIVED" ? (
            <Button asChild variant="outline">
              <Link href={`/staff/help/${article.slug}`} target="_blank" rel="noopener noreferrer">
                Preview
              </Link>
            </Button>
          ) : null}
        </div>
        <HelpArticleForm
          mode="edit"
          articleId={article.id}
          initialValues={helpArticleToFormValues(article)}
          categories={categoriesResponse.items}
          tags={tagsResponse.items}
          relatedArticleOptions={relatedArticleOptions}
          media={article.media}
        />
      </div>
    )
  } catch (caught) {
    if (caught instanceof StaffApiError && caught.status === 404) notFound()
    if (!(caught instanceof StaffApiError)) throw caught
    return (
      <div className="space-y-6">
        <HelpManageHeader showDefaultActions={false} />
        <HelpEmptyState variant="error" />
      </div>
    )
  }
}
