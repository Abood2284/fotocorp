import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildStaffSubmissionAuditResponse,
  inquiryResponseContainsSubmissionAuditFields,
  sanitizeCustomerAccessInquiryForStaffResponse,
  serializeStaffInquiryMutationResponse,
  staffRoleIncludesSubmissionIpAddress,
} from "../src/lib/access-inquiries/submission-audit-response"

const sampleInquiry = {
  id: "11111111-1111-4111-8111-111111111111",
  inquiryType: "USER_ACCESS",
  status: "PENDING",
  createdAt: new Date("2026-06-11T12:00:00.000Z"),
  updatedAt: new Date("2026-06-11T12:30:00.000Z"),
  submissionIpAddress: "203.0.113.10",
  submissionIpHash: "abc123hash",
  submissionIpCountry: "US",
  submissionIpCity: "Austin",
  submissionIpRegion: "Texas",
  submissionIpRegionCode: "TX",
  submissionCfRay: "ray-123",
  submissionUserAgent: "FotocorpTest/1.0",
}

describe("buildStaffSubmissionAuditResponse", () => {
  it("includes raw IP for SUPER_ADMIN", () => {
    assert.deepEqual(
      buildStaffSubmissionAuditResponse(sampleInquiry, { includeIpAddress: true }),
      {
        ipAddress: "203.0.113.10",
        ipHash: "abc123hash",
        country: "US",
        city: "Austin",
        region: "Texas",
        regionCode: "TX",
        cfRay: "ray-123",
        userAgent: "FotocorpTest/1.0",
      },
    )
  })

  it("omits raw IP for non-SUPER_ADMIN staff", () => {
    const audit = buildStaffSubmissionAuditResponse(sampleInquiry, { includeIpAddress: false })
    assert.equal(audit.ipAddress, null)
    assert.equal(audit.ipHash, "abc123hash")
    assert.equal(audit.country, "US")
    assert.equal(audit.userAgent, "FotocorpTest/1.0")
  })

  it("returns nulls when submission audit fields are missing", () => {
    assert.deepEqual(
      buildStaffSubmissionAuditResponse(
        {
          submissionIpAddress: null,
          submissionIpHash: null,
          submissionIpCountry: null,
          submissionIpCity: null,
          submissionIpRegion: null,
          submissionIpRegionCode: null,
          submissionCfRay: null,
          submissionUserAgent: null,
        },
        { includeIpAddress: true },
      ),
      {
        ipAddress: null,
        ipHash: null,
        country: null,
        city: null,
        region: null,
        regionCode: null,
        cfRay: null,
        userAgent: null,
      },
    )
  })
})

describe("sanitizeCustomerAccessInquiryForStaffResponse", () => {
  it("removes camelCase submission audit columns from inquiry payload", () => {
    const sanitized = sanitizeCustomerAccessInquiryForStaffResponse(sampleInquiry)
    assert.equal(inquiryResponseContainsSubmissionAuditFields(sanitized), false)
    assert.equal(sanitized.id, sampleInquiry.id)
  })

  it("removes snake_case submission audit columns from inquiry payload", () => {
    const sanitized = sanitizeCustomerAccessInquiryForStaffResponse({
      id: sampleInquiry.id,
      status: "CLOSED",
      submission_ip_address: "203.0.113.10",
      submission_ip_hash: "abc123hash",
      submission_ip_country: "US",
      submission_ip_city: "Austin",
      submission_ip_region: "Texas",
      submission_ip_region_code: "TX",
      submission_cf_ray: "ray-123",
      submission_user_agent: "FotocorpTest/1.0",
    })
    assert.equal(inquiryResponseContainsSubmissionAuditFields(sanitized), false)
    assert.equal(sanitized.status, "CLOSED")
  })
})

describe("serializeStaffInquiryMutationResponse", () => {
  it("returns sanitized inquiry payloads for mutation responses", () => {
    const serialized = serializeStaffInquiryMutationResponse(sampleInquiry)
    assert.equal(inquiryResponseContainsSubmissionAuditFields(serialized), false)
    assert.equal(serialized.createdAt, "2026-06-11T12:00:00.000Z")
    assert.equal(serialized.updatedAt, "2026-06-11T12:30:00.000Z")
  })
})

describe("staffRoleIncludesSubmissionIpAddress", () => {
  it("allows raw IP only for SUPER_ADMIN", () => {
    assert.equal(staffRoleIncludesSubmissionIpAddress("SUPER_ADMIN"), true)
    assert.equal(staffRoleIncludesSubmissionIpAddress("SUPPORT"), false)
    assert.equal(staffRoleIncludesSubmissionIpAddress("FINANCE"), false)
  })
})

describe("staff access inquiry response hardening", () => {
  it("keeps detail submissionAudit separate from sanitized inquiry object", () => {
    const detailInquiry = sanitizeCustomerAccessInquiryForStaffResponse(sampleInquiry)
    const submissionAudit = buildStaffSubmissionAuditResponse(sampleInquiry, { includeIpAddress: true })

    assert.equal(inquiryResponseContainsSubmissionAuditFields(detailInquiry), false)
    assert.equal(submissionAudit.ipAddress, "203.0.113.10")
  })

  it("does not expose raw IP through submissionAudit for non-SUPER_ADMIN", () => {
    const submissionAudit = buildStaffSubmissionAuditResponse(sampleInquiry, { includeIpAddress: false })
    assert.equal(submissionAudit.ipAddress, null)
  })
})
