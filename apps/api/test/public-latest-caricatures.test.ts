import assert from "node:assert/strict"
import test from "node:test"

import { AppError } from "../src/lib/errors"
import {
  buildLatestCaricaturesResponse,
  encodeLatestCaricaturesCursorForTest,
  parseLatestCaricaturesQuery,
} from "../src/lib/caricatures/public-homepage-caricatures"

test("parseLatestCaricaturesQuery applies defaults", () => {
  const query = parseLatestCaricaturesQuery({})
  assert.equal(query.windowDays, 30)
  assert.equal(query.limit, 15)
  assert.equal(query.cursor, null)
})

test("parseLatestCaricaturesQuery validates limit and windowDays", () => {
  assert.throws(
    () => parseLatestCaricaturesQuery({ limit: "0" }),
    (error: unknown) => error instanceof AppError && error.code === "INVALID_LIMIT",
  )
  assert.throws(
    () => parseLatestCaricaturesQuery({ windowDays: "999" }),
    (error: unknown) => error instanceof AppError && error.code === "INVALID_WINDOW_DAYS",
  )
})

test("parseLatestCaricaturesQuery decodes cursor", () => {
  const cursor = encodeLatestCaricaturesCursorForTest({
    publishedAt: "2026-01-15T12:00:00.000Z",
    id: "11111111-1111-4111-8111-111111111111",
  })
  const query = parseLatestCaricaturesQuery({ cursor })
  assert.equal(query.cursor?.publishedAt, "2026-01-15T12:00:00.000Z")
  assert.equal(query.cursor?.id, "11111111-1111-4111-8111-111111111111")
})

test("parseLatestCaricaturesQuery rejects invalid cursor", () => {
  assert.throws(
    () => parseLatestCaricaturesQuery({ cursor: "not-a-cursor" }),
    (error: unknown) => error instanceof AppError && error.code === "INVALID_CURSOR",
  )
})

test("buildLatestCaricaturesResponse maps card metadata fields", () => {
  const response = buildLatestCaricaturesResponse(
    [{
      id: "11111111-1111-4111-8111-111111111111",
      headline: "Election satire",
      description: "A satire on election rhetoric.",
      credit: "Shaielesh Mule",
      category_name: "Politics",
      language: "MARATHI",
      has_visible_text: true,
      visible_text_translation_en: "English translation",
      depicted_subjects: ["Politician", "Election"],
      published_at: "2026-06-21T10:00:00.000Z",
      preview_url: "https://cdn.example.test/card.webp",
      preview_width: 480,
      preview_height: 640,
    }],
    parseLatestCaricaturesQuery({ limit: "15" }),
  )

  assert.equal(response.items.length, 1)
  assert.equal(response.items[0]?.description, "A satire on election rhetoric.")
  assert.equal(response.items[0]?.language, "MARATHI")
  assert.equal(response.items[0]?.hasVisibleText, true)
  assert.equal(response.items[0]?.hasTranslation, true)
  assert.deepEqual(response.items[0]?.depictedSubjects, ["Politician", "Election"])
})
