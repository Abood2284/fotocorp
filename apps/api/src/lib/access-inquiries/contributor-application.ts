import { and, eq, ne, or, sql } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { authCredentials, authIdentityClaims, contributors, customerAccessInquiries } from "../../db/schema"
import { isValidUsername, normalizeUsername } from "../../auth/username"
import {
  generatePhotographerPortalTemporaryPassword,
  hashPhotographerPortalPassword,
} from "../auth/contributor-password"
import { AppError } from "../errors"
import { buildCustomerAccessInquirySubmissionAuditFields } from "./submission-audit-fields"
import type { RequestAuditContext } from "../request-audit-context"

const PLACEHOLDER_EMAIL = "contact@fotocorp.com"

export interface SubmitContributorApplicationInput {
  firstName: string
  lastName: string
  proposedUsername: string
  email?: string | null
  phoneCountryCode?: string | null
  phoneNumber?: string | null
  applicationNotes?: string | null
  requestAudit?: RequestAuditContext | null
}

export interface ApproveContributorApplicationInput {
  username?: string | null
}

function normalizePhoneClaim(countryCode: string, phoneNumber: string): string | null {
  const cc = countryCode.replace(/\D/g, "")
  const num = phoneNumber.replace(/\D/g, "")
  if (!cc || !num) return null
  return `+${cc}${num}`
}

function isPlaceholderEmail(email: string): boolean {
  return email.trim().toLowerCase() === PLACEHOLDER_EMAIL
}

async function assertClaimAvailable(
  db: DrizzleClient,
  claimType: "USERNAME" | "EMAIL" | "PHONE",
  normalizedValue: string,
  ownerId: string,
) {
  const rows = await db
    .select({
      ownerType: authIdentityClaims.ownerType,
      ownerId: authIdentityClaims.ownerId,
      status: authIdentityClaims.status,
    })
    .from(authIdentityClaims)
    .where(
      and(
        eq(authIdentityClaims.claimType, claimType),
        eq(authIdentityClaims.normalizedValue, normalizedValue),
        ne(authIdentityClaims.status, "RELEASED"),
        or(
          ne(authIdentityClaims.ownerType, "CONTRIBUTOR"),
          ne(authIdentityClaims.ownerId, ownerId),
        ),
      ),
    )
    .limit(1)

  const conflict = rows[0]
  if (conflict) {
    const label = claimType === "USERNAME" ? "Username" : claimType === "EMAIL" ? "Email" : "Phone number"
    throw new AppError(409, "CLAIM_CONFLICT", `${label} is already reserved.`)
  }
}

export async function submitContributorApplication(db: DrizzleClient, input: SubmitContributorApplicationInput) {
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  if (!firstName || !lastName) {
    throw new AppError(400, "APPLICANT_NAME_REQUIRED", "First and last name are required.")
  }

  const username = normalizeUsername(input.proposedUsername)
  if (!isValidUsername(username)) {
    throw new AppError(400, "USERNAME_INVALID", "Choose a username with 3–30 lowercase letters, numbers, dots, or underscores.")
  }

  const emailRaw = input.email?.trim() ?? ""
  const email = emailRaw && !isPlaceholderEmail(emailRaw) ? emailRaw.toLowerCase() : null

  const phone =
    input.phoneCountryCode && input.phoneNumber
      ? normalizePhoneClaim(input.phoneCountryCode, input.phoneNumber)
      : null

  const displayName = `${firstName} ${lastName}`.trim()

  const contributorRows = await db
    .insert(contributors)
    .values({
      displayName,
      firstName,
      lastName,
      email,
      mobilePhone: phone,
      status: "INACTIVE",
      source: "APPLICATION",
    })
    .returning({ id: contributors.id })

  const contributorId = contributorRows[0]?.id
  if (!contributorId) throw new AppError(500, "CONTRIBUTOR_CREATE_FAILED", "Could not create contributor application.")

  await assertClaimAvailable(db, "USERNAME", username, contributorId)
  if (email) await assertClaimAvailable(db, "EMAIL", email, contributorId)
  if (phone) await assertClaimAvailable(db, "PHONE", phone, contributorId)

  const claimRows: Array<{
    claimType: "USERNAME" | "EMAIL" | "PHONE"
    normalizedValue: string
    ownerType: "CONTRIBUTOR"
    ownerId: string
    status: "PENDING"
  }> = [{ claimType: "USERNAME", normalizedValue: username, ownerType: "CONTRIBUTOR", ownerId: contributorId, status: "PENDING" }]
  if (email) claimRows.push({ claimType: "EMAIL", normalizedValue: email, ownerType: "CONTRIBUTOR", ownerId: contributorId, status: "PENDING" })
  if (phone) claimRows.push({ claimType: "PHONE", normalizedValue: phone, ownerType: "CONTRIBUTOR", ownerId: contributorId, status: "PENDING" })

  for (const claim of claimRows) {
    const inserted = await db.insert(authIdentityClaims).values(claim).onConflictDoNothing().returning({ id: authIdentityClaims.id })
    if (!inserted[0]) {
      throw new AppError(409, "CLAIM_CONFLICT", "One of the identifiers is already reserved.")
    }
  }

  const inquiryRows = await db
    .insert(customerAccessInquiries)
    .values({
      inquiryType: "CONTRIBUTOR_APPLICATION",
      contributorId,
      status: "PENDING",
      applicantFirstName: firstName,
      applicantLastName: lastName,
      applicantEmail: email,
      applicantPhoneCountryCode: input.phoneCountryCode?.trim() || null,
      applicantPhoneNumber: input.phoneNumber?.trim() || null,
      proposedUsername: username,
      applicationNotes: input.applicationNotes?.trim() || null,
      interestedAssetTypes: [],
      ...buildCustomerAccessInquirySubmissionAuditFields(input.requestAudit),
    })
    .returning({
      id: customerAccessInquiries.id,
      status: customerAccessInquiries.status,
      createdAt: customerAccessInquiries.createdAt,
    })

  const inquiry = inquiryRows[0]
  if (!inquiry) throw new AppError(500, "INQUIRY_CREATE_FAILED", "Could not record contributor application.")

  return { inquiryId: inquiry.id, contributorId, status: inquiry.status, createdAt: inquiry.createdAt }
}

