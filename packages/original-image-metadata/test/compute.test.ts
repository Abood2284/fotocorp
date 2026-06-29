import assert from "node:assert/strict"
import { describe, it } from "node:test"
import sharp from "sharp"
import {
  computeDownloadQualityCeiling,
  computeMegapixels,
  computeOriginalImageMetadata,
  computeSourceQualityBucket,
  resolveDisplayDimensions,
  resolveEdges,
} from "../src/compute"

describe("original image metadata compute helpers", () => {
  it("swaps display dimensions for rotated orientations", () => {
    const result = resolveDisplayDimensions(4000, 3000, 6)
    assert.deepEqual(result, { displayWidth: 3000, displayHeight: 4000 })
  })

  it("computes long and short edges", () => {
    assert.deepEqual(resolveEdges(3000, 4000), { longEdge: 4000, shortEdge: 3000 })
  })

  it("assigns quality buckets from long edge thresholds", () => {
    assert.equal(computeSourceQualityBucket(1199), "LOW_SOURCE")
    assert.equal(computeSourceQualityBucket(2499), "STANDARD_SOURCE")
    assert.equal(computeSourceQualityBucket(3999), "HIGH_SOURCE")
    assert.equal(computeSourceQualityBucket(4000), "VERY_HIGH_SOURCE")
  })

  it("assigns download ceilings from long edge thresholds", () => {
    assert.equal(computeDownloadQualityCeiling(1599), "LOW")
    assert.equal(computeDownloadQualityCeiling(2499), "MEDIUM")
    assert.equal(computeDownloadQualityCeiling(2500), "HIGH")
  })

  it("formats megapixels with four decimal places", () => {
    assert.equal(computeMegapixels(4000, 2842), "11.3680")
  })

  it("extracts metadata from a generated jpeg buffer", async () => {
    const buffer = await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg({ quality: 90 })
      .withMetadata({ density: 300 })
      .toBuffer()

    const computed = await computeOriginalImageMetadata({
      imageAssetId: "11111111-1111-4111-8111-111111111111",
      buffer,
    })

    assert.equal(computed.metadataScanStatus, "SUCCESS")
    assert.equal(computed.displayWidth, 2400)
    assert.equal(computed.displayHeight, 1600)
    assert.equal(computed.originalLongEdge, 2400)
    assert.equal(computed.originalDpi, 300)
    assert.equal(computed.canGenerateMedium, true)
    assert.equal(computed.canGenerateLow, true)
    assert.equal(computed.downloadQualityCeiling, "MEDIUM")
  })
})
