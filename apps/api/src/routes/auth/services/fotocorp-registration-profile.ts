import { eq } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import { fotocorpUserProfiles } from "../../../db/schema";
import { isValidUsername, normalizeUsername } from "../../../auth/username";
import type {
  BusinessEmailValidationOptions,
  BusinessEmailValidationRepository,
  BusinessEmailValidationResult,
} from "./business-email-validation";
import { validateBusinessEmail } from "./business-email-validation";

export const ALLOWED_COMPANY_TYPES = [
  "agency",
  "brand",
  "broadcaster",
  "education",
  "government",
  "media",
  "newsroom",
  "non_profit",
  "photo_agency",
  "publisher",
  "other",
] as const;

export type CompanyType = typeof ALLOWED_COMPANY_TYPES[number];
export interface RegistrationProfileValidationOptions { emailRepository: BusinessEmailValidationRepository; fetchMx?: BusinessEmailValidationOptions["fetchMx"]; now?: Date }
export interface ValidatedRegistrationProfile {
  firstName: string; lastName: string; username: string; companyType: CompanyType; companyName: string; jobTitle: string; customJobTitle: string | null; companyEmail: string; companyEmailDomain: string; emailValidationDecision: BusinessEmailValidationResult["decision"]; phoneCountryCode: string; phoneNumber: string; phoneExtension: string | null;
}
export interface FotocorpUserProfileDto { firstName: string; lastName: string; companyType: string; companyName: string; jobTitle: string; customJobTitle: string | null; companyEmail: string; phoneCountryCode: string; phoneNumber: string; phoneExtension: string | null }
export class RegistrationProfileValidationError extends Error { constructor(public readonly code: string, message: string) { super(message); this.name = "RegistrationProfileValidationError" } }

export async function validateRegistrationProfileBody(body: unknown, options: RegistrationProfileValidationOptions): Promise<ValidatedRegistrationProfile> {
  if (!isObject(body)) throw new RegistrationProfileValidationError("INVALID_REGISTRATION_PROFILE", "Registration profile is required.")
  const email = readRequiredString(body, "email", "Email is required.")
  const companyEmail = readOptionalString(body, "companyEmail") ?? email
  const emailValidation = await validateBusinessEmail(companyEmail, { repository: options.emailRepository, fetchMx: options.fetchMx, now: options.now })
  if (!emailValidation.ok || !emailValidation.normalizedEmail || !emailValidation.domain) throw new RegistrationProfileValidationError(emailValidation.decision, emailValidation.message)
  const username = normalizeUsername(readRequiredString(body, "username", "Username is required."))
  if (!isValidUsername(username)) throw new RegistrationProfileValidationError("INVALID_USERNAME", "Username must be 3 to 30 characters and contain only letters, numbers, underscores, or dots.")
  const jobTitle = readRequiredString(body, "jobTitle", "Job title is required.")
  const customJobTitle = readNullableString(body, "customJobTitle")
  if (jobTitle === "Other" && !customJobTitle) throw new RegistrationProfileValidationError("CUSTOM_JOB_TITLE_REQUIRED", "Custom job title is required when job title is Other.")
  const companyType = normalizeCompanyType(readRequiredString(body, "companyType", "Company type is required."))
  return {
    firstName: readRequiredString(body, "firstName", "First name is required."),
    lastName: readRequiredString(body, "lastName", "Last name is required."),
    username,
    companyType,
    companyName: readRequiredString(body, "companyName", "Company name is required."),
    jobTitle,
    customJobTitle,
    companyEmail: emailValidation.normalizedEmail,
    companyEmailDomain: emailValidation.domain,
    emailValidationDecision: emailValidation.decision,
    phoneCountryCode: readRequiredString(body, "phoneCountryCode", "Phone country code is required."),
    phoneNumber: readRequiredString(body, "phoneNumber", "Phone number is required."),
    phoneExtension: readNullableString(body, "phoneExtension"),
  }
}

export async function createFotocorpUserProfile(db: DrizzleClient, userId: string, profile: ValidatedRegistrationProfile) {
  await db.insert(fotocorpUserProfiles).values({
    userId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    username: profile.username,
    companyType: profile.companyType,
    companyName: profile.companyName,
    jobTitle: profile.jobTitle,
    customJobTitle: profile.customJobTitle,
    companyEmail: profile.companyEmail,
    companyEmailDomain: profile.companyEmailDomain,
    emailValidationDecision: profile.emailValidationDecision,
    phoneCountryCode: profile.phoneCountryCode,
    phoneNumber: profile.phoneNumber,
    phoneExtension: profile.phoneExtension,
  }).onConflictDoNothing({ target: fotocorpUserProfiles.userId });
  return getFotocorpUserProfileByUserId(db, userId);
}

export async function getFotocorpUserProfileByUserId(db: DrizzleClient, userId: string) {
  const rows = await db.select().from(fotocorpUserProfiles).where(eq(fotocorpUserProfiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export function toFotocorpUserProfileDto(profile: NonNullable<Awaited<ReturnType<typeof getFotocorpUserProfileByUserId>>>): FotocorpUserProfileDto {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    companyType: profile.companyType,
    companyName: profile.companyName,
    jobTitle: profile.jobTitle,
    customJobTitle: profile.customJobTitle,
    companyEmail: profile.companyEmail,
    phoneCountryCode: profile.phoneCountryCode,
    phoneNumber: profile.phoneNumber,
    phoneExtension: profile.phoneExtension,
  };
}

function normalizeCompanyType(value: string): CompanyType { const normalized = value.trim().toLowerCase(); if (isCompanyType(normalized)) return normalized; throw new RegistrationProfileValidationError("INVALID_COMPANY_TYPE", `Company type must be one of: ${ALLOWED_COMPANY_TYPES.join(", ")}.`) }
function isCompanyType(value: string): value is CompanyType { return (ALLOWED_COMPANY_TYPES as readonly string[]).includes(value) }
function readRequiredString(body: Record<string, unknown>, key: string, message: string) { const value = readOptionalString(body, key); if (!value) throw new RegistrationProfileValidationError(`MISSING_${toScreamingSnakeCase(key)}`, message); return value }
function readOptionalString(body: Record<string, unknown>, key: string) { const value = body[key]; return typeof value === "string" ? value.trim() : null }
function readNullableString(body: Record<string, unknown>, key: string) { const value = readOptionalString(body, key); return value || null }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
function toScreamingSnakeCase(value: string) { return value.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase() }
