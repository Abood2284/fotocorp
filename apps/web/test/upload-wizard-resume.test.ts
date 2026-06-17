import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildResumeStateFromBatchDetail,
  deriveWizardStepFromBatch,
  getTrackedDisplayName,
  mapBatchItemToTrackedFile,
} from "../src/lib/upload-wizard-resume"

describe("upload wizard resume helpers", () => {
  it("maps ASSET_CREATED batch items to done tracked rows", () => {
    const row = mapBatchItemToTrackedFile(
      {
        id: "item-1",
        fileName: "photo.jpg",
        uploadStatus: "ASSET_CREATED",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
        imageAssetId: "asset-1",
        whoIsInPicture: "Actor",
        caption: "Caption",
        keywords: "tag",
        assetUpdatedAt: "2026-06-12T10:00:00.000Z",
        failureCode: null,
        failureMessage: null,
      },
      "contributor",
    )

    assert.ok(row)
    assert.equal(row?.status, "done")
    assert.equal(row?.file, null)
    assert.equal(row?.fileName, "photo.jpg")
    assert.equal(row?.caption, "Caption")
    assert.equal(row?.previewUrl, "/api/contributor/images/asset-1/preview/card")
  })

  it("derives metadata step when uploaded assets exist", () => {
    const result = deriveWizardStepFromBatch(
      [{ uploadStatus: "ASSET_CREATED" }, { uploadStatus: "FAILED" }],
      "OPEN",
    )

    assert.equal(result.currentStep, 4)
    assert.deepEqual([...result.completedSteps].sort(), [1, 2, 3])
  })

  it("builds resume state from batch detail", () => {
    const resume = buildResumeStateFromBatchDetail(
      {
        batch: { id: "batch-1", eventId: "event-1", status: "OPEN", assetType: "IMAGE" },
        event: { id: "event-1", name: "Premiere" },
        contributor: { id: "contributor-1", displayName: "Photographer" },
        items: [
          {
            id: "item-1",
            fileName: "a.jpg",
            uploadStatus: "ASSET_CREATED",
            mimeType: "image/jpeg",
            sizeBytes: 100,
            imageAssetId: "asset-1",
            whoIsInPicture: null,
            caption: "One",
            keywords: null,
            assetUpdatedAt: null,
            failureCode: null,
            failureMessage: null,
          },
        ],
      },
      "staff",
    )

    assert.equal(resume.batchId, "batch-1")
    assert.equal(resume.currentStep, 4)
    assert.equal(resume.batchAssetType, "IMAGE")
    assert.equal(resume.tracked.length, 1)
    assert.equal(resume.targetContributorId, "contributor-1")
    assert.equal(getTrackedDisplayName(resume.tracked[0]!), "a.jpg")
  })
})
