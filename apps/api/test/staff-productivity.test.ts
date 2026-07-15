import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildFieldDeltas } from "../src/lib/audit/asset-admin-audit-log"
import { getContributorUploadChangedFields } from "../src/routes/internal/admin-contributor-uploads/service"
import {
  STAFF_PRODUCTIVITY_DEFINITIONS,
} from "../src/routes/staff/productivity/service"
import {
  decodeStaffProductivityActivityCursor,
  encodeStaffProductivityActivityCursor,
  staffProductivityActivityQuerySchema,
  staffProductivityMemberParamSchema,
  staffProductivityQuerySchema,
} from "../src/routes/staff/productivity/validators"

describe("staff productivity query", () => {
  it("accepts optional ISO date range filters", () => {
    const parsed = staffProductivityQuerySchema.safeParse({
      from: "2026-06-13T00:00:00.000Z",
      to: "2026-06-13T23:59:59.999Z",
    })

    assert.equal(parsed.success, true)
  })

  it("rejects date-only filters because the API expects explicit instants", () => {
    const parsed = staffProductivityQuerySchema.safeParse({ from: "2026-06-13" })

    assert.equal(parsed.success, false)
  })
})

describe("staff productivity detail validators", () => {
  it("requires a staff member uuid", () => {
    const ok = staffProductivityMemberParamSchema.safeParse({
      staffMemberId: "30d94c5c-4d65-483f-b8b6-dcd246827a77",
    })
    const bad = staffProductivityMemberParamSchema.safeParse({ staffMemberId: "akbar" })
    assert.equal(ok.success, true)
    assert.equal(bad.success, false)
  })

  it("round-trips activity cursors", () => {
    const encoded = encodeStaffProductivityActivityCursor({
      createdAt: "2026-07-13T16:13:29.229Z",
      id: "abc",
    })
    const decoded = decodeStaffProductivityActivityCursor(encoded)
    assert.deepEqual(decoded, {
      createdAt: "2026-07-13T16:13:29.229Z",
      id: "abc",
    })
  })

  it("defaults activity limit and accepts cursor", () => {
    const parsed = staffProductivityActivityQuerySchema.safeParse({
      from: "2026-07-01T00:00:00.000Z",
      limit: "25",
      cursor: "abc",
    })
    assert.equal(parsed.success, true)
    if (parsed.success) assert.equal(parsed.data.limit, 25)
  })
})

describe("staff productivity definitions", () => {
  it("documents assets-touched as the primary KPI", () => {
    assert.match(STAFF_PRODUCTIVITY_DEFINITIONS.uniqueAssetsTouched, /primary KPI/i)
    assert.match(STAFF_PRODUCTIVITY_DEFINITIONS.fieldSaves, /who-is-in-picture/i)
  })
})

describe("asset admin audit field deltas", () => {
  it("returns only fields that changed", () => {
    const { before, after } = buildFieldDeltas(
      {
        who_is_in_picture: "A",
        caption: "Old caption",
        keywords: "news",
      },
      {
        who_is_in_picture: "A",
        caption: "New caption",
        keywords: "news",
      },
    )

    assert.deepEqual(before, { caption: "Old caption" })
    assert.deepEqual(after, { caption: "New caption" })
  })

  it("returns empty deltas when nothing changed", () => {
    const { before, after } = buildFieldDeltas(
      { caption: "Same", who_is_in_picture: null },
      { caption: "Same", who_is_in_picture: null },
    )

    assert.deepEqual(before, {})
    assert.deepEqual(after, {})
  })
})

describe("contributor upload metadata audit fields", () => {
  it("returns only fields whose normalized values actually changed", () => {
    const changedFields = getContributorUploadChangedFields(
      {
        whoIsInPicture: "Existing people",
        caption: "Existing caption",
        keywords: "news, delhi",
      },
      {
        whoIsInPicture: "Existing people",
        caption: "Updated caption",
        keywords: "news, delhi",
      },
    )

    assert.deepEqual(changedFields, ["caption"])
  })

  it("returns an empty list when the save is effectively unchanged", () => {
    const changedFields = getContributorUploadChangedFields(
      {
        whoIsInPicture: "Existing people",
        caption: "Existing caption",
        keywords: null,
      },
      {
        whoIsInPicture: "Existing people",
        caption: "Existing caption",
        keywords: null,
      },
    )

    assert.deepEqual(changedFields, [])
  })
})
