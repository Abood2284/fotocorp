import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { TrackedFile } from "../src/components/contributor/contributor-upload-types"
import {
  applyImportedMetadataToTracked,
  buildMetadataImportMatches,
  detectDuplicateImageCodes,
  getBaseName,
  isMetadataImportPlaceholderValue,
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

  it("does not overwrite existing metadata values under fill_empty_only", () => {
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

  it("does not fill Coming Soon placeholders under default fill_empty_only", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["photo.jpg"],
        caption: "Real caption",
        keywords: "real, tags",
        whoIsInPicture: "Real person",
      },
    ]

    const tracked = [
      mockTracked("photo.jpg", {
        caption: "Coming Soon",
        keywords: "Coming Soon",
        whoIsInPicture: "Coming Soon",
      }),
    ]

    const { matches } = buildMetadataImportMatches(rows, tracked)
    const { nextTracked, updatedImageCount, skippedFields } = applyImportedMetadataToTracked(
      tracked,
      matches,
    )

    assert.equal(updatedImageCount, 0)
    assert.equal(nextTracked[0]?.caption, "Coming Soon")
    assert.equal(skippedFields.filter((field) => field.reason === "existing_value").length, 3)
  })

  it("fills Coming Soon placeholders when treatPlaceholdersAsEmpty is enabled", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["photo.jpg"],
        caption: "Real caption",
        keywords: "real, tags",
        whoIsInPicture: "Real person",
      },
    ]

    const tracked = [
      mockTracked("photo.jpg", {
        caption: "Coming Soon",
        keywords: "Coming Soon",
        whoIsInPicture: "Coming Soon",
      }),
    ]

    const importOptions = { treatPlaceholdersAsEmpty: true }
    const { matches } = buildMetadataImportMatches(rows, tracked, importOptions)
    const { nextTracked, updatedImageCount } = applyImportedMetadataToTracked(
      tracked,
      matches,
      importOptions,
    )

    assert.equal(updatedImageCount, 1)
    assert.equal(nextTracked[0]?.caption, "Real caption")
    assert.equal(nextTracked[0]?.keywords, "real, tags")
    assert.equal(nextTracked[0]?.whoIsInPicture, "Real person")
  })

  it("overwrites existing metadata values under overwrite policy", () => {
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

    const importOptions = { overwritePolicy: "overwrite" as const }
    const { matches } = buildMetadataImportMatches(rows, tracked, importOptions)
    const { nextTracked, updatedImageCount, skippedFields } = applyImportedMetadataToTracked(
      tracked,
      matches,
      importOptions,
    )

    assert.equal(updatedImageCount, 1)
    assert.equal(nextTracked[0]?.caption, "Imported caption")
    assert.equal(nextTracked[0]?.keywords, "imported")
    assert.equal(nextTracked[0]?.whoIsInPicture, "Imported person")
    assert.equal(skippedFields.length, 0)
  })

  it("overwrite policy replaces Coming Soon placeholders", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["photo.jpg"],
        caption: "Final caption",
        keywords: "final",
        whoIsInPicture: "Final person",
      },
    ]

    const tracked = [
      mockTracked("photo.jpg", {
        caption: "Coming Soon",
        keywords: "Coming Soon",
        whoIsInPicture: "Coming Soon",
      }),
    ]

    const importOptions = { overwritePolicy: "overwrite" as const }
    const { matches } = buildMetadataImportMatches(rows, tracked, importOptions)
    const { nextTracked, updatedImageCount } = applyImportedMetadataToTracked(
      tracked,
      matches,
      importOptions,
    )

    assert.equal(updatedImageCount, 1)
    assert.equal(nextTracked[0]?.caption, "Final caption")
  })

  it("overwrite policy does not clear existing fields with empty imported values", () => {
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

    const importOptions = { overwritePolicy: "overwrite" as const }
    const { matches } = buildMetadataImportMatches(rows, tracked, importOptions)
    const { nextTracked, updatedImageCount } = applyImportedMetadataToTracked(
      tracked,
      matches,
      importOptions,
    )

    assert.equal(updatedImageCount, 0)
    assert.equal(nextTracked[0]?.caption, "Keep me")
  })

  it("detects metadata import placeholder values", () => {
    assert.equal(isMetadataImportPlaceholderValue("Coming Soon"), true)
    assert.equal(isMetadataImportPlaceholderValue("coming soon"), true)
    assert.equal(isMetadataImportPlaceholderValue("Real caption"), false)
  })

  it("normalizes filenames case-insensitively", () => {
    assert.equal(normalizeFileName(" Photo.JPG "), "photo.jpg")
    assert.equal(getBaseName("Photo.JPG"), "photo")
  })

  it("matches spreadsheet rows by fotokey before filename fallback", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["fk-001"],
        caption: "By fotokey",
        keywords: "",
        whoIsInPicture: "",
      },
      {
        sourceRowNumber: 3,
        imageCodes: ["other.jpg"],
        caption: "By filename",
        keywords: "",
        whoIsInPicture: "",
      },
    ]

    const tracked = [
      mockTracked("unrelated.jpg", {
        key: "key-1",
        imageAssetId: "asset-1",
        fotokey: "FK-001",
        legacyImageCode: "legacy-one.jpg",
      }),
      mockTracked("other.jpg", {
        key: "key-2",
        imageAssetId: "asset-2",
        fotokey: null,
        legacyImageCode: "other.jpg",
      }),
    ]

    const { matches } = buildMetadataImportMatches(rows, tracked, {
      matchKey: "fotokey_with_filename_fallback",
    })

    assert.equal(matches.length, 2)
    assert.equal(matches.find((match) => match.trackedKey === "key-1")?.caption, "By fotokey")
    assert.equal(matches.find((match) => match.trackedKey === "key-2")?.caption, "By filename")
  })

  it("matches spreadsheet rows by original upload filename before fotokey", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["a114.jpg"],
        caption: "From upload original",
        keywords: "",
        whoIsInPicture: "",
      },
    ]

    const tracked = [
      mockTracked("FC140626204", {
        key: "key-1",
        imageAssetId: "asset-1",
        fotokey: "FC140626204",
        legacyImageCode: "PHUPLOAD-123",
        originalFileName: "a114.JPG",
      }),
    ]

    const { matches } = buildMetadataImportMatches(rows, tracked, {
      matchKey: "original_filename_first",
    })

    assert.equal(matches.length, 1)
    assert.equal(matches[0]?.caption, "From upload original")
  })

  it("matches spreadsheet rows by original upload filename before phupload legacy codes", () => {
    const rows: ImportedMetadataRow[] = [
      {
        sourceRowNumber: 2,
        imageCodes: ["camera-shot.jpg"],
        caption: "From original filename",
        keywords: "",
        whoIsInPicture: "",
      },
    ]

    const tracked = [
      mockTracked("Not assigned", {
        key: "key-1",
        imageAssetId: "asset-1",
        fotokey: null,
        legacyImageCode: "PHUPLOAD-123",
        originalFileName: "camera-shot.jpg",
      }),
    ]

    const { matches } = buildMetadataImportMatches(rows, tracked, {
      matchKey: "fotokey_with_filename_fallback",
    })

    assert.equal(matches.length, 1)
    assert.equal(matches[0]?.caption, "From original filename")
  })
})
