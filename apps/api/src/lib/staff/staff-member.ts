import { eq } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { authCredentials, authIdentityClaims, staffMembers } from "../../db/schema"
import { hashStaffPassword } from "../auth/staff-password"

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
