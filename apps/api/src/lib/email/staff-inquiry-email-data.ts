import { ACCESS_INTEREST_ASSET_LABELS } from "../access/access-interest-asset-types"
import type { RequestAuditContext } from "../request-audit-context"
import type { ValidatedRegistrationProfile } from "../../routes/auth/services/fotocorp-registration-profile"
import type { EmailTemplateData, StaffInquiryInterestLine } from "./types"

const QUANTITY_LABELS: Record<string, string> = {
  "0_20": "0–20",
  "20_50": "20–50",
  "50_100": "50–100",
  "100_250": "100–250",
  "250_plus": "250+",
}

const QUALITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
}

const COMPANY_TYPE_LABELS: Record<string, string> = {
  agency: "Agency",
  brand: "Brand",
  broadcaster: "Broadcaster",
  education: "Education",
  government: "Government",
  media: "Media",
  newsroom: "Newsroom",
  non_profit: "Non-profit",
  photo_agency: "Photo agency",
  publisher: "Publisher",
  other: "Other",
}

export interface BuildStaffAccessInquiryEmailDataInput {
  profile: ValidatedRegistrationProfile
  requestAudit?: RequestAuditContext | null
  submittedAt?: Date | string | null
}

export interface BuildStaffContributorApplicationEmailDataInput {
  firstName: string
  lastName: string
  proposedUsername: string
  email?: string | null
  phoneCountryCode?: string | null
  phoneNumber?: string | null
  applicationNotes?: string | null
  requestAudit?: RequestAuditContext | null
  submittedAt?: Date | string | null
}

export function buildStaffAccessInquiryEmailData(
  input: BuildStaffAccessInquiryEmailDataInput,
): EmailTemplateData {
  const { profile, requestAudit, submittedAt } = input
  const jobTitle =
    profile.jobTitle === "Other" && profile.customJobTitle?.trim()
      ? `Other (${profile.customJobTitle.trim()})`
      : profile.jobTitle

  return {
    inquiryApplicantName: `${profile.firstName} ${profile.lastName}`.trim(),
    inquiryUsername: profile.username,
    inquiryCompanyName: profile.companyName,
    inquiryCompanyType: formatCompanyType(profile.companyType),
    inquiryJobTitle: jobTitle,
    inquiryApplicantEmail: profile.companyEmail,
    inquiryPhone: formatPhone(profile.phoneCountryCode, profile.phoneNumber),
    inquiryInterestLines: buildInterestLines(profile),
    inquirySubmittedAt: formatSubmittedAt(submittedAt),
    inquiryCountry: displayOrNull(requestAudit?.country),
    inquiryCity: displayOrNull(requestAudit?.city),
    inquiryRegion: displayOrNull(requestAudit?.region),
    inquiryIpAddress: displayOrNull(requestAudit?.ipAddress),
  }
}

export function buildStaffContributorApplicationEmailData(
  input: BuildStaffContributorApplicationEmailDataInput,
): EmailTemplateData {
  return {
    inquiryApplicantName: `${input.firstName} ${input.lastName}`.trim(),
    inquiryProposedUsername: input.proposedUsername.trim() || null,
    inquiryApplicantEmail: displayOrNull(input.email),
    inquiryPhone: formatPhone(input.phoneCountryCode, input.phoneNumber),
    inquiryApplicationNotes: displayOrNull(input.applicationNotes),
    inquirySubmittedAt: formatSubmittedAt(input.submittedAt),
    inquiryCountry: displayOrNull(input.requestAudit?.country),
    inquiryCity: displayOrNull(input.requestAudit?.city),
    inquiryRegion: displayOrNull(input.requestAudit?.region),
    inquiryIpAddress: displayOrNull(input.requestAudit?.ipAddress),
  }
}

function buildInterestLines(profile: ValidatedRegistrationProfile): StaffInquiryInterestLine[] {
  const lines: StaffInquiryInterestLine[] = []
  for (const assetType of profile.interestedAssetTypes) {
    const assetLabel = ACCESS_INTEREST_ASSET_LABELS[assetType]
    switch (assetType) {
      case "EDITORIAL":
        lines.push({
          assetLabel,
          quantityRange: formatQuantity(profile.imageQuantityRange),
          qualityPreference: formatQuality(profile.imageQualityPreference),
        })
        break
      case "ROYALTY_FREE":
        lines.push({
          assetLabel,
          quantityRange: formatQuantity(profile.royaltyFreeQuantityRange),
          qualityPreference: formatQuality(profile.royaltyFreeQualityPreference),
        })
        break
      case "VIDEO":
        lines.push({
          assetLabel,
          quantityRange: formatQuantity(profile.videoQuantityRange),
        })
        break
      case "CARICATURE":
        lines.push({
          assetLabel,
          quantityRange: formatQuantity(profile.caricatureQuantityRange),
        })
        break
      default: {
        const _exhaustive: never = assetType
        void _exhaustive
      }
    }
  }
  return lines
}

function formatCompanyType(value: string): string {
  return COMPANY_TYPE_LABELS[value] ?? value
}

function formatQuantity(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return QUANTITY_LABELS[value] ?? value
}

function formatQuality(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return QUALITY_LABELS[value] ?? value
}

function formatPhone(countryCode?: string | null, phoneNumber?: string | null): string | null {
  const code = countryCode?.trim() ?? ""
  const number = phoneNumber?.trim() ?? ""
  if (!code && !number) return null
  if (code && number) return `+${code.replace(/^\+/, "")} ${number}`
  return code || number
}

function formatSubmittedAt(value?: Date | string | null): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const trimmed = value.trim()
  return trimmed || null
}

function displayOrNull(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}
