import { and, desc, eq } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { authCredentials, authIdentityClaims, staffMembers } from "../../db/schema"
import { hashStaffPassword } from "../auth/staff-password"

export const ADMIN_MANAGED_STAFF_ROLE = "CAPTION_WRITER" as const

export interface StaffMemberRow {
  id: string
  displayName: string
  role: string
  status: string
  username: string
}

export interface CreateStaffMemberInput {
  username: string
  password: string
  displayName: string
  role: string
  createdByStaffMemberId?: string | null
}

export async function findStaffMemberByUsername(db: DrizzleClient, username: string) {
  const normalized = username.trim().toLowerCase()
  const rows = await db
    .select({
      id: staffMembers.id,
      displayName: staffMembers.displayName,
      role: staffMembers.role,
      status: staffMembers.status,
      loginIdentifier: authCredentials.loginIdentifier,
    })
    .from(authCredentials)
    .innerJoin(staffMembers, eq(staffMembers.id, authCredentials.ownerId))
    .where(eq(authCredentials.ownerType, "STAFF"))
    .limit(200)

  const row = rows.find((entry) => entry.loginIdentifier.toLowerCase() === normalized)
  if (!row) return null

  return {
    id: row.id,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    username: row.loginIdentifier,
  } satisfies StaffMemberRow
}

export async function createStaffMember(db: DrizzleClient, input: CreateStaffMemberInput) {
  const existing = await findStaffMemberByUsername(db, input.username)
  if (existing) return null

  const passwordHash = await hashStaffPassword(input.password)
  const username = input.username.trim().toLowerCase()

  const inserted = await db
    .insert(staffMembers)
    .values({
      displayName: input.displayName.trim() || username,
      role: input.role,
      status: "ACTIVE",
      createdByStaffMemberId: input.createdByStaffMemberId ?? null,
    })
    .returning({ id: staffMembers.id })

  const staffMemberId = inserted[0]?.id
  if (!staffMemberId) return null

  await db.insert(authCredentials).values({
    ownerType: "STAFF",
    ownerId: staffMemberId,
    loginIdentifier: username,
    identifierType: "USERNAME",
    passwordHash,
    status: "ACTIVE",
    mustResetPassword: false,
    passwordUpdatedAt: new Date(),
  })

  await db
    .insert(authIdentityClaims)
    .values({
      claimType: "USERNAME",
      normalizedValue: username,
      ownerType: "STAFF",
      ownerId: staffMemberId,
      status: "ACTIVE",
    })
    .onConflictDoNothing()

  return findStaffMemberByUsername(db, username)
}

export async function getStaffCredentialPasswordHash(db: DrizzleClient, staffMemberId: string) {
  const rows = await db
    .select({ passwordHash: authCredentials.passwordHash })
    .from(authCredentials)
    .where(eq(authCredentials.ownerId, staffMemberId))
    .limit(1)

  return rows[0]?.passwordHash ?? null
}

export interface StaffMemberListItem {
  id: string
  username: string
  displayName: string
  role: string
  status: string
  createdAt: Date
  lastLoginAt: Date | null
}

export async function listStaffMembers(
  db: DrizzleClient,
  options: { role?: string } = {},
): Promise<StaffMemberListItem[]> {
  const roleFilter = options.role?.trim()
  const rows = await db
    .select({
      id: staffMembers.id,
      displayName: staffMembers.displayName,
      role: staffMembers.role,
      status: staffMembers.status,
      createdAt: staffMembers.createdAt,
      lastLoginAt: staffMembers.lastLoginAt,
      loginIdentifier: authCredentials.loginIdentifier,
    })
    .from(staffMembers)
    .innerJoin(authCredentials, eq(authCredentials.ownerId, staffMembers.id))
    .where(
      and(
        eq(authCredentials.ownerType, "STAFF"),
        roleFilter ? eq(staffMembers.role, roleFilter) : undefined,
      ),
    )
    .orderBy(desc(staffMembers.createdAt))
    .limit(200)

  return rows.map((row) => ({
    id: row.id,
    username: row.loginIdentifier,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  }))
}

export async function getStaffMemberById(db: DrizzleClient, staffMemberId: string) {
  const rows = await db
    .select({
      id: staffMembers.id,
      displayName: staffMembers.displayName,
      role: staffMembers.role,
      status: staffMembers.status,
      loginIdentifier: authCredentials.loginIdentifier,
    })
    .from(staffMembers)
    .innerJoin(authCredentials, eq(authCredentials.ownerId, staffMembers.id))
    .where(and(eq(staffMembers.id, staffMemberId), eq(authCredentials.ownerType, "STAFF")))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    username: row.loginIdentifier,
  } satisfies StaffMemberRow
}

export async function updateStaffMemberProfile(
  db: DrizzleClient,
  staffMemberId: string,
  input: { displayName?: string; status?: string },
) {
  const updates: { displayName?: string; status?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  }
  if (input.displayName !== undefined) updates.displayName = input.displayName.trim()
  if (input.status !== undefined) updates.status = input.status

  const updated = await db
    .update(staffMembers)
    .set(updates)
    .where(eq(staffMembers.id, staffMemberId))
    .returning({ id: staffMembers.id })

  return updated[0]?.id ?? null
}

export async function resetStaffMemberPassword(db: DrizzleClient, staffMemberId: string, password: string) {
  const passwordHash = await hashStaffPassword(password)
  const updated = await db
    .update(authCredentials)
    .set({
      passwordHash,
      passwordUpdatedAt: new Date(),
      mustResetPassword: false,
    })
    .where(and(eq(authCredentials.ownerId, staffMemberId), eq(authCredentials.ownerType, "STAFF")))
    .returning({ id: authCredentials.id })

  return updated[0]?.id ?? null
}
