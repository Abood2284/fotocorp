import Link from "next/link"
import { HelpArticleManagementList } from "@/components/staff/help/manage/help-article-management-list"
import { HelpManageHeader } from "@/components/staff/help/manage/help-manage-header"
import { HelpManagementFilters } from "@/components/staff/help/manage/help-management-filters"
import { HelpEmptyState } from "@/components/staff/help/help-empty-state"
import {
  getStaffHelpCategoriesForManage,
  getStaffHelpTags,
  listStaffHelpArticlesForManage,
  StaffApiError,
} from "@/lib/api/staff-help-api"
import { getStaffCookieHeader, requireStaffHelpManager } from "@/lib/staff-session"

export const metadata = {
  title: "Manage Help — Fotocorp Staff",
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StaffHelpManagePage({ searchParams }: PageProps) {
  await requireStaffHelpManager()
  const params = await searchParams
  const query = readString(params.q)
  const status = readString(params.status)
  const category = readString(params.category)
  const tag = readString(params.tag)
  const cookieHeader = await getStaffCookieHeader()

  let categories: Awaited<ReturnType<typeof getStaffHelpCategoriesForManage>>["items"] = []
  let tags: Awaited<ReturnType<typeof getStaffHelpTags>>["items"] = []
  let articles: Awaited<ReturnType<typeof listStaffHelpArticlesForManage>>["items"] = []
  let loadError = false

  try {
    const [categoryResponse, tagResponse, articleResponse] = await Promise.all([
      getStaffHelpCategoriesForManage({ cookieHeader }),
      getStaffHelpTags({ cookieHeader }),
      listStaffHelpArticlesForManage({
        cookieHeader,
        q: query,
        status,
        category,
        tag,
      }),
    ])
    categories = categoryResponse.items
    tags = tagResponse.items
    articles = articleResponse.items
  } catch (caught) {
    if (!(caught instanceof StaffApiError)) throw caught
    loadError = true
  }

  return (
    <div className="space-y-6">
      <HelpManageHeader />

      {loadError ? (
        <HelpEmptyState variant="error" />
      ) : (
        <>
          <HelpManagementFilters
            query={query ?? ""}
            status={status ?? ""}
            category={category ?? ""}
            tag={tag ?? ""}
            categories={categories}
            tags={tags}
          />
          <HelpArticleManagementList items={articles} />
        </>
      )}
    </div>
  )
}

function readString(value: string | string[] | undefined) {
  if (typeof value === "string" && value.trim()) return value.trim()
  return undefined
}
