import { desc, eq } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { authIdentityClaims, customerAccessInquiries, users } from "../../db/schema"
import { AppError } from "../errors"
import type { ValidatedRegistrationProfile } from "../../routes/auth/services/fotocorp-registration-profile"

export interface PlatformUserRow {
  id: string
  status: string
  email: string
  role: string
}

export interface CreatePlatformUserInput {
  email: string
  displayName?: string | null
  avatarUrl?: string | null
  role?: "USER" | "ADMIN" | "SUPER_ADMIN"
}

function normalizePhoneClaim(countryCode: string, phoneNumber: string): string | null {
  const cc = countryCode.replace(/\D/g, "")
  const num = phoneNumber.replace(/\D/g, "")
  if (!cc || !num) return null
  return `+${cc}${num}`
}

export async function requireActivePlatformUser(db: DrizzleClient, userId: string): Promise<PlatformUserRow> {
  const rows = await db
    .select({
      id: users.id,
      status: users.status,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const user = rows[0]
  if (!user) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile was not found.")
  if (user.status !== "ACTIVE") throw new AppError(403, "PROFILE_NOT_ACTIVE", "Profile is not active.")
  return user
}

export async function createPlatformUser(
  db: DrizzleClient,
  profile: ValidatedRegistrationProfile,
  input: CreatePlatformUserInput,
) {
  const inserted = await db
    .insert(users)
    .values({
      email: input.email.trim().toLowerCase(),
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      displayName: input.displayName?.trim() || `${profile.firstName} ${profile.lastName}`.trim(),
      avatarUrl: input.avatarUrl ?? null,
      companyType: profile.companyType,
      companyName: profile.companyName,
      jobTitle: profile.jobTitle,
      customJobTitle: profile.customJobTitle,
      companyEmail: profile.companyEmail,
      companyEmailDomain: profile.companyEmailDomain,
      emailValidationDecision: profile.emailValidationDecision,
      phoneCountryCode: profile.phoneCountryCode,
      phoneNumber: profile.phoneNumber,
      interestedAssetTypes: profile.interestedAssetTypes,
      imageQuantityRange: profile.imageQuantityRange,
      imageQualityPreference: profile.imageQualityPreference,
      status: "ACTIVE",
      role: input.role ?? "USER",
    })
    .returning({ id: users.id })

  const userId = inserted[0]?.id
  if (!userId) return null

  const claimRows: Array<{
    claimType: "EMAIL" | "USERNAME" | "PHONE"
    normalizedValue: string
    ownerType: "USER"
    ownerId: string
    status: "ACTIVE"
  }> = [
    { claimType: "EMAIL", normalizedValue: input.email.trim().toLowerCase(), ownerType: "USER", ownerId: userId, status: "ACTIVE" },
    { claimType: "USERNAME", normalizedValue: profile.username.toLowerCase(), ownerType: "USER", ownerId: userId, status: "ACTIVE" },
  ]

  const phone = normalizePhoneClaim(profile.phoneCountryCode, profile.phoneNumber)
  if (phone) claimRows.push({ claimType: "PHONE", normalizedValue: phone, ownerType: "USER", ownerId: userId, status: "ACTIVE" })

  for (const claim of claimRows) {
    await db
      .insert(authIdentityClaims)
      .values(claim)
      .onConflictDoNothing()
  }

  await db.insert(customerAccessInquiries).values({
    inquiryType: "USER_ACCESS",
    userId,
    status: "PENDING",
    interestedAssetTypes: profile.interestedAssetTypes,
    imageQuantityRange: profile.imageQuantityRange,
    imageQualityPreference: profile.imageQualityPreference,
  })

  return getPlatformUserById(db, userId)
}

export async function getPlatformUserById(db: DrizzleClient, userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  return rows[0] ?? null
}

export async function findLatestInquiryForPlatformUser(db: DrizzleClient, userId: string) {
  const rows = await db
    .select({
      id: customerAccessInquiries.id,
      status: customerAccessInquiries.status,
      createdAt: customerAccessInquiries.createdAt,
    })
    .from(customerAccessInquiries)
    .where(eq(customerAccessInquiries.userId, userId))
    .orderBy(desc(customerAccessInquiries.createdAt))
    .limit(1)
  return rows[0] ?? null
}
