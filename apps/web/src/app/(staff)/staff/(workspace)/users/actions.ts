"use server"

import { revalidatePath } from "next/cache"
import {
  getAdminUser,
  updateAdminUserRole,
  updateAdminUserStatus,
  updateAdminUserSubscription,
  updateAdminUserSubscriptionDetail,
} from "@/lib/api/admin-catalog-api"

export async function toggleSubscriptionAction(formData: FormData) {
  const authUserId = String(formData.get("authUserId") ?? "").trim()
  const nextState = String(formData.get("nextState") ?? "").trim() === "true"

  if (!authUserId) return
  await updateAdminUserSubscription(authUserId, { isSubscriber: nextState })
  revalidatePath("/staff/users")
}

export async function updateUserRoleAction(formData: FormData) {
  const authUserId = String(formData.get("authUserId") ?? "").trim()
  const role = String(formData.get("role") ?? "").trim()

  if (!authUserId || !role) return
  await updateAdminUserRole(authUserId, { role })
  revalidatePath("/staff/users")
}

export async function updateUserStatusAction(formData: FormData) {
  const authUserId = String(formData.get("authUserId") ?? "").trim()
  const nextStatus = String(formData.get("nextStatus") ?? "").trim()

  if (!authUserId || !nextStatus) return
  await updateAdminUserStatus(authUserId, { status: nextStatus })
  revalidatePath("/staff/users")
}

export async function bulkUpdateUserStatusAction(formData: FormData) {
  const ids = formData.getAll("authUserId").map((v) => String(v).trim()).filter(Boolean)
  const nextStatus = String(formData.get("nextStatus") ?? "").trim()
  if (!ids.length || !nextStatus) return

  await Promise.all(ids.map((authUserId) => updateAdminUserStatus(authUserId, { status: nextStatus })))
  revalidatePath("/staff/users")
}

export async function bulkUpdateUserRoleAction(formData: FormData) {
  const ids = formData.getAll("authUserId").map((v) => String(v).trim()).filter(Boolean)
  const role = String(formData.get("role") ?? "").trim()
  if (!ids.length || !role) return

  await Promise.all(ids.map((authUserId) => updateAdminUserRole(authUserId, { role })))
  revalidatePath("/staff/users")
}

export async function bulkToggleSubscriptionAction(formData: FormData) {
  const ids = formData.getAll("authUserId").map((v) => String(v).trim()).filter(Boolean)
  const nextState = String(formData.get("nextState") ?? "").trim()
  if (!ids.length || !nextState) return

  const isSubscriber = nextState === "true"
  await Promise.all(ids.map((authUserId) => updateAdminUserSubscription(authUserId, { isSubscriber })))
  revalidatePath("/staff/users")
}

export async function fetchAdminUserAction(authUserId: string) {
  try {
    return await getAdminUser(authUserId)
  } catch {
    return null
  }
}

export async function updateUserSubscriptionDetailAction(
  authUserId: string,
  payload: { subscriptionPlanId?: string | null; subscriptionEndsAt?: string | null; downloadQuotaLimit?: number | null },
) {
  if (!authUserId) return { success: false, error: "Missing user ID" }
  try {
    await updateAdminUserSubscriptionDetail(authUserId, payload)
    revalidatePath("/staff/users")
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
