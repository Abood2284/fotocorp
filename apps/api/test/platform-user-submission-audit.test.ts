import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { describe, it } from "node:test"
import { buildCustomerAccessInquirySubmissionAuditFields } from "../src/lib/access-inquiries/submission-audit-fields"
import { getRequestAuditContext } from "../src/lib/request-audit-context"

const sampleRequestAudit = {
  ipAddress: "203.0.113.10",
  ipHash: "abc123hash",
  country: "US",
  city: "Austin",
  region: "Texas",
  regionCode: "TX",
  cfRay: "ray-123",
  userAgent: "FotocorpTest/1.0",
}

const expectedSubmissionFields = {
  submissionIpAddress: "203.0.113.10",
  submissionIpHash: "abc123hash",
  submissionIpCountry: "US",
  submissionIpCity: "Austin",
  submissionIpRegion: "Texas",
  submissionIpRegionCode: "TX",
  submissionCfRay: "ray-123",
  submissionUserAgent: "FotocorpTest/1.0",
}

const nullSubmissionFields = {
  submissionIpAddress: null,
  submissionIpHash: null,
  submissionIpCountry: null,
  submissionIpCity: null,
  submissionIpRegion: null,
  submissionIpRegionCode: null,
  submissionCfRay: null,
  submissionUserAgent: null,
}

describe("customer access inquiry submission audit", () => {
  it("maps request audit context into inquiry submission fields", () => {
    assert.deepEqual(buildCustomerAccessInquirySubmissionAuditFields(sampleRequestAudit), expectedSubmissionFields)
  })

  it("returns null submission audit fields when context is omitted", () => {
    assert.deepEqual(buildCustomerAccessInquirySubmissionAuditFields(), nullSubmissionFields)
  })

  it("returns null ipHash when IP_HASH_SECRET is missing during sign-up capture", () => {
    const request = new Request("https://example.com", {
      headers: {
        "CF-Connecting-IP": "203.0.113.10",
        "User-Agent": "FotocorpTest/1.0",
        "CF-IPCountry": "us",
      },
    })

    const requestAudit = getRequestAuditContext(request)
    const fields = buildCustomerAccessInquirySubmissionAuditFields(requestAudit)

    assert.equal(fields.submissionIpAddress, "203.0.113.10")
    assert.equal(fields.submissionIpHash, null)
    assert.equal(fields.submissionIpCountry, "US")
    assert.equal(fields.submissionUserAgent, "FotocorpTest/1.0")
  })

  it("hashes ip when IP_HASH_SECRET is provided during sign-up capture", () => {
    const ipAddress = "203.0.113.10"
    const secret = "audit-secret"
    const request = new Request("https://example.com", {
      headers: { "CF-Connecting-IP": ipAddress },
    })

    const requestAudit = getRequestAuditContext(request, { ipHashSecret: secret })
    const fields = buildCustomerAccessInquirySubmissionAuditFields(requestAudit)

    assert.equal(
      fields.submissionIpHash,
      createHash("sha256").update(`${ipAddress}:${secret}`).digest("hex"),
    )
  })
})

describe("contributor application submission audit", () => {
  it("maps request audit context into contributor inquiry submission fields", () => {
    assert.deepEqual(buildCustomerAccessInquirySubmissionAuditFields(sampleRequestAudit), expectedSubmissionFields)
  })

  it("returns null submission audit fields when contributor audit context is omitted", () => {
    assert.deepEqual(buildCustomerAccessInquirySubmissionAuditFields(undefined), nullSubmissionFields)
  })

  it("returns null ipHash when IP_HASH_SECRET is missing during contributor application capture", () => {
    const request = new Request("https://example.com", {
      headers: {
        "CF-Connecting-IP": "198.51.100.2",
        "User-Agent": "ContributorApply/2.0",
        "CF-IPCountry": "gb",
      },
    })

    const requestAudit = getRequestAuditContext(request)
    const fields = buildCustomerAccessInquirySubmissionAuditFields(requestAudit)

    assert.equal(fields.submissionIpAddress, "198.51.100.2")
    assert.equal(fields.submissionIpHash, null)
    assert.equal(fields.submissionIpCountry, "GB")
    assert.equal(fields.submissionUserAgent, "ContributorApply/2.0")
  })

  it("does not map request geo into contributor profile field names", () => {
    const fields = buildCustomerAccessInquirySubmissionAuditFields(sampleRequestAudit)

    assert.equal("city" in fields, false)
    assert.equal("country" in fields, false)
    assert.equal("stateRegion" in fields, false)
    assert.equal(fields.submissionIpCity, "Austin")
    assert.equal(fields.submissionIpCountry, "US")
  })
})
