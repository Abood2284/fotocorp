import { redirect } from "next/navigation"

import { buildSignInHref } from "@/lib/auth-sign-in-gateway"
import { getDefaultStaffLandingPath } from "@/lib/staff/staff-route-access"
import { getOptionalStaffSession } from "@/lib/staff-session"

interface StaffLoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function StaffLoginPage({ searchParams }: StaffLoginPageProps) {
  const session = await getOptionalStaffSession()
  if (session) redirect(getDefaultStaffLandingPath(session.staff.role))

  const params = await searchParams
  redirect(
    buildSignInHref({
      callbackUrl: params.callbackUrl ?? null,
    }),
  )
}
