import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildSubmissionAuditDisplayRows,
  formatSubmissionAuditValue,
} from "../src/lib/staff/submission-audit-display"

describe("submission audit display", () => {
  it("renders audit values and includes raw IP only when present", () => {
    const rows = buildSubmissionAuditDisplayRows({
      country: "US",
      city: "Austin",
      region: "Texas",
      regionCode: "TX",
      ipHash: "abc123hash",
      ipAddress: "203.0.113.10",
      cfRay: "ray-123",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    })

    assert.deepEqual(
      rows.map((row) => row.label),
      ["Country", "City", "Region", "Region code", "IP hash", "Raw IP", "CF-Ray", "User agent"],
    )
    assert.equal(rows.find((row) => row.label === "Raw IP")?.value, "203.0.113.10")
  })

  it("does not render raw IP row when ipAddress is null", () => {
    const rows = buildSubmissionAuditDisplayRows({
      country: "US",
      ipAddress: null,
      ipHash: "abc123hash",
    })

    assert.equal(rows.some((row) => row.label === "Raw IP"), false)
  })

  it("renders null values as em dash", () => {
    assert.equal(formatSubmissionAuditValue(null), "—")
    assert.equal(formatSubmissionAuditValue("   "), "—")
    assert.equal(formatSubmissionAuditValue("Austin"), "Austin")
  })

  it("preserves long user agent text", () => {
    const userAgent = "Mozilla/5.0 ".repeat(20).trim()
    const row = buildSubmissionAuditDisplayRows({ userAgent }).find((item) => item.label === "User agent")
    assert.equal(row?.value, userAgent)
  })
})
