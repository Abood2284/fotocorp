import Link from "next/link"
import { HelpTagManagement } from "@/components/staff/help/manage/help-tag-management"
import { HelpManageHeader } from "@/components/staff/help/manage/help-manage-header"
import { HelpEmptyState } from "@/components/staff/help/help-empty-state"
import { getStaffHelpTags, StaffApiError } from "@/lib/api/staff-help-api"
import { getStaffCookieHeader, requireStaffHelpManager } from "@/lib/staff-session"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Help Tags — Fotocorp Staff",
}

export default async function StaffHelpManageTagsPage() {
  await requireStaffHelpManager()
  const cookieHeader = await getStaffCookieHeader()

  try {
    const tagsResponse = await getStaffHelpTags({ cookieHeader })

    return (
      <div className="space-y-6">
        <HelpManageHeader
          title="Help tags"
          description="Create tags to improve article discovery in the Help Center."
          showDefaultActions={false}
        />
        <Button asChild variant="ghost">
          <Link href="/staff/help/manage">Back to management</Link>
        </Button>
        <HelpTagManagement tags={tagsResponse.items} />
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
