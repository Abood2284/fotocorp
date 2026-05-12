import "server-only"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { getStaffMe, StaffApiError, type StaffMeResponse } from "@/lib/api/staff-api"
import {
  getDefaultStaffLandingPath,
  staffRoleCanAccessPath,
} from "@/lib/staff/staff-route-access"

export async function getStaffCookieHeader() {
  const cookieStore = await cookies()
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ")
}

export async function getOptionalStaffSession(): Promise<StaffMeResponse | null> {
  try {
    return await getStaffMe({ cookieHeader: await getStaffCookieHeader() })
  } catch (caught) {
    if (caught instanceof StaffApiError) return null
    throw caught
  }
}

export async function requireStaff() {
  const session = await getOptionalStaffSession()
  if (!session) redirect("/staff/login")
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
