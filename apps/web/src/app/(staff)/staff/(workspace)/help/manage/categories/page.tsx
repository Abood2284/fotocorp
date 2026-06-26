import Link from "next/link"
import { HelpCategoryManagement } from "@/components/staff/help/manage/help-category-management"
import { HelpManageHeader } from "@/components/staff/help/manage/help-manage-header"
import { HelpEmptyState } from "@/components/staff/help/help-empty-state"
import { getStaffHelpCategoriesForManage, StaffApiError } from "@/lib/api/staff-help-api"
import { getStaffCookieHeader, requireStaffHelpManager } from "@/lib/staff-session"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Help Categories — Fotocorp Staff",
}

export default async function StaffHelpManageCategoriesPage() {
  await requireStaffHelpManager()
  const cookieHeader = await getStaffCookieHeader()

  try {
    const categoriesResponse = await getStaffHelpCategoriesForManage({ cookieHeader })

    return (
      <div className="space-y-6">
        <HelpManageHeader
          title="Help categories"
          description="Organize articles into categories staff can browse in the Help Center."
          showDefaultActions={false}
        />
        <Button asChild variant="ghost">
          <Link href="/staff/help/manage">Back to management</Link>
        </Button>
        <HelpCategoryManagement categories={categoriesResponse.items} />
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
