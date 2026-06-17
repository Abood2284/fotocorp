import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { StaffContributorUploadDto } from "../src/lib/api/staff-contributor-uploads-api"
import {
  getStaffContributorUploadOriginalUrl,
  staffUploadItemToTrackedFile,
  staffUploadItemsToTrackedFiles,
  trackedFilesToStaffUploadPatches,
} from "../src/lib/staff-contributor-upload-metadata"

function mockStaffItem(patch: Partial<StaffContributorUploadDto> = {}): StaffContributorUploadDto {
  return {
    imageAssetId: "asset-1",
    uploadItemId: "item-1",
    batchId: "batch-1",
    originalFileName: "photo.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    status: "SUBMITTED",
    visibility: "PRIVATE",
    source: "FOTOCORP",
    assetType: "IMAGE",
    fotokey: null,
    whoIsInPicture: "Person",
    caption: "Caption",
    keywords: "one, two",
    contributor: { id: "c-1", legacyPhotographerId: null, displayName: "Photographer" },
    event: { id: "e-1", name: "Event Title", eventDate: null, city: null, location: null },
    batch: { id: "batch-1", status: "SUBMITTED", submittedAt: null },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    canApprove: true,
    ...patch,
  }
}

describe("staff contributor upload metadata helpers", () => {
  it("maps approvable staff items to done tracked rows", () => {
    const tracked = staffUploadItemsToTrackedFiles([
      mockStaffItem(),
      mockStaffItem({ imageAssetId: "asset-2", originalFileName: "other.jpg", canApprove: false }),
    ])

    assert.equal(tracked.length, 1)
    assert.equal(tracked[0]?.fileName, "photo.jpg")
    assert.equal(tracked[0]?.status, "done")
    assert.equal(tracked[0]?.imageAssetId, "asset-1")
  })

  it("builds preview URLs from staff original route", () => {
    const row = staffUploadItemToTrackedFile(mockStaffItem())
    assert.match(row.previewUrl ?? "", new RegExp(`^${getStaffContributorUploadOriginalUrl("asset-1")}\\?v=`))
  })

  it("converts tracked rows back to staff upload patches", () => {
    const tracked = staffUploadItemsToTrackedFiles([mockStaffItem()])
    const patches = trackedFilesToStaffUploadPatches(tracked)

    assert.deepEqual(patches["asset-1"], {
      whoIsInPicture: "Person",
      caption: "Caption",
      keywords: "one, two",
      updatedAt: "2026-01-02T00:00:00.000Z",
    })
  })
})
