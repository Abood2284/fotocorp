import { redirectWorkspaceOnlyStaffAwayFromPublicSite } from "@/lib/staff-session"

/**
 * Contributor portal lives outside `(marketing)` so it never inherits the
 * public site Header/Footer or marketing chrome.
 */
export default async function ContributorRouteGroupLayout({ children }: { children: React.ReactNode }) {
  await redirectWorkspaceOnlyStaffAwayFromPublicSite()
  return <>{children}</>
}
