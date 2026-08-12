import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertContributorAllowsBatchAssetType,
  assertContributorAllowsUploadType,
  normalizeAllowedUploadTypes,
  parseRequiredAllowedUploadTypes,
  uploadBatchAssetTypeToAllowed,
} from "../src/lib/contributors/allowed-upload-types"
import { AppError } from "../src/lib/errors"

describe("contributor allowed upload types", () => {
  it("normalizes empty or invalid values to Editorial", () => {
    assert.deepEqual(normalizeAllowedUploadTypes(null), ["EDITORIAL"])
    assert.deepEqual(normalizeAllowedUploadTypes([]), ["EDITORIAL"])
    assert.deepEqual(normalizeAllowedUploadTypes(["VIDEO"]), ["EDITORIAL"])
  })

  it("keeps unique ordered Editorial and Caricature values", () => {
    assert.deepEqual(normalizeAllowedUploadTypes(["CARICATURE", "EDITORIAL", "CARICATURE"]), [
      "EDITORIAL",
      "CARICATURE",
    ])
  })

  it("requires at least one valid upload type", () => {
    assert.throws(() => parseRequiredAllowedUploadTypes([]), (error: unknown) => {
      return error instanceof AppError && error.code === "UPLOAD_TYPES_REQUIRED"
    })
  })

  it("maps batch asset types to allowed upload types", () => {
    assert.equal(uploadBatchAssetTypeToAllowed("IMAGE"), "EDITORIAL")
    assert.equal(uploadBatchAssetTypeToAllowed("CARICATURE"), "CARICATURE")
    assert.equal(uploadBatchAssetTypeToAllowed("VIDEO"), null)
  })

  it("enforces allowed upload types", () => {
    assert.doesNotThrow(() => assertContributorAllowsUploadType(["EDITORIAL"], "EDITORIAL"))
    assert.throws(() => assertContributorAllowsUploadType(["EDITORIAL"], "CARICATURE"), (error: unknown) => {
      return error instanceof AppError && error.code === "UPLOAD_TYPE_NOT_ALLOWED"
    })
    assert.throws(() => assertContributorAllowsBatchAssetType(["CARICATURE"], "IMAGE"), (error: unknown) => {
      return error instanceof AppError && error.code === "UPLOAD_TYPE_NOT_ALLOWED"
    })
  })
})
