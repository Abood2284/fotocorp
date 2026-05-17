import { headers } from "next/headers"
import { Header, type HeaderUserProfile, type StaffBrief } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getCurrentAppUser } from "@/lib/app-user"
import { createTimingTracker, logLatencyTrace, resolveRequestIdFromHeaders } from "@/lib/latency-trace"
import { getOptionalStaffSession } from "@/lib/staff-session"

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const shellStartedAt = Date.now()
  const requestId = resolveRequestIdFromHeaders(await headers()) ?? crypto.randomUUID()
  const shellTracker = createTimingTracker(shellStartedAt)

  let appUser: Awaited<ReturnType<typeof getCurrentAppUser>> | null = null
  try {
    appUser = await getCurrentAppUser()
  } catch (error) {
    appUser = null
    const serialized = error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: String(error) }
    logLatencyTrace({
      event: "latency_trace",
      requestId,
      layer: "web",
      route: "GET /",
      status: "error",
      statusCode: 500,
      durationMs: Date.now() - shellStartedAt,
      timings: { auth_session: shellTracker.total(), total: Date.now() - shellStartedAt },
      error: serialized,
    })
  }
  shellTracker.mark("auth_session")

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
  } catch (error) {
    staffBrief = null
    const serialized = error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: String(error) }
    logLatencyTrace({
      event: "latency_trace",
      requestId,
      layer: "web",
      route: "GET /",
      status: "error",
      statusCode: 500,
      durationMs: Date.now() - shellStartedAt,
      timings: { staff_auth: shellTracker.elapsed("auth_session"), total: Date.now() - shellStartedAt },
      error: serialized,
    })
  }
  shellTracker.mark("staff_auth")

  const shellDurationMs = Date.now() - shellStartedAt
  logLatencyTrace({
    event: "latency_trace",
    requestId,
    layer: "web",
    route: "GET /",
    status: "ok",
    statusCode: 200,
    durationMs: shellDurationMs,
    timings: {
      auth_session: shellTracker.elapsed("auth_session"),
      staff_auth: shellTracker.elapsed("staff_auth"),
      total: shellDurationMs,
    },
    cache: { mode: "rsc-shell", hit: false, cacheControl: null },
  })

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
