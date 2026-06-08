"use server"

import { revalidatePath } from "next/cache"
import {
  createStaffMemberAccount,
  patchStaffMemberAccount,
  StaffApiError,
} from "@/lib/api/staff-api"
import { getStaffCookieHeader, requireStaffRole } from "@/lib/staff-session"

export type StaffMemberActionResult =
  | { ok: true }
  | { ok: false; message: string }

export async function createCaptionWriterAction(formData: FormData): Promise<StaffMemberActionResult> {
  await requireStaffRole(["SUPER_ADMIN"])

  const username = String(formData.get("username") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const displayName = String(formData.get("displayName") ?? "").trim()

  if (!username || !password) {
    return { ok: false, message: "Username and password are required." }
  }

  try {
    await createStaffMemberAccount(
      {
        username,
        password,
        displayName: displayName || undefined,
        role: "CAPTION_WRITER",
      },
      { cookieHeader: await getStaffCookieHeader() },
    )
    revalidatePath("/staff/staff-users")
    return { ok: true }
  } catch (error) {
    return { ok: false, message: formatStaffMemberError(error) }
  }
}

export async function updateCaptionWriterStatusAction(formData: FormData): Promise<StaffMemberActionResult> {
  await requireStaffRole(["SUPER_ADMIN"])

  const memberId = String(formData.get("memberId") ?? "").trim()
  const nextStatus = String(formData.get("nextStatus") ?? "").trim()

  if (!memberId || (nextStatus !== "ACTIVE" && nextStatus !== "DISABLED")) {
    return { ok: false, message: "Invalid status update request." }
  }

  try {
    await patchStaffMemberAccount(memberId, { status: nextStatus }, { cookieHeader: await getStaffCookieHeader() })
    revalidatePath("/staff/staff-users")
    return { ok: true }
  } catch (error) {
    return { ok: false, message: formatStaffMemberError(error) }
  }
}

export async function resetCaptionWriterPasswordAction(formData: FormData): Promise<StaffMemberActionResult> {
  await requireStaffRole(["SUPER_ADMIN"])

  const memberId = String(formData.get("memberId") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!memberId || !password) {
    return { ok: false, message: "Member and password are required." }
  }

  try {
    await patchStaffMemberAccount(memberId, { password }, { cookieHeader: await getStaffCookieHeader() })
    revalidatePath("/staff/staff-users")
    return { ok: true }
  } catch (error) {
    return { ok: false, message: formatStaffMemberError(error) }
  }
}

function formatStaffMemberError(error: unknown): string {
  if (error instanceof StaffApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return "Staff account request failed."
}
