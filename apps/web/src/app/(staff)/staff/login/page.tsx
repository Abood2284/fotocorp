import { Suspense } from "react"
import { redirect } from "next/navigation"
import { StaffLoginForm } from "@/components/staff/staff-login-form"
import { getDefaultStaffLandingPath } from "@/lib/staff/staff-route-access"
import { getOptionalStaffSession } from "@/lib/staff-session"

export const metadata = {
  title: "Staff Login",
}

export default async function StaffLoginPage() {
  const session = await getOptionalStaffSession()
  if (session) redirect(getDefaultStaffLandingPath(session.staff.role))

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-lg border border-zinc-200 bg-white px-6 py-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Fotocorp internal</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">Staff sign in</h1>
        <p className="mt-2 text-sm text-zinc-600">Use your assigned staff credentials. This workspace is not linked to customer accounts.</p>
        <div className="mt-8">
          <Suspense fallback={<div className="h-32 rounded-md bg-zinc-100" aria-hidden />}>
            <StaffLoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
