import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { upsertAppUserProfile } from "@/lib/app-user-profile-store"
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
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  return (session?.user ?? null) as AuthUser | null
}

export async function getOrCreateAppUser(authUser: AuthUser) {
  return upsertAppUserProfile(authUser)
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
