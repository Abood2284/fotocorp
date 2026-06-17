import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { AppError } from "../src/lib/errors"
import {
  normalizeCaricatureMetadataInput,
  resolveVisibleTextFields,
} from "../src/lib/caricatures/caricature-asset-metadata"

const baseInput = {
  headline: "Election cartoon",
  description: "A satirical take on campaign promises.",
  credit: "Artist One",
  categoryId: "11111111-1111-4111-8111-111111111111",
  keywords: ["election", "politics"],
  depictedSubjects: ["Prime Minister"],
  publishedAt: "2026-01-15T00:00:00.000Z",
  status: "DRAFT",
}

describe("caricature asset metadata", () => {
  it("clears visible text fields for NO_VISIBLE_TEXT", () => {
    const fields = resolveVisibleTextFields("NO_VISIBLE_TEXT", {})
    assert.deepEqual(fields, {
      languageOther: null,
      visibleText: null,
      visibleTextTranslationEn: null,
      hasVisibleText: false,
    })
  })

  it("requires visible text for Hindi and allows optional translation", () => {
    const fields = resolveVisibleTextFields("HINDI", {
      visibleText: "मजेदार शीर्षक",
      visibleTextTranslationEn: "Funny headline",
    })
    assert.equal(fields.hasVisibleText, true)
    assert.equal(fields.visibleText, "मजेदार शीर्षक")
    assert.equal(fields.visibleTextTranslationEn, "Funny headline")
  })

  it("requires languageOther when language is OTHER", () => {
    assert.throws(
      () =>
        resolveVisibleTextFields("OTHER", {
          visibleText: "Sample text",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "CARICATURE_FIELD_REQUIRED",
    )
  })

  it("rejects placeholder headline values", () => {
    assert.throws(
      () =>
        normalizeCaricatureMetadataInput({
          ...baseInput,
          headline: "N/A",
          language: "NO_VISIBLE_TEXT",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "CARICATURE_PLACEHOLDER_NOT_ALLOWED",
    )
  })

  it("blocks publish without an uploaded original file", () => {
    assert.throws(
      () =>
        normalizeCaricatureMetadataInput(
          {
            ...baseInput,
            language: "NO_VISIBLE_TEXT",
            status: "PUBLISHED",
          },
          { hasOriginalFile: false },
        ),
      (error: unknown) =>
        error instanceof AppError && error.code === "CARICATURE_PUBLISH_REQUIRES_FILE",
    )
  })

  it("allows publish when original file exists", () => {
    const normalized = normalizeCaricatureMetadataInput(
      {
        ...baseInput,
        language: "NO_VISIBLE_TEXT",
        status: "PUBLISHED",
      },
      { hasOriginalFile: true },
    )
    assert.equal(normalized.status, "PUBLISHED")
  })
})
