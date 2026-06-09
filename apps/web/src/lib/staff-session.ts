import "server-only"

import { cache } from "react"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { FOTOCORP_STAFF_SESSION_COOKIE, getStaffMe, StaffApiError, type StaffMeResponse } from "@/lib/api/staff-api"
import { buildSignInHref } from "@/lib/auth-sign-in-gateway"
import {
  getDefaultStaffLandingPath,
  staffRoleCanAccessPath,
  staffRoleIsWorkspaceOnly,
} from "@/lib/staff/staff-route-access"
import { traceHomepageSessionCall } from "@/lib/server/session-latency-trace"

export async function getStaffCookieHeader() {
  const cookieStore = await cookies()
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ")
}

export const getOptionalStaffSession = cache(async (): Promise<StaffMeResponse | null> => {
  const cookieStore = await cookies()
  if (!cookieStore.get(FOTOCORP_STAFF_SESSION_COOKIE)?.value) return null

  return traceHomepageSessionCall("/api/v1/staff/auth/me", async () => {
    try {
      return await getStaffMe({ cookieHeader: await getStaffCookieHeader() })
    } catch (caught) {
      if (caught instanceof StaffApiError) return null
      throw caught
    }
  })
})

function buildStaffSignInRedirect(callbackPath?: string) {
  return buildSignInHref({
    callbackUrl: callbackPath ?? null,
  })
}

export async function requireStaff() {
  const session = await getOptionalStaffSession()
  if (!session) {
    const pathname = (await headers()).get("x-pathname") ?? ""
    redirect(buildStaffSignInRedirect(pathname.startsWith("/staff") ? pathname : undefined))
  }
  return session.staff
}

/** Server-side RBAC for staff workspace routes (navigation alone is not security). */
export async function assertStaffRouteAccess(role: string) {
  const pathname = (await headers()).get("x-pathname") ?? ""
  if (!pathname.startsWith("/staff")) return
  if (staffRoleCanAccessPath(role, pathname)) return
  redirect(getDefaultStaffLandingPath(role))
}

/** Headers for privileged internal admin API calls (actor audit). */
export async function getStaffInternalAdminActorHeaders(): Promise<HeadersInit> {
  const session = await getOptionalStaffSession()
  if (!session) return {}
  return {
    "x-admin-auth-user-id": session.staff.id,
    "x-admin-email": `staff:${session.staff.username}`,
  }
}

export async function requireStaffRole(allowedRoles: string[]) {
  const staff = await requireStaff()
  if (staff.role === "SUPER_ADMIN") return staff
  if (allowedRoles.includes(staff.role)) return staff
  redirect(getDefaultStaffLandingPath(staff.role))
}

/** Caption writers and other workspace-only roles cannot browse public client routes. */
export async function redirectWorkspaceOnlyStaffAwayFromPublicSite() {
  const session = await getOptionalStaffSession()
  if (!session) return
  if (!staffRoleIsWorkspaceOnly(session.staff.role)) return
  redirect(getDefaultStaffLandingPath(session.staff.role))
}
