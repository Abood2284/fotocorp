import Link from "next/link"
import { getDefaultStaffLandingPath } from "@/lib/staff/staff-route-access"
import { requireStaff } from "@/lib/staff-session"

export const metadata = {
  title: "Access denied — Fotocorp",
}

export default async function StaffForbiddenPage() {
  const staff = await requireStaff()
  const home = getDefaultStaffLandingPath(staff.role)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-lg border border-border bg-card px-6 py-8">
        <h1 className="text-lg font-semibold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your staff role does not have access to this section.
        </p>
        <Link
          href={home}
          className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Continue to your workspace
        </Link>
      </div>
    </main>
  )
}
