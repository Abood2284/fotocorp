import { Suspense } from "react"
import Link from "next/link"
import { HelpCategoryFilter } from "@/components/staff/help/help-category-filter"
import { HelpArticleList } from "@/components/staff/help/help-article-list"
import { HelpEmptyState } from "@/components/staff/help/help-empty-state"
import { HelpSearchControls } from "@/components/staff/help/help-search-controls"
import { HelpTagFilter } from "@/components/staff/help/help-tag-filter"
import { Button } from "@/components/ui/button"
import {
  getStaffHelpCategories,
  getStaffHelpTags,
  listStaffHelpArticles,
  StaffApiError,
} from "@/lib/api/staff-help-api"
import { staffCanManageHelpContent } from "@/lib/staff/help-form"
import { getStaffCookieHeader, requireStaff } from "@/lib/staff-session"

export const metadata = {
  title: "Help Center — Fotocorp Staff",
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StaffHelpPage({ searchParams }: PageProps) {
  const staff = await requireStaff()
  const params = await searchParams
  const query = readString(params.q)
  const category = readString(params.category)
  const tag = readString(params.tag)
  const cookieHeader = await getStaffCookieHeader()

  let categories: Awaited<ReturnType<typeof getStaffHelpCategories>>["items"] = []
  let tags: Awaited<ReturnType<typeof getStaffHelpTags>>["items"] = []
  let articles: Awaited<ReturnType<typeof listStaffHelpArticles>>["items"] = []
  let loadError = false

  try {
    const [categoryResponse, tagResponse, articleResponse] = await Promise.all([
      getStaffHelpCategories({ cookieHeader }),
      getStaffHelpTags({ cookieHeader }),
      listStaffHelpArticles({
        cookieHeader,
        q: query,
        category,
        tag,
        limit: 30,
      }),
    ])
    categories = categoryResponse.items
    tags = tagResponse.items
    articles = articleResponse.items
  } catch (caught) {
    if (!(caught instanceof StaffApiError)) throw caught
    loadError = true
  }

  const hasFilters = Boolean(query || category || tag)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground">Help Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Find quick guides for uploads, captions, approvals, customer access, downloads, and other staff workflows.
          </p>
        </div>
        {staffCanManageHelpContent(staff.role) ? (
          <Button asChild variant="outline">
            <Link href="/staff/help/manage">Manage Help Center</Link>
          </Button>
        ) : null}
      </div>

      <Suspense fallback={null}>
        <HelpSearchControls initialQuery={query ?? ""} category={category} tag={tag} />
      </Suspense>

      {loadError ? (
        <HelpEmptyState variant="error" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <HelpCategoryFilter
              categories={categories}
              activeCategory={category}
              query={query}
              activeTag={tag}
              layout="sidebar"
            />
            <HelpTagFilter tags={tags} activeTag={tag} query={query} category={category} />
          </aside>

          <div className="space-y-6">
            <HelpCategoryFilter
              categories={categories}
              activeCategory={category}
              query={query}
              activeTag={tag}
              layout="chips"
            />

            {!categories.length ? (
              <HelpEmptyState variant="no-categories" />
            ) : !articles.length ? (
              <HelpEmptyState variant={hasFilters ? "no-results" : "no-published"} />
            ) : (
              <HelpArticleList items={articles} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function readString(value: string | string[] | undefined) {
  if (typeof value === "string" && value.trim()) return value.trim()
  return undefined
}
