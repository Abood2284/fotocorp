import { Header, type HeaderUserProfile, type StaffBrief } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getCurrentAppUser } from "@/lib/app-user"
import { getOptionalStaffSession } from "@/lib/staff-session"

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  let appUser: Awaited<ReturnType<typeof getCurrentAppUser>> | null = null
  try {
    appUser = await getCurrentAppUser()
  } catch {
    appUser = null
  }

  let staffBrief: StaffBrief | null = null
  try {
    const staffSession = await getOptionalStaffSession()
    if (staffSession) {
      staffBrief = {
        displayName: staffSession.staff.displayName,
        username: staffSession.staff.username,
        role: staffSession.staff.role,
      }
    }
  } catch {
    staffBrief = null
  }

  const headerUser: HeaderUserProfile | null = appUser
    ? {
        email: appUser.email,
        displayName: appUser.displayName,
        role: appUser.role,
        isSubscriber: appUser.isSubscriber,
        subscriptionStatus: appUser.subscriptionStatus,
      }
    : null

  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[680px] bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.26),rgba(124,58,237,0.1)_32%,transparent_72%)]"
      />
      <Header userProfile={headerUser} staffBrief={staffBrief} />
      <main className="relative z-10 flex-1">{children}</main>
      <Footer />
    </div>
  )
}
