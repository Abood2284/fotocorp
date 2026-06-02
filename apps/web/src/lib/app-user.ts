import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { upsertAppUserProfile } from "@/lib/app-user-profile-store"
import { traceHomepageSessionCall } from "@/lib/server/session-latency-trace"
import type { AppRole } from "@/lib/app-user-profile-store"

export {
  APP_ROLES,
  APP_USER_STATUSES,
  SUBSCRIPTION_STATUSES,
  listAppUsers,
  updateAppUserRolePlaceholder,
} from "@/lib/app-user-profile-store"
export type { AppRole, AppUserProfile, AppUserStatus, SubscriptionStatus } from "@/lib/app-user-profile-store"

export interface AuthUser {
  id: string
  email: string
  name?: string | null
  image?: string | null
}

export async function getCurrentAuthUser() {
  return traceHomepageSessionCall("/api/auth/get-session", async () => {
    const apiBaseUrl = process.env.INTERNAL_API_BASE_URL?.trim()
    const cookieHeader = (await headers()).get("cookie")
    if (!apiBaseUrl || !cookieHeader?.includes("fotocorp_session=")) return null

    let response: Response
    try {
      response = await fetch(new URL("/api/v1/auth/me", apiBaseUrl), {
        method: "GET",
        headers: {
          cookie: cookieHeader,
          accept: "application/json",
        },
        cache: "no-store",
      })
    } catch {
      return null
    }

    if (response.status === 401) return null
    if (!response.ok) return null

    const payload = (await response.json().catch(() => null)) as {
      user?: { id: string; email: string; name?: string | null }
    } | null

    if (!payload?.user?.id) return null

    return {
      id: payload.user.id,
      email: payload.user.email,
      name: payload.user.name ?? null,
      image: null,
    } satisfies AuthUser
  })
}

export async function getOrCreateAppUser(authUser: AuthUser) {
  const profile = await upsertAppUserProfile(authUser)
  if (!profile) {
    throw new Error(`Platform user profile not found for user ${authUser.id}`)
  }
  return profile
}

export async function getCurrentAppUser() {
  const authUser = await getCurrentAuthUser()
  if (!authUser) return null

  return getOrCreateAppUser(authUser)
}

export async function requireAuth() {
  const authUser = await getCurrentAuthUser()

  if (!authUser) {
    redirect("/sign-in")
  }

  const appUser = await getOrCreateAppUser(authUser)
  if (!appUser) redirect("/sign-in")

  if (appUser.status === "SUSPENDED") {
    redirect("/suspended")
  }

  return appUser
}

export async function requireRole(allowedRoles: AppRole[]) {
  const appUser = await requireAuth()

  if (appUser.role === "SUPER_ADMIN" || allowedRoles.includes(appUser.role)) {
    return appUser
  }

  redirect("/unauthorized")
}

export function requireAdmin() {
  return requireRole(["ADMIN", "SUPER_ADMIN"])
}

export function requirePhotographer() {
  return requireRole(["PHOTOGRAPHER", "ADMIN", "SUPER_ADMIN"])
}

export function requireSuperAdmin() {
  return requireRole(["SUPER_ADMIN"])
}
