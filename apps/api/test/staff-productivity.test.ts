import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getContributorUploadChangedFields } from "../src/routes/internal/admin-contributor-uploads/service"
import { staffProductivityQuerySchema } from "../src/routes/staff/productivity/validators"

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
