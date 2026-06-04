import { headers } from "next/headers"
import { Header, type HeaderUserProfile, type StaffBrief } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { createTimingTracker, logLatencyTrace, resolveRequestIdFromHeaders } from "@/lib/latency-trace"

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const shellStartedAt = Date.now()
  const requestId = resolveRequestIdFromHeaders(await headers()) ?? crypto.randomUUID()
  const shellTracker = createTimingTracker(shellStartedAt)

  /** Marketing shell: signed-in state comes from client `GET /api/auth/get-session` (unified session). */
  const headerUser: HeaderUserProfile | null = null
  const staffBrief: StaffBrief | null = null
  shellTracker.mark("public_shell")

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
      public_shell: shellTracker.elapsed("public_shell"),
      total: shellDurationMs,
    },
    cache: { mode: "rsc-shell", hit: false, cacheControl: null },
  })

  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_70%_55%_at_75%_50%,rgba(192,124,10,0.045)_0%,transparent_65%),radial-gradient(ellipse_50%_40%_at_10%_85%,rgba(26,37,64,0.05)_0%,transparent_60%)]"
      />
      <Header userProfile={headerUser} staffBrief={staffBrief} />
      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  )
}
