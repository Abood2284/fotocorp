import type { RequestAuditContext } from "../request-audit-context"

export function buildCustomerAccessInquirySubmissionAuditFields(
  requestAudit?: RequestAuditContext | null,
) {
  return {
    submissionIpAddress: requestAudit?.ipAddress ?? null,
    submissionIpHash: requestAudit?.ipHash ?? null,
    submissionIpCountry: requestAudit?.country ?? null,
    submissionIpCity: requestAudit?.city ?? null,
    submissionIpRegion: requestAudit?.region ?? null,
    submissionIpRegionCode: requestAudit?.regionCode ?? null,
    submissionCfRay: requestAudit?.cfRay ?? null,
    submissionUserAgent: requestAudit?.userAgent ?? null,
  }
}
