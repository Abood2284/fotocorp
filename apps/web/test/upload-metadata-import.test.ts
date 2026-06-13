import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { TrackedFile } from "../src/components/contributor/contributor-upload-types"
import {
  applyImportedMetadataToTracked,
  buildMetadataImportMatches,
  detectDuplicateImageCodes,
  getBaseName,
  normalizeColumnHeader,
  normalizeFileName,
  type ImportedMetadataRow,
} from "../src/lib/contributor-upload-metadata-import"

function mockTracked(fileName: string, patch: Partial<TrackedFile> = {}): TrackedFile {
  return {
    key: `key-${fileName}`,
    file: { name: fileName } as File,
    fileName,
    sizeBytes: 1024,
    status: "done",
    errorMessage: null,
    itemId: "item-1",
    imageAssetId: "asset-1",
    instruction: null,
    uploadProgress: null,
    previewUrl: null,
    whoIsInPicture: "",
    caption: "",
    keywords: "",
    assetUpdatedAt: null,
    saveState: "idle",
    saveHint: null,
    ...patch,
  }
}

describe("upload metadata import helpers", () => {
  it("normalizes column headers", () => {
    assert.equal(normalizeColumnHeader(" Image Codes "), "image_codes")
    assert.equal(normalizeColumnHeader("Who Is In Picture"), "who_is_in_picture")
    assert.equal(normalizeColumnHeader("who-is-in-picture"), "who_is_in_picture")
  })

  it("splits comma-separated image codes from imported rows", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["b1.jpg", "b8.jpg"],
        caption: "Caption",
        keywords: "one, two",
        whoIsInPicture: "Actor",
      },
    ]

    const tracked = [mockTracked("b1.jpg"), mockTracked("b8.jpg")]
    const { matches } = buildMetadataImportMatches(rows, tracked)

    assert.equal(matches.length, 2)
    assert.equal(matches[0]?.fileName, "b1.jpg")
    assert.equal(matches[1]?.fileName, "b8.jpg")
    assert.equal(typeof matches[0]?.keywords, "string")
    assert.equal(typeof matches[0]?.whoIsInPicture, "string")
  })

  it("matches filenames exactly before basename fallback", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["photo.jpg"],
        caption: "Exact",
        keywords: "",
        whoIsInPicture: "",
      },
    ]

    const { matches, notFoundCodes } = buildMetadataImportMatches(rows, [mockTracked("photo.jpg")])
    assert.equal(matches.length, 1)
    assert.equal(notFoundCodes.length, 0)
  })

  it("falls back to basename matching without extension", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["photo"],
        caption: "Basename",
        keywords: "",
        whoIsInPicture: "",
      },
    ]

    const { matches } = buildMetadataImportMatches(rows, [mockTracked("Photo.JPG")])
    assert.equal(matches.length, 1)
    assert.equal(matches[0]?.caption, "Basename")
  })

  it("reports ambiguous basename matches", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["photo"],
        caption: "Ambiguous",
        keywords: "",
        whoIsInPicture: "",
      },
    ]

    const { matches, ambiguousCodes } = buildMetadataImportMatches(rows, [
      mockTracked("photo.jpg"),
      mockTracked("photo.png"),
    ])

    assert.equal(matches.length, 0)
    assert.equal(ambiguousCodes.length, 1)
    assert.deepEqual(ambiguousCodes[0]?.matchedFileNames.sort(), ["photo.jpg", "photo.png"])
  })

  it("detects duplicate image codes across rows", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["b1.jpg"],
        caption: "",
        keywords: "",
        whoIsInPicture: "",
      },
      {
        sourceRowNumber: 3,
        imageCodes: ["B1.JPG"],
        caption: "",
        keywords: "",
        whoIsInPicture: "",
      },
    ]

    const duplicates = detectDuplicateImageCodes(rows)
    assert.equal(duplicates.length, 1)
    assert.deepEqual(duplicates[0]?.sourceRowNumbers, [2, 3])
  })

  it("does not overwrite existing metadata values", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["photo.jpg"],
        caption: "Imported caption",
        keywords: "imported",
        whoIsInPicture: "Imported person",
      },
    ]

    const tracked = [
      mockTracked("photo.jpg", {
        caption: "Existing caption",
        keywords: "existing",
        whoIsInPicture: "Existing person",
      }),
    ]

    const { matches } = buildMetadataImportMatches(rows, tracked)
    const { nextTracked, updatedImageCount, skippedFields } = applyImportedMetadataToTracked(tracked, matches)

    assert.equal(updatedImageCount, 0)
    assert.equal(nextTracked[0]?.caption, "Existing caption")
    assert.equal(nextTracked[0]?.keywords, "existing")
    assert.equal(nextTracked[0]?.whoIsInPicture, "Existing person")
    assert.equal(skippedFields.filter((field) => field.reason === "existing_value").length, 3)
  })

  it("does not clear existing fields with empty imported values", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["photo.jpg"],
        caption: "",
        keywords: "",
        whoIsInPicture: "",
      },
    ]

    const tracked = [
      mockTracked("photo.jpg", {
        caption: "Keep me",
        keywords: "keep",
        whoIsInPicture: "Person",
      }),
    ]

    const { matches } = buildMetadataImportMatches(rows, tracked)
    const { nextTracked, updatedImageCount } = applyImportedMetadataToTracked(tracked, matches)

    assert.equal(updatedImageCount, 0)
    assert.equal(nextTracked[0]?.caption, "Keep me")
    assert.equal(nextTracked[0]?.keywords, "keep")
    assert.equal(nextTracked[0]?.whoIsInPicture, "Person")
  })

  it("normalizes filenames case-insensitively", () => {
    assert.equal(normalizeFileName(" Photo.JPG "), "photo.jpg")
    assert.equal(getBaseName("Photo.JPG"), "photo")
  })
})
