import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { describe, it } from "node:test"
import { getRequestAuditContext } from "../src/lib/request-audit-context"

function createRequest(
  headers: Record<string, string> = {},
  cf?: Record<string, string>,
): Request {
  const request = new Request("https://example.com", { headers })
  if (cf) {
    Object.defineProperty(request, "cf", { value: cf })
  }
  return request
}

describe("getRequestAuditContext (api)", () => {
  it("extracts CF-Connecting-IP", () => {
    const context = getRequestAuditContext(
      createRequest({ "CF-Connecting-IP": " 203.0.113.10 " }),
    )
    assert.equal(context.ipAddress, "203.0.113.10")
  })

  it("falls back to the first X-Forwarded-For IP", () => {
    const context = getRequestAuditContext(
      createRequest({ "X-Forwarded-For": "198.51.100.2, 10.0.0.1" }),
    )
    assert.equal(context.ipAddress, "198.51.100.2")
  })

  it("returns null IP when no IP headers are present", () => {
    const context = getRequestAuditContext(createRequest())
    assert.equal(context.ipAddress, null)
  })

  it("extracts User-Agent", () => {
    const context = getRequestAuditContext(
      createRequest({ "User-Agent": "FotocorpTest/1.0" }),
    )
    assert.equal(context.userAgent, "FotocorpTest/1.0")
  })

  it("extracts CF-Ray", () => {
    const context = getRequestAuditContext(
      createRequest({ "CF-Ray": "abc123-SIN" }),
    )
    assert.equal(context.cfRay, "abc123-SIN")
  })

  it("extracts geo from request.cf", () => {
    const context = getRequestAuditContext(
      createRequest({}, {
        country: "sg",
        city: "Singapore",
        region: "Singapore",
        regionCode: "01",
      }),
    )
    assert.equal(context.country, "SG")
    assert.equal(context.city, "Singapore")
    assert.equal(context.region, "Singapore")
    assert.equal(context.regionCode, "01")
  })

  it("falls back to Cloudflare visitor location headers", () => {
    const context = getRequestAuditContext(
      createRequest({
        "CF-IPCountry": "us",
        "CF-IPCity": "Austin",
        "CF-Region": "Texas",
        "CF-Region-Code": "TX",
      }),
    )
    assert.equal(context.country, "US")
    assert.equal(context.city, "Austin")
    assert.equal(context.region, "Texas")
    assert.equal(context.regionCode, "TX")
  })

  it("normalizes empty strings to null", () => {
    const context = getRequestAuditContext(
      createRequest({
        "CF-Connecting-IP": "   ",
        "User-Agent": "",
        "CF-Ray": "  ",
        "CF-IPCountry": " ",
      }),
    )
    assert.equal(context.ipAddress, null)
    assert.equal(context.userAgent, null)
    assert.equal(context.cfRay, null)
    assert.equal(context.country, null)
  })

  it("uppercases country values", () => {
    const context = getRequestAuditContext(
      createRequest({ "CF-IPCountry": "gb" }),
    )
    assert.equal(context.country, "GB")
  })

  it("returns null ipHash when secret is missing", () => {
    const context = getRequestAuditContext(
      createRequest({ "CF-Connecting-IP": "203.0.113.10" }),
    )
    assert.equal(context.ipHash, null)
  })

  it("hashes IP when IP and secret are present", () => {
    const ipAddress = "203.0.113.10"
    const secret = "audit-secret"
    const expected = createHash("sha256")
      .update(`${ipAddress}:${secret}`)
      .digest("hex")

    const context = getRequestAuditContext(
      createRequest({ "CF-Connecting-IP": ipAddress }),
      { ipHashSecret: secret },
    )
    assert.equal(context.ipHash, expected)
  })

  it("does not throw when request.cf is absent", () => {
    assert.doesNotThrow(() => {
      getRequestAuditContext(createRequest({ "CF-IPCountry": "US" }))
    })
  })
})
