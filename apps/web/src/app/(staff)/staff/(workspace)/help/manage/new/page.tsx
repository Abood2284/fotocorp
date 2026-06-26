import Link from "next/link"
import { HelpArticleForm } from "@/components/staff/help/manage/help-article-form"
import { HelpManageHeader } from "@/components/staff/help/manage/help-manage-header"
import { HelpEmptyState } from "@/components/staff/help/help-empty-state"
import {
  getStaffHelpCategoriesForManage,
  getStaffHelpTags,
  StaffApiError,
} from "@/lib/api/staff-help-api"
import { createEmptyHelpArticleFormValues } from "@/lib/staff/help-form"
import { getStaffCookieHeader, requireStaffHelpManager } from "@/lib/staff-session"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "New Help Article — Fotocorp Staff",
}

export default async function StaffHelpManageNewPage() {
  await requireStaffHelpManager()
  const cookieHeader = await getStaffCookieHeader()

  try {
    const [categoriesResponse, tagsResponse] = await Promise.all([
      getStaffHelpCategoriesForManage({ cookieHeader }),
      getStaffHelpTags({ cookieHeader }),
    ])

    return (
      <div className="space-y-6">
        <HelpManageHeader
          title="New help article"
          description="Create a draft guide for staff. Publish when the content is ready."
          showDefaultActions={false}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost">
            <Link href="/staff/help/manage">Back to management</Link>
          </Button>
        </div>
        <HelpArticleForm
          mode="create"
          initialValues={createEmptyHelpArticleFormValues()}
          categories={categoriesResponse.items}
          tags={tagsResponse.items}
        />
      </div>
    )
  } catch (caught) {
    if (!(caught instanceof StaffApiError)) throw caught
    return (
      <div className="space-y-6">
        <HelpManageHeader showDefaultActions={false} />
        <HelpEmptyState variant="error" />
      </div>
    )
  }
}
