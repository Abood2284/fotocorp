import { desc, eq } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import { customerAccessInquiries, users } from "../../../db/schema";
import {
  type AccessInterestAssetType,
  ACCESS_INTEREST_ASSET_TYPES,
  normalizeAccessInterestAssetTypes,
} from "../../../lib/access/access-interest-asset-types";
import { createPlatformUser, getPlatformUserById } from "../../../lib/users/platform-user";
import { isValidUsername, normalizeUsername } from "../../../auth/username";

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

/** @deprecated Use ACCESS_INTEREST_ASSET_TYPES from lib/access/access-interest-asset-types */
export const INTEREST_ASSET_TYPES = ACCESS_INTEREST_ASSET_TYPES;
export type InterestAssetType = AccessInterestAssetType;

export const IMAGE_QUANTITY_RANGES = ["0_20", "20_50", "50_100", "100_250", "250_plus"] as const;
export type ImageQuantityRange = (typeof IMAGE_QUANTITY_RANGES)[number];

export const IMAGE_QUALITY_PREFERENCES = ["LOW", "MEDIUM", "HIGH"] as const;
export type ImageQualityPreference = (typeof IMAGE_QUALITY_PREFERENCES)[number];

export type CompanyType = (typeof ALLOWED_COMPANY_TYPES)[number];

export interface ValidatedRegistrationProfile {
  firstName: string;
  lastName: string;
  username: string;
  companyType: CompanyType;
  companyName: string;
  jobTitle: string;
  customJobTitle: string | null;
  companyEmail: string;
  companyEmailDomain: string;
  emailValidationDecision: string;
  phoneCountryCode: string;
  phoneNumber: string;
  interestedAssetTypes: AccessInterestAssetType[];
  imageQuantityRange: ImageQuantityRange | null;
  imageQualityPreference: ImageQualityPreference | null;
  royaltyFreeQuantityRange: ImageQuantityRange | null;
  royaltyFreeQualityPreference: ImageQualityPreference | null;
  videoQuantityRange: ImageQuantityRange | null;
  caricatureQuantityRange: ImageQuantityRange | null;
}

export interface FotocorpUserProfileDto {
  firstName: string;
  lastName: string;
  companyType: string;
  companyName: string;
  jobTitle: string;
  customJobTitle: string | null;
  companyEmail: string;
  phoneCountryCode: string;
  phoneNumber: string;
  interestedAssetTypes: AccessInterestAssetType[];
  imageQuantityRange: string | null;
  imageQualityPreference: string | null;
  royaltyFreeQuantityRange: string | null;
  royaltyFreeQualityPreference: string | null;
  videoQuantityRange: string | null;
  caricatureQuantityRange: string | null;
}

export class RegistrationProfileValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RegistrationProfileValidationError";
  }
}

