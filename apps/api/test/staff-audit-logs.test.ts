import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildAuditSummary, sanitizeAuditMetadata } from "../src/routes/staff/audit-logs/sanitize"

// Regression: neon-http returns created_at as string from raw SQL
function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value)
}
import {
  decodeStaffAuditLogCursor,
  encodeStaffAuditLogCursor,
  listStaffAuditLogsQuerySchema,
} from "../src/routes/staff/audit-logs/validators"

describe("staff audit logs validators", () => {
  it("accepts bounded list query params", () => {
    const parsed = listStaffAuditLogsQuerySchema.safeParse({
      source: "asset",
      action: "ASSET_METADATA_UPDATED",
      limit: "25",
    })
    assert.equal(parsed.success, true)
    if (parsed.success) {
      assert.equal(parsed.data.source, "asset")
      assert.equal(parsed.data.limit, 25)
    }
  })

  it("rejects limits above 100", () => {
    const parsed = listStaffAuditLogsQuerySchema.safeParse({ limit: "200" })
    assert.equal(parsed.success, false)
  })

  it("round-trips cursor encoding", () => {
    const cursor = {
      createdAt: "2026-06-11T12:00:00.000Z",
      source: "staff" as const,
      id: "11111111-1111-4111-8111-111111111111",
    }
    const encoded = encodeStaffAuditLogCursor(cursor)
    assert.deepEqual(decodeStaffAuditLogCursor(encoded), cursor)
  })
})

describe("staff audit logs date serialization", () => {
  it("accepts string timestamps from raw SQL rows", () => {
    assert.equal(toIso("2026-06-11T12:00:00.000Z"), "2026-06-11T12:00:00.000Z")
    assert.equal(toIso(new Date("2026-06-11T12:00:00.000Z")), "2026-06-11T12:00:00.000Z")
  })
})

describe("staff audit logs sanitize", () => {
  it("removes unsafe storage and secret fields", () => {
    const sanitized = sanitizeAuditMetadata({
      username: "caption.writer",
      original_storage_key: "staging/secret/key",
      password: "hidden",
      nested: {
        storage_key: "previews/watermarked/card/FC010126001.webp",
        status: "ACTIVE",
      },
    })

    assert.deepEqual(sanitized, {
      username: "caption.writer",
      nested: { status: "ACTIVE" },
    })
  })

  it("builds readable staff and asset summaries", () => {
    assert.equal(
      buildAuditSummary("staff", "STAFF_MEMBER_STATUS_UPDATED", {
        previousStatus: "ACTIVE",
        nextStatus: "DISABLED",
      }),
      "Status ACTIVE → DISABLED",
    )

    assert.equal(
      buildAuditSummary("asset", "ASSET_METADATA_UPDATED", {
        before: { caption: "Old" },
        after: { caption: "New" },
      }),
      "Updated caption",
    )
  })
})
