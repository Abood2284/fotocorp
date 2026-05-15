import { eq, desc } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import { customerAccessInquiries, fotocorpUserProfiles } from "../../../db/schema";
import { isValidUsername, normalizeUsername } from "../../../auth/username";
import { recordIntendedEmailEvent } from "../../../lib/email/email-service";
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

export const INTEREST_ASSET_TYPES = ["IMAGE", "VIDEO", "CARICATURE"] as const;
export type InterestAssetType = (typeof INTEREST_ASSET_TYPES)[number];

export const IMAGE_QUANTITY_RANGES = ["0_20", "20_50", "50_100", "100_250", "250_plus"] as const;
export type ImageQuantityRange = (typeof IMAGE_QUANTITY_RANGES)[number];

export const IMAGE_QUALITY_PREFERENCES = ["LOW", "MEDIUM", "HIGH"] as const;
export type ImageQualityPreference = (typeof IMAGE_QUALITY_PREFERENCES)[number];

export type CompanyType = (typeof ALLOWED_COMPANY_TYPES)[number];

export interface RegistrationProfileValidationOptions {
  emailRepository: BusinessEmailValidationRepository;
  fetchMx?: BusinessEmailValidationOptions["fetchMx"];
  now?: Date;
}

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
  emailValidationDecision: BusinessEmailValidationResult["decision"];
  phoneCountryCode: string;
  phoneNumber: string;
  interestedAssetTypes: InterestAssetType[];
  imageQuantityRange: ImageQuantityRange | null;
  imageQualityPreference: ImageQualityPreference | null;
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
  interestedAssetTypes: InterestAssetType[];
  imageQuantityRange: string | null;
  imageQualityPreference: string | null;
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

export async function validateRegistrationProfileBody(
  body: unknown,
  options: RegistrationProfileValidationOptions,
): Promise<ValidatedRegistrationProfile> {
  if (!isObject(body)) {
    throw new RegistrationProfileValidationError("INVALID_REGISTRATION_PROFILE", "Registration profile is required.");
  }
  const email = readRequiredString(body, "email", "Email is required.");
  const companyEmail = readOptionalString(body, "companyEmail") ?? email;
  const emailValidation = await validateBusinessEmail(companyEmail, {
    repository: options.emailRepository,
    fetchMx: options.fetchMx,
    now: options.now,
  });
  if (!emailValidation.ok || !emailValidation.normalizedEmail || !emailValidation.domain) {
    throw new RegistrationProfileValidationError(emailValidation.decision, emailValidation.message);
  }
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
  const interestedAssetTypes = readInterestAssetTypes(body);
  if (!interestedAssetTypes.length) {
    throw new RegistrationProfileValidationError(
      "INTERESTED_ASSET_TYPES_REQUIRED",
      "Select at least one type of content you are interested in.",
    );
  }
  let imageQuantityRange: ImageQuantityRange | null = null;
  let imageQualityPreference: ImageQualityPreference | null = null;
  if (interestedAssetTypes.includes("IMAGE")) {
    const rangeRaw = readRequiredString(body, "imageQuantityRange", "Image quantity range is required when Images is selected.");
    imageQuantityRange = normalizeImageQuantityRange(rangeRaw);
    const qualityRaw = readRequiredString(
      body,
      "imageQualityPreference",
      "Image quality preference is required when Images is selected.",
    );
    imageQualityPreference = normalizeImageQualityPreference(qualityRaw);
  }
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
    interestedAssetTypes,
    imageQuantityRange,
    imageQualityPreference,
  };
}

export async function createFotocorpUserProfile(db: DrizzleClient, userId: string, profile: ValidatedRegistrationProfile) {
  const inserted = await db
    .insert(fotocorpUserProfiles)
    .values({
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
      interestedAssetTypes: profile.interestedAssetTypes,
      imageQuantityRange: profile.imageQuantityRange,
      imageQualityPreference: profile.imageQualityPreference,
    })
    .onConflictDoNothing({ target: fotocorpUserProfiles.userId })
    .returning({ id: fotocorpUserProfiles.id });

  if (inserted.length) {
    await db.insert(customerAccessInquiries).values({
      authUserId: userId,
      status: "PENDING",
      interestedAssetTypes: profile.interestedAssetTypes,
      imageQuantityRange: profile.imageQuantityRange,
      imageQualityPreference: profile.imageQualityPreference,
    });
    recordIntendedEmailEvent({
      templateId: "access_inquiry_received",
      to: profile.companyEmail,
      subject: "We received your Fotocorp access request",
      payload: {
        userId,
        interestedAssetTypes: profile.interestedAssetTypes,
        imageQuantityRange: profile.imageQuantityRange,
        imageQualityPreference: profile.imageQualityPreference,
      },
      createdAt: new Date().toISOString(),
    });
  }

  return getFotocorpUserProfileByUserId(db, userId);
}

export async function getFotocorpUserProfileByUserId(db: DrizzleClient, userId: string) {
  const rows = await db.select().from(fotocorpUserProfiles).where(eq(fotocorpUserProfiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export function toFotocorpUserProfileDto(
  profile: NonNullable<Awaited<ReturnType<typeof getFotocorpUserProfileByUserId>>>,
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
    interestedAssetTypes: (profile.interestedAssetTypes ?? []) as InterestAssetType[],
    imageQuantityRange: profile.imageQuantityRange ?? null,
    imageQualityPreference: profile.imageQualityPreference ?? null,
  };
}

function readInterestAssetTypes(body: Record<string, unknown>): InterestAssetType[] {
  const raw = body.interestedAssetTypes;
  const list: unknown[] = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",").map((s) => s.trim()) : [];
  const out: InterestAssetType[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const normalized = item.trim().toUpperCase();
    if (isInterestAssetType(normalized) && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

function isInterestAssetType(value: string): value is InterestAssetType {
  return (INTEREST_ASSET_TYPES as readonly string[]).includes(value);
}

function normalizeImageQuantityRange(value: string): ImageQuantityRange {
  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  const mapped =
    normalized === "0_20" || normalized === "20_50" || normalized === "50_100" || normalized === "100_250" || normalized === "250_plus"
      ? normalized
      : null;
  if (!mapped) {
    throw new RegistrationProfileValidationError("INVALID_IMAGE_QUANTITY_RANGE", "Image quantity range is not valid.");
  }
  return mapped as ImageQuantityRange;
}

function normalizeImageQualityPreference(value: string): ImageQualityPreference {
  const normalized = value.trim().toUpperCase();
  if (!isImageQualityPreference(normalized)) {
    throw new RegistrationProfileValidationError("INVALID_IMAGE_QUALITY", "Image quality preference is not valid.");
  }
  return normalized;
}

function isImageQualityPreference(value: string): value is ImageQualityPreference {
  return (IMAGE_QUALITY_PREFERENCES as readonly string[]).includes(value);
}

export async function findLatestInquiryForUser(db: DrizzleClient, authUserId: string) {
  const rows = await db
    .select({
      id: customerAccessInquiries.id,
      status: customerAccessInquiries.status,
      createdAt: customerAccessInquiries.createdAt,
    })
    .from(customerAccessInquiries)
    .where(eq(customerAccessInquiries.authUserId, authUserId))
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
