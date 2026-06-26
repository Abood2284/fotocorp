import Link from "next/link"
import { HelpContextualLinksManagement } from "@/components/staff/help/manage/help-contextual-links-management"
import { HelpManageHeader } from "@/components/staff/help/manage/help-manage-header"
import { HelpEmptyState } from "@/components/staff/help/help-empty-state"
import {
  listContextualHelpLinksForManage,
  listStaffHelpArticlesForManage,
  StaffApiError,
} from "@/lib/api/staff-help-api"
import { getStaffCookieHeader, requireStaffHelpManager } from "@/lib/staff-session"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Contextual Help Links — Fotocorp Staff",
}

export default async function StaffHelpManageContextualLinksPage() {
  await requireStaffHelpManager()
  const cookieHeader = await getStaffCookieHeader()

  try {
    const [linksResponse, articlesResponse] = await Promise.all([
      listContextualHelpLinksForManage({ cookieHeader, limit: 200 }),
      listStaffHelpArticlesForManage({ cookieHeader, limit: 100 }),
    ])

    return (
      <div className="space-y-6">
        <HelpManageHeader
          title="Contextual Help Links"
          description="Attach help articles to staff pages so people see the right guide while working."
          showDefaultActions={false}
        />
        <Button asChild variant="ghost">
          <Link href="/staff/help/manage">Back to management</Link>
        </Button>
        <HelpContextualLinksManagement links={linksResponse.items} articles={articlesResponse.items} />
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
