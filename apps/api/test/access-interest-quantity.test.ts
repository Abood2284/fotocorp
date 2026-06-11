import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  RegistrationProfileValidationError,
  validateRegistrationProfileBody,
} from "../src/routes/auth/services/fotocorp-registration-profile"

describe("access interest quantity validation", () => {
  it("requires video quantity when Video is selected", async () => {
    await assert.rejects(
      validateRegistrationProfileBody({
        ...baseRegistrationProfile,
        interestedAssetTypes: ["VIDEO"],
      }),
      (error) =>
        error instanceof RegistrationProfileValidationError &&
        error.code === "MISSING_VIDEO_QUANTITY_RANGE",
    )
  })

  it("requires caricature quantity when Caricature is selected", async () => {
    await assert.rejects(
      validateRegistrationProfileBody({
        ...baseRegistrationProfile,
        interestedAssetTypes: ["CARICATURE"],
      }),
      (error) =>
        error instanceof RegistrationProfileValidationError &&
        error.code === "MISSING_CARICATURE_QUANTITY_RANGE",
    )
  })

  it("accepts video and caricature quantities without quality preferences", async () => {
    const profile = await validateRegistrationProfileBody({
      ...baseRegistrationProfile,
      interestedAssetTypes: ["VIDEO", "CARICATURE"],
      videoQuantityRange: "20_50",
      caricatureQuantityRange: "100-250",
    })

    assert.deepEqual(profile.interestedAssetTypes, ["VIDEO", "CARICATURE"])
    assert.equal(profile.videoQuantityRange, "20_50")
    assert.equal(profile.caricatureQuantityRange, "100_250")
    assert.equal(profile.imageQualityPreference, null)
    assert.equal(profile.royaltyFreeQualityPreference, null)
  })
})

const baseRegistrationProfile = {
  email: "buyer@example.com",
  firstName: "Buyer",
  lastName: "Person",
  username: "buyer.person",
  companyType: "agency",
  companyName: "Buyer Agency",
  jobTitle: "Editor",
  companyEmail: "buyer@example.com",
  phoneCountryCode: "+91",
  phoneNumber: "9876543210",
}
