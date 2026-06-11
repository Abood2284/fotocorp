import type { customerAccessInquiries } from "../../db/schema"

export interface StaffSubmissionAuditResponse {
  ipAddress: string | null
  ipHash: string | null
  country: string | null
  city: string | null
  region: string | null
  regionCode: string | null
  cfRay: string | null
  userAgent: string | null
}

export const SUBMISSION_AUDIT_INQUIRY_KEYS = [
  "submissionIpAddress",
  "submissionIpHash",
  "submissionIpCountry",
  "submissionIpCity",
  "submissionIpRegion",
  "submissionIpRegionCode",
  "submissionCfRay",
  "submissionUserAgent",
  "submission_ip_address",
  "submission_ip_hash",
  "submission_ip_country",
  "submission_ip_city",
  "submission_ip_region",
  "submission_ip_region_code",
  "submission_cf_ray",
  "submission_user_agent",
] as const

type InquirySubmissionAuditSource = Pick<
  typeof customerAccessInquiries.$inferSelect,
  | "submissionIpAddress"
  | "submissionIpHash"
  | "submissionIpCountry"
  | "submissionIpCity"
  | "submissionIpRegion"
  | "submissionIpRegionCode"
  | "submissionCfRay"
  | "submissionUserAgent"
>

export function buildStaffSubmissionAuditResponse(
  inquiry: InquirySubmissionAuditSource,
  options: { includeIpAddress: boolean },
): StaffSubmissionAuditResponse {
  return {
    ipAddress: options.includeIpAddress ? inquiry.submissionIpAddress ?? null : null,
    ipHash: inquiry.submissionIpHash ?? null,
    country: inquiry.submissionIpCountry ?? null,
    city: inquiry.submissionIpCity ?? null,
    region: inquiry.submissionIpRegion ?? null,
    regionCode: inquiry.submissionIpRegionCode ?? null,
    cfRay: inquiry.submissionCfRay ?? null,
    userAgent: inquiry.submissionUserAgent ?? null,
  }
}

export function sanitizeCustomerAccessInquiryForStaffResponse<T extends Record<string, unknown>>(inquiry: T) {
  const sanitized = { ...inquiry }
  for (const key of SUBMISSION_AUDIT_INQUIRY_KEYS) {
    delete sanitized[key]
  }
  return sanitized
}

/** @deprecated Use sanitizeCustomerAccessInquiryForStaffResponse */
export function omitSubmissionAuditFromInquiry<T extends InquirySubmissionAuditSource & Record<string, unknown>>(
  inquiry: T,
) {
  return sanitizeCustomerAccessInquiryForStaffResponse(inquiry)
}

export function serializeStaffInquiryMutationResponse(inquiry: Record<string, unknown> & InquirySubmissionAuditSource) {
  const sanitized = sanitizeCustomerAccessInquiryForStaffResponse(inquiry)
  return {
    ...sanitized,
    createdAt: inquiry.createdAt instanceof Date ? inquiry.createdAt.toISOString() : inquiry.createdAt,
    updatedAt: inquiry.updatedAt instanceof Date ? inquiry.updatedAt.toISOString() : inquiry.updatedAt,
  }
}

export function staffRoleIncludesSubmissionIpAddress(role: string | null | undefined): boolean {
  return role?.trim().toUpperCase() === "SUPER_ADMIN"
}

export function inquiryResponseContainsSubmissionAuditFields(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  return SUBMISSION_AUDIT_INQUIRY_KEYS.some((key) => key in value)
}
