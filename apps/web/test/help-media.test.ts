import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getHelpMediaDisplayUrl } from "../src/lib/staff/help-media"
import { validateHelpMediaFile } from "../src/lib/staff/help-media-validation"

describe("help media web helpers", () => {
  it("builds same-origin media display URLs", () => {
    assert.equal(
      getHelpMediaDisplayUrl("22222222-2222-4222-8222-222222222222"),
      "/api/staff/help/media/22222222-2222-4222-8222-222222222222",
    )
  })

  it("accepts supported image and video mime types", () => {
    assert.deepEqual(validateHelpMediaFile({ type: "image/png", size: 1024, name: "a.png" } as File), {
      ok: true,
      mediaType: "IMAGE",
    })
    assert.deepEqual(validateHelpMediaFile({ type: "video/mp4", size: 1024, name: "a.mp4" } as File), {
      ok: true,
      mediaType: "VIDEO",
    })
  })

  it("rejects unsupported file types", () => {
    const result = validateHelpMediaFile({ type: "application/pdf", size: 1024, name: "a.pdf" } as File)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.message, /PNG, JPG, WEBP, MP4, and WEBM/)
  })

  it("rejects oversized image files", () => {
    const result = validateHelpMediaFile({ type: "image/png", size: 11 * 1024 * 1024, name: "a.png" } as File)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.message, /10 MB/)
  })
})
