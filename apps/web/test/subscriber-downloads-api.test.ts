import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildSubscriberDownloadRequestBody } from "../src/lib/api/subscriber-download-request-body"

describe("buildSubscriberDownloadRequestBody", () => {
  it("forwards requestAudit for actual download calls", () => {
    const body = buildSubscriberDownloadRequestBody({
      authUserId: "user-123",
      size: "large",
      requestAudit: {
        ipAddress: "203.0.113.10",
        ipHash: "hash-value",
        country: "US",
        city: "Austin",
        region: "Texas",
        regionCode: "TX",
        cfRay: "ray-123",
        userAgent: "Browser/1.0",
      },
    })

    assert.deepEqual(body, {
      authUserId: "user-123",
      size: "large",
      userAgent: "Browser/1.0",
      requestIp: "203.0.113.10",
      requestAudit: {
        ipAddress: "203.0.113.10",
        ipHash: "hash-value",
        country: "US",
        city: "Austin",
        region: "Texas",
        regionCode: "TX",
        cfRay: "ray-123",
        userAgent: "Browser/1.0",
      },
    })
  })

  it("keeps legacy requestIp and userAgent when requestAudit is omitted", () => {
    const body = buildSubscriberDownloadRequestBody({
      authUserId: "user-123",
      size: "web",
      userAgent: "LegacyAgent/1.0",
      requestIp: "198.51.100.2",
    })

    assert.deepEqual(body, {
      authUserId: "user-123",
      size: "web",
      userAgent: "LegacyAgent/1.0",
      requestIp: "198.51.100.2",
      requestAudit: undefined,
    })
  })

  it("prefers requestAudit values over legacy fields", () => {
    const body = buildSubscriberDownloadRequestBody({
      authUserId: "user-123",
      size: "medium",
      userAgent: "LegacyAgent/1.0",
      requestIp: "198.51.100.2",
      requestAudit: {
        ipAddress: "203.0.113.10",
        userAgent: "AuditAgent/1.0",
      },
    })

    assert.equal(body.requestIp, "203.0.113.10")
    assert.equal(body.userAgent, "AuditAgent/1.0")
  })
})