export async function validateRegistrationProfileBody(body: unknown): Promise<ValidatedRegistrationProfile> {
  if (!isObject(body)) {
    throw new RegistrationProfileValidationError("INVALID_REGISTRATION_PROFILE", "Registration profile is required.");
  }
  const email = readRequiredString(body, "email", "Email is required.");
  const companyEmailRaw = readOptionalString(body, "companyEmail") ?? email;
  const { normalizedEmail: companyEmail, domain: companyEmailDomain } = normalizeRegistrationEmail(companyEmailRaw);
  const username = normalizeUsername(readRequiredString(body, "username", "Username is required."));
  if (!isValidUsername(username)) {
    throw new RegistrationProfileValidationError(
      "INVALID_USERNAME",
      "Username must be 3 to 30 characters and contain only letters, numbers, underscores, or dots.",
    );
  }
  const jobTitle = readRequiredString(body, "jobTitle", "Job title is required.");
  const customJobTitle = readNullableString(body, "customJobTitle");
  if (jobTitle === "Other" && !customJobTitle) {
    throw new RegistrationProfileValidationError(
      "CUSTOM_JOB_TITLE_REQUIRED",
      "Custom job title is required when job title is Other.",
    );
  }
  const companyType = normalizeCompanyType(readRequiredString(body, "companyType", "Company type is required."));
  const interestedAssetTypes = normalizeAccessInterestAssetTypes(body.interestedAssetTypes);
  if (!interestedAssetTypes.length) {
    throw new RegistrationProfileValidationError(
      "INTERESTED_ASSET_TYPES_REQUIRED",
      "Select at least one type of content you are interested in.",
    );
  }
  let imageQuantityRange: ImageQuantityRange | null = null;
  let imageQualityPreference: ImageQualityPreference | null = null;
  if (interestedAssetTypes.includes("EDITORIAL")) {
    const rangeRaw = readRequiredString(
      body,
      "imageQuantityRange",
      "Editorial quantity range is required when Editorial is selected.",
    );
    imageQuantityRange = normalizeImageQuantityRange(rangeRaw);
    const qualityRaw = readRequiredString(
      body,
      "imageQualityPreference",
      "Editorial quality preference is required when Editorial is selected.",
    );
    imageQualityPreference = normalizeImageQualityPreference(qualityRaw);
  }
  let royaltyFreeQuantityRange: ImageQuantityRange | null = null;
  let royaltyFreeQualityPreference: ImageQualityPreference | null = null;
  if (interestedAssetTypes.includes("ROYALTY_FREE")) {
    const rangeRaw = readRequiredString(
      body,
      "royaltyFreeQuantityRange",
      "Royalty Free quantity range is required when Royalty Free is selected.",
    );
    royaltyFreeQuantityRange = normalizeImageQuantityRange(rangeRaw);
    const qualityRaw = readRequiredString(
      body,
      "royaltyFreeQualityPreference",
      "Royalty Free quality preference is required when Royalty Free is selected.",
    );
    royaltyFreeQualityPreference = normalizeImageQualityPreference(qualityRaw);
  }
  let videoQuantityRange: ImageQuantityRange | null = null;
  if (interestedAssetTypes.includes("VIDEO")) {
    const rangeRaw = readRequiredString(
      body,
      "videoQuantityRange",
      "Video quantity range is required when Video is selected.",
    );
    videoQuantityRange = normalizeImageQuantityRange(rangeRaw);
  }
  let caricatureQuantityRange: ImageQuantityRange | null = null;
  if (interestedAssetTypes.includes("CARICATURE")) {
    const rangeRaw = readRequiredString(
      body,
      "caricatureQuantityRange",
      "Caricature quantity range is required when Caricature is selected.",
    );
    caricatureQuantityRange = normalizeImageQuantityRange(rangeRaw);
  }
  return {
    firstName: readRequiredString(body, "firstName", "First name is required."),
    lastName: readRequiredString(body, "lastName", "Last name is required."),
    username,
    companyType,
    companyName: readRequiredString(body, "companyName", "Company name is required."),
    jobTitle,
    customJobTitle,
    companyEmail,
    companyEmailDomain,
    emailValidationDecision: "ALLOW",
    phoneCountryCode: readRequiredString(body, "phoneCountryCode", "Phone country code is required."),
    phoneNumber: readRequiredString(body, "phoneNumber", "Phone number is required."),
    interestedAssetTypes,
    imageQuantityRange,
    imageQualityPreference,
    royaltyFreeQuantityRange,
    royaltyFreeQualityPreference,
    videoQuantityRange,
    caricatureQuantityRange,
  };
}

/** @deprecated Prefer createPlatformUser; kept for Better Auth hook compatibility until P5. */
export async function createFotocorpUserProfile(
  db: DrizzleClient,
  _legacyAuthUserId: string,
  profile: ValidatedRegistrationProfile,
  login?: { email: string; displayName?: string | null; avatarUrl?: string | null },
) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, profile.username))
    .limit(1)

  if (existing[0]) return getFotocorpUserProfileByUserId(db, existing[0].id)

  const email = login?.email?.trim() ?? profile.companyEmail
  const created = await createPlatformUser(db, profile, {
    email,
    displayName: login?.displayName,
    avatarUrl: login?.avatarUrl,
  })

  return created ? getFotocorpUserProfileByUserId(db, created.id) : null
}

