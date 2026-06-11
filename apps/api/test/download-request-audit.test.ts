import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { describe, it } from "node:test"
import { normalizeDownloadRequestAudit } from "../src/lib/downloads/download-request-audit"

describe("normalizeDownloadRequestAudit", () => {
  it("prefers requestAudit fields over legacy requestIp and userAgent", () => {
    const audit = normalizeDownloadRequestAudit({
      requestAudit: {
        ipAddress: "203.0.113.10",
        ipHash: "provided-hash",
        country: "us",
        city: "Austin",
        region: "Texas",
        regionCode: "TX",
        cfRay: "ray-123",
        userAgent: "AuditAgent/1.0",
      },
      requestIp: "198.51.100.2",
      userAgent: "LegacyAgent/1.0",
    })

    assert.deepEqual(audit, {
      ipAddress: "203.0.113.10",
      ipHash: "provided-hash",
      country: "US",
      city: "Austin",
      region: "Texas",
      regionCode: "TX",
      cfRay: "ray-123",
      userAgent: "AuditAgent/1.0",
    })
  })

  it("falls back to legacy requestIp and userAgent", () => {
    const audit = normalizeDownloadRequestAudit({
      requestIp: "198.51.100.2",
      userAgent: "LegacyAgent/1.0",
    })

    assert.equal(audit.ipAddress, "198.51.100.2")
    assert.equal(audit.userAgent, "LegacyAgent/1.0")
    assert.equal(audit.ipHash, null)
    assert.equal(audit.country, null)
  })

  it("generates salted ipHash from ipAddress and secret when hash is missing", () => {
    const ipAddress = "203.0.113.10"
    const secret = "audit-secret"
    const audit = normalizeDownloadRequestAudit({
      requestAudit: { ipAddress },
      ipHashSecret: secret,
    })

    assert.equal(
      audit.ipHash,
      createHash("sha256").update(`${ipAddress}:${secret}`).digest("hex"),
    )
  })

  it("returns null audit fields when context is missing", () => {
    assert.deepEqual(normalizeDownloadRequestAudit({}), {
      ipAddress: null,
      ipHash: null,
      country: null,
      city: null,
      region: null,
      regionCode: null,
      cfRay: null,
      userAgent: null,
    })
  })

  it("normalizes empty strings to null", () => {
    const audit = normalizeDownloadRequestAudit({
      requestAudit: {
        ipAddress: "   ",
        country: "",
        userAgent: " ",
      },
    })

    assert.equal(audit.ipAddress, null)
    assert.equal(audit.country, null)
    assert.equal(audit.userAgent, null)
  })
})
