import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildHelpMediaStorageKey,
  extensionFromHelpMediaFileNameAndMime,
  resolveHelpMediaType,
  sanitizeHelpMediaFilename,
} from "../src/lib/help-center/help-media-storage-key"
import { validateHelpMediaUploadIntent } from "../src/lib/help-center/help-media-service"
import { HELP_IMAGE_MAX_BYTES, HELP_VIDEO_MAX_BYTES } from "../src/lib/help-center/constants"

describe("help media storage keys", () => {
  it("builds namespaced storage keys with sanitized filenames", () => {
    const key = buildHelpMediaStorageKey(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "Caption Editor.PNG",
      "image/png",
    )
    assert.match(key, /^help-media\/articles\/.+\/.+\/Caption-Editor\.png$/)
  })

  it("resolves supported image and video mime types", () => {
    assert.equal(resolveHelpMediaType("image/png"), "IMAGE")
    assert.equal(resolveHelpMediaType("video/mp4"), "VIDEO")
    assert.equal(resolveHelpMediaType("image/svg+xml"), null)
  })

  it("rejects extension and mime mismatches", () => {
    assert.equal(extensionFromHelpMediaFileNameAndMime("clip.mov", "video/mp4"), null)
    assert.equal(sanitizeHelpMediaFilename("../../evil/name.png"), "name.png")
  })
})

describe("help media upload validation", () => {
  it("accepts supported image uploads under size limits", () => {
    assert.doesNotThrow(() =>
      validateHelpMediaUploadIntent({
        filename: "caption-editor.png",
        mimeType: "image/png",
        fileSizeBytes: 1024,
        mediaType: "IMAGE",
      }),
    )
  })

  it("rejects unsupported mime types", () => {
    assert.throws(
      () =>
        validateHelpMediaUploadIntent({
          filename: "notes.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 1024,
          mediaType: "IMAGE",
        }),
      (error: Error) => error.message.includes("PNG, JPG, WEBP, MP4, and WEBM"),
    )
  })

  it("rejects oversized image uploads", () => {
    assert.throws(
      () =>
        validateHelpMediaUploadIntent({
          filename: "large.png",
          mimeType: "image/png",
          fileSizeBytes: HELP_IMAGE_MAX_BYTES + 1,
          mediaType: "IMAGE",
        }),
      (error: Error) => error.message.includes("10 MB"),
    )
  })

  it("rejects oversized video uploads", () => {
    assert.throws(
      () =>
        validateHelpMediaUploadIntent({
          filename: "large.mp4",
          mimeType: "video/mp4",
          fileSizeBytes: HELP_VIDEO_MAX_BYTES + 1,
          mediaType: "VIDEO",
        }),
      (error: Error) => error.message.includes("100 MB"),
    )
  })
})
