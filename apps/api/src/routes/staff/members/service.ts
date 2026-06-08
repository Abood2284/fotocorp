import type { DrizzleClient } from "../../../db"
import { validateStaffPasswordLength } from "../../../lib/auth/staff-password"
import { AppError } from "../../../lib/errors"
import { insertStaffAuditLog } from "../../../lib/staff/staff-audit-log"
import {
  ADMIN_MANAGED_STAFF_ROLE,
  createStaffMember,
  getStaffMemberById,
  listStaffMembers,
  resetStaffMemberPassword,
  updateStaffMemberProfile,
} from "../../../lib/staff/staff-member"

export const STAFF_MEMBER_AUDIT_ACTION = {
  CREATED: "STAFF_MEMBER_CREATED",
  STATUS_UPDATED: "STAFF_MEMBER_STATUS_UPDATED",
  PASSWORD_RESET: "STAFF_MEMBER_PASSWORD_RESET",
  PROFILE_UPDATED: "STAFF_MEMBER_PROFILE_UPDATED",
} as const

function serializeStaffMember(item: {
  id: string
  username: string
  displayName: string
  role: string
  status: string
  createdAt: Date
  lastLoginAt: Date | null
}) {
  return {
    id: item.id,
    username: item.username,
    displayName: item.displayName,
    role: item.role,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    lastLoginAt: item.lastLoginAt?.toISOString() ?? null,
  }
}

export async function listManagedStaffMembers(db: DrizzleClient, role?: string) {
  const normalizedRole = role?.trim() || ADMIN_MANAGED_STAFF_ROLE
  const items = await listStaffMembers(db, { role: normalizedRole })
  return items.map(serializeStaffMember)
}

export async function createManagedStaffMember(
  db: DrizzleClient,
  input: {
    username: string
    password: string
    displayName?: string
    role: typeof ADMIN_MANAGED_STAFF_ROLE
    createdByStaffMemberId: string
  },
  meta: { ip: string | null; userAgent: string | null },
) {
  if (input.role !== ADMIN_MANAGED_STAFF_ROLE) {
    throw new AppError(400, "STAFF_ROLE_NOT_ALLOWED", "Only caption writer accounts can be created here.")
  }

  const passwordError = validateStaffPasswordLength(input.password)
  if (passwordError) {
    throw new AppError(400, "WEAK_PASSWORD", passwordError)
  }

  const created = await createStaffMember(db, {
    username: input.username,
    password: input.password,
    displayName: input.displayName?.trim() || input.username.trim(),
    role: input.role,
    createdByStaffMemberId: input.createdByStaffMemberId,
  })

  if (!created) {
    throw new AppError(409, "STAFF_USERNAME_TAKEN", "That username is already in use.")
  }

  await insertStaffAuditLog(db, {
    staffMemberId: input.createdByStaffMemberId,
    action: STAFF_MEMBER_AUDIT_ACTION.CREATED,
    entityType: "staff_member",
    entityId: created.id,
    metadata: {
      username: created.username,
      role: created.role,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  const row = await listStaffMembers(db, { role: created.role })
  const match = row.find((entry) => entry.id === created.id)
  if (!match) {
    return {
      id: created.id,
      username: created.username,
      displayName: created.displayName,
      role: created.role,
      status: created.status,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    }
  }

  return serializeStaffMember(match)
}

export async function patchManagedStaffMember(
  db: DrizzleClient,
  input: {
    memberId: string
    actingStaffMemberId: string
    status?: "ACTIVE" | "DISABLED"
    displayName?: string
    password?: string
  },
  meta: { ip: string | null; userAgent: string | null },
) {
  if (input.actingStaffMemberId === input.memberId && input.status === "DISABLED") {
    throw new AppError(403, "STAFF_SELF_DISABLE_FORBIDDEN", "You cannot disable your own staff account.")
  }

  const existing = await getStaffMemberById(db, input.memberId)
  if (!existing) {
    throw new AppError(404, "STAFF_MEMBER_NOT_FOUND", "Staff member was not found.")
  }

  if (existing.role !== ADMIN_MANAGED_STAFF_ROLE) {
    throw new AppError(403, "STAFF_MEMBER_NOT_MANAGED", "Only caption writer accounts can be managed here.")
  }

  if (input.displayName !== undefined || input.status !== undefined) {
    const updatedId = await updateStaffMemberProfile(db, input.memberId, {
      displayName: input.displayName,
      status: input.status,
    })
    if (!updatedId) {
      throw new AppError(404, "STAFF_MEMBER_NOT_FOUND", "Staff member was not found.")
    }
  }

  if (input.password !== undefined) {
    const passwordError = validateStaffPasswordLength(input.password)
    if (passwordError) {
      throw new AppError(400, "WEAK_PASSWORD", passwordError)
    }

    const updatedCredential = await resetStaffMemberPassword(db, input.memberId, input.password)
    if (!updatedCredential) {
      throw new AppError(404, "STAFF_MEMBER_NOT_FOUND", "Staff member was not found.")
    }

    await insertStaffAuditLog(db, {
      staffMemberId: input.actingStaffMemberId,
      action: STAFF_MEMBER_AUDIT_ACTION.PASSWORD_RESET,
      entityType: "staff_member",
      entityId: input.memberId,
      metadata: { username: existing.username },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }

  if (input.status !== undefined) {
    await insertStaffAuditLog(db, {
      staffMemberId: input.actingStaffMemberId,
      action: STAFF_MEMBER_AUDIT_ACTION.STATUS_UPDATED,
      entityType: "staff_member",
      entityId: input.memberId,
      metadata: {
        username: existing.username,
        previousStatus: existing.status,
        nextStatus: input.status,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }

  if (input.displayName !== undefined) {
    await insertStaffAuditLog(db, {
      staffMemberId: input.actingStaffMemberId,
      action: STAFF_MEMBER_AUDIT_ACTION.PROFILE_UPDATED,
      entityType: "staff_member",
      entityId: input.memberId,
      metadata: {
        username: existing.username,
        displayName: input.displayName.trim(),
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }

  const refreshed = await getStaffMemberById(db, input.memberId)
  if (!refreshed) {
    throw new AppError(404, "STAFF_MEMBER_NOT_FOUND", "Staff member was not found.")
  }

  const rows = await listStaffMembers(db, { role: refreshed.role })
  const match = rows.find((entry) => entry.id === refreshed.id)
  if (!match) {
    return {
      id: refreshed.id,
      username: refreshed.username,
      displayName: refreshed.displayName,
      role: refreshed.role,
      status: refreshed.status,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    }
  }

  return serializeStaffMember(match)
}
