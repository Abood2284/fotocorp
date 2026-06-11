import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildAccessInquiryDetailGroups } from "../src/lib/staff/access-inquiry-labels"

describe("access inquiry preference labels", () => {
  it("renders video and caricature as quantity-only preferences", () => {
    const groups = buildAccessInquiryDetailGroups({
      inquiry: {
        interestedAssetTypes: ["VIDEO", "CARICATURE"],
        videoQuantityRange: "20_50",
        caricatureQuantityRange: "100_250",
      },
      profile: {},
    })

    const preferences = groups.find((group) => group.id === "preferences")

    assert.ok(preferences)
    assert.equal(preferences.fields.find((field) => field.label === "Video")?.value, "20–50")
    assert.equal(preferences.fields.find((field) => field.label === "Caricature")?.value, "100–250")
    assert.equal(preferences.fields.some((field) => field.value.includes("High")), false)
  })
})