export async function getFotocorpUserProfileByUserId(db: DrizzleClient, userId: string) {
  return getPlatformUserById(db, userId)
}

export function toFotocorpUserProfileDto(
  profile: NonNullable<Awaited<ReturnType<typeof getPlatformUserById>>>,
): FotocorpUserProfileDto {
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
    interestedAssetTypes: normalizeAccessInterestAssetTypes(profile.interestedAssetTypes ?? []),
    imageQuantityRange: profile.imageQuantityRange ?? null,
    imageQualityPreference: profile.imageQualityPreference ?? null,
    royaltyFreeQuantityRange: profile.royaltyFreeQuantityRange ?? null,
    royaltyFreeQualityPreference: profile.royaltyFreeQualityPreference ?? null,
    videoQuantityRange: profile.videoQuantityRange ?? null,
    caricatureQuantityRange: profile.caricatureQuantityRange ?? null,
  };
}

function normalizeImageQuantityRange(value: string): ImageQuantityRange {
  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  const mapped =
    normalized === "0_20" || normalized === "20_50" || normalized === "50_100" || normalized === "100_250" || normalized === "250_plus"
      ? normalized
      : null;
  if (!mapped) {
    throw new RegistrationProfileValidationError("INVALID_IMAGE_QUANTITY_RANGE", "Quantity range is not valid.");
  }
  return mapped as ImageQuantityRange;
}

function normalizeImageQualityPreference(value: string): ImageQualityPreference {
  const normalized = value.trim().toUpperCase();
  if (!isImageQualityPreference(normalized)) {
    throw new RegistrationProfileValidationError("INVALID_IMAGE_QUALITY", "Quality preference is not valid.");
  }
  return normalized;
}

function isImageQualityPreference(value: string): value is ImageQualityPreference {
  return (IMAGE_QUALITY_PREFERENCES as readonly string[]).includes(value);
}

export async function findLatestInquiryForUser(db: DrizzleClient, userId: string) {
  const rows = await db
    .select({
      id: customerAccessInquiries.id,
      status: customerAccessInquiries.status,
      createdAt: customerAccessInquiries.createdAt,
    })
    .from(customerAccessInquiries)
    .where(eq(customerAccessInquiries.userId, userId))
    .orderBy(desc(customerAccessInquiries.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

function normalizeCompanyType(value: string): CompanyType {
  const normalized = value.trim().toLowerCase();
  if (isCompanyType(normalized)) return normalized;
  throw new RegistrationProfileValidationError(
    "INVALID_COMPANY_TYPE",
    `Company type must be one of: ${ALLOWED_COMPANY_TYPES.join(", ")}.`,
  );
}

function isCompanyType(value: string): value is CompanyType {
  return (ALLOWED_COMPANY_TYPES as readonly string[]).includes(value);
}

function readRequiredString(body: Record<string, unknown>, key: string, message: string) {
  const value = readOptionalString(body, key);
  if (!value) throw new RegistrationProfileValidationError(`MISSING_${toScreamingSnakeCase(key)}`, message);
  return value;
}

function readOptionalString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : null;
}

function readNullableString(body: Record<string, unknown>, key: string) {
  const value = readOptionalString(body, key);
  return value || null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toScreamingSnakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase();
}

function normalizeRegistrationEmail(emailInput: string) {
  const normalizedEmail = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new RegistrationProfileValidationError("BLOCK_INVALID_EMAIL", "Please enter a valid email address.");
  }
  const domain = normalizedEmail.split("@")[1]?.trim().toLowerCase();
  if (!domain) {
    throw new RegistrationProfileValidationError("BLOCK_INVALID_EMAIL", "Please enter a valid email address.");
  }
  return { normalizedEmail, domain };
}