export async function approveContributorApplication(
  db: DrizzleClient,
  inquiryId: string,
  input: ApproveContributorApplicationInput,
) {
  const rows = await db
    .select()
    .from(customerAccessInquiries)
    .where(eq(customerAccessInquiries.id, inquiryId))
    .limit(1)

  const inquiry = rows[0]
  if (!inquiry) throw new AppError(404, "INQUIRY_NOT_FOUND", "Access inquiry was not found.")
  if (inquiry.inquiryType !== "CONTRIBUTOR_APPLICATION") {
    throw new AppError(400, "INQUIRY_TYPE_INVALID", "This inquiry is not a contributor application.")
  }
  if (inquiry.status === "CONTRIBUTOR_APPROVED" || inquiry.status === "CLOSED") {
    throw new AppError(400, "INQUIRY_ALREADY_FINAL", "This application has already been finalized.")
  }

  const contributorId = inquiry.contributorId
  if (!contributorId) throw new AppError(400, "CONTRIBUTOR_MISSING", "Contributor application is missing a profile link.")

  const username = normalizeUsername(input.username?.trim() || inquiry.proposedUsername || "")
  if (!isValidUsername(username)) {
    throw new AppError(400, "USERNAME_INVALID", "Approval username is invalid.")
  }

  await assertClaimAvailable(db, "USERNAME", username, contributorId)

  const existingCredential = await db
    .select({ id: authCredentials.id })
    .from(authCredentials)
    .where(
      and(
        eq(authCredentials.ownerType, "CONTRIBUTOR"),
        eq(authCredentials.ownerId, contributorId),
        eq(authCredentials.identifierType, "USERNAME"),
      ),
    )
    .limit(1)

  if (existingCredential[0]) {
    throw new AppError(409, "CREDENTIAL_EXISTS", "This contributor already has portal credentials.")
  }

  const temporaryPassword = generatePhotographerPortalTemporaryPassword()
  const passwordHash = await hashPhotographerPortalPassword(temporaryPassword)

  await db.transaction(async (tx) => {
    await tx
      .update(contributors)
      .set({ status: "ACTIVE", updatedAt: sql`now()` })
      .where(eq(contributors.id, contributorId))

    await tx.insert(authCredentials).values({
      ownerType: "CONTRIBUTOR",
      ownerId: contributorId,
      loginIdentifier: username,
      identifierType: "USERNAME",
      passwordHash,
      status: "ACTIVE",
      mustResetPassword: true,
    })

    await tx
      .update(authIdentityClaims)
      .set({ status: "ACTIVE", updatedAt: sql`now()` })
      .where(and(eq(authIdentityClaims.ownerType, "CONTRIBUTOR"), eq(authIdentityClaims.ownerId, contributorId)))

    if (username !== normalizeUsername(inquiry.proposedUsername ?? "")) {
      await tx
        .update(authIdentityClaims)
        .set({ normalizedValue: username, updatedAt: sql`now()` })
        .where(
          and(
            eq(authIdentityClaims.ownerType, "CONTRIBUTOR"),
            eq(authIdentityClaims.ownerId, contributorId),
            eq(authIdentityClaims.claimType, "USERNAME"),
          ),
        )
    }

    await tx
      .update(customerAccessInquiries)
      .set({ status: "CONTRIBUTOR_APPROVED", proposedUsername: username, updatedAt: sql`now()` })
      .where(eq(customerAccessInquiries.id, inquiryId))
  })

  return { contributorId, username, temporaryPassword, inquiryId }
}
