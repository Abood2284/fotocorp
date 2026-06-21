import { sql, type SQL } from "drizzle-orm"

import { AppError } from "../errors"
import {
  sanitizeCaricatureSearchableStringList,
  sanitizeCaricatureSearchableText,
} from "../search/typesense-caricature-text"

type PublicReadQueryClient = {
  execute(query: SQL): Promise<unknown>
}

export interface PublicHomepageCaricatureDto {
  id: string
  headline: string
  description: string
  credit: string
  categoryName: string
  language: string
  hasVisibleText: boolean
  hasTranslation: boolean
  depictedSubjects: string[]
  publishedAt: string
  previewUrl: string
  previewWidth: number
  previewHeight: number
}

export interface PublicLatestCaricaturesResponseDto {
  items: PublicHomepageCaricatureDto[]
  nextCursor: string | null
  hasMore: boolean
  generatedAt: string
}

export interface PublicLatestCaricaturesQueryInput {
  windowDays?: string | null
  limit?: string | null
  cursor?: string | null
}

interface PublicLatestCaricaturesQuery {
  windowDays: number
  limit: number
  cursor: LatestCaricaturesCursor | null
}

interface LatestCaricaturesCursor {
  publishedAt: string
  id: string
}

interface HomepageCaricatureRow {
  id: string
  headline: string
  description: string
  credit: string
  category_name: string
  language: string
  has_visible_text: boolean
  visible_text_translation_en: string | null
  depicted_subjects: unknown
  published_at: Date | string
  preview_url: string
  preview_width: number
  preview_height: number
}

export interface PublicLatestCaricaturesDbTrace {
  dbMs: number
  rowCount: number
  queryName: "public_latest_caricatures"
  sourceTable: "caricature_assets"
  windowDays: number
  limit: number
  hasCursor: boolean
}

const DEFAULT_WINDOW_DAYS = 30
const DEFAULT_CARICATURE_LIMIT = 15
const MAX_CARICATURE_LIMIT = 50
const MAX_WINDOW_DAYS = 365

export function parseLatestCaricaturesQuery(
  input: PublicLatestCaricaturesQueryInput,
): PublicLatestCaricaturesQuery {
  return {
    windowDays: parseWindowDays(input.windowDays ?? null),
    limit: parseLimit(input.limit ?? null),
    cursor: parseCursor(input.cursor ?? null),
  }
}

export async function fetchPublicLatestCaricaturesRows(
  db: PublicReadQueryClient,
  query: PublicLatestCaricaturesQuery,
): Promise<{ rows: HomepageCaricatureRow[]; dbTrace: PublicLatestCaricaturesDbTrace }> {
  const dbStartedAt = Date.now()
  const rows = await executeRows<HomepageCaricatureRow>(db, buildLatestCaricaturesSql(query))
  const dbMs = Date.now() - dbStartedAt

  return {
    rows,
    dbTrace: {
      dbMs,
      rowCount: rows.length,
      queryName: "public_latest_caricatures",
      sourceTable: "caricature_assets",
      windowDays: query.windowDays,
      limit: query.limit,
      hasCursor: Boolean(query.cursor),
    },
  }
}

export function buildLatestCaricaturesResponse(
  rows: HomepageCaricatureRow[],
  query: PublicLatestCaricaturesQuery,
): PublicLatestCaricaturesResponseDto {
  const pageRows = rows.slice(0, query.limit)
  const lastReturnedRow = pageRows.at(-1)
  const hasMore = rows.length > query.limit
  const nextCursor = hasMore && lastReturnedRow
    ? encodeLatestCaricaturesCursor({
        publishedAt: toIso(lastReturnedRow.published_at) ?? new Date(0).toISOString(),
        id: lastReturnedRow.id,
      })
    : null

  return {
    items: pageRows.map(mapCaricatureRow),
    nextCursor,
    hasMore,
    generatedAt: new Date().toISOString(),
  }
}

function buildLatestCaricaturesSql(query: PublicLatestCaricaturesQuery): SQL {
  const pageSize = query.limit + 1
  const cursorWhere = query.cursor ? caricatureCursorWhere(query.cursor) : sql``

  return sql`
    select
      ca.id::text as id,
      ca.headline,
      ca.description,
      ca.credit,
      cc.name as category_name,
      ca.language,
      ca.has_visible_text,
      ca.visible_text_translation_en,
      ca.depicted_subjects,
      ca.published_at,
      card.public_url as preview_url,
      card.width as preview_width,
      card.height as preview_height
    from caricature_assets ca
    join caricature_categories cc on cc.id = ca.category_id
    join caricature_derivatives card
      on card.caricature_id = ca.id
     and card.derivative_type = 'BLURRED_CARD'
     and card.status = 'READY'
     and card.public_url is not null
    where ca.status = 'PUBLISHED'
      and ca.visibility = 'PUBLIC'
      and ca.deleted_at is null
      and ca.published_at >= now() - (${query.windowDays}::int * interval '1 day')
      ${cursorWhere}
    order by ca.published_at desc, ca.id desc
    limit ${pageSize}
  `
}

function caricatureCursorWhere(cursor: LatestCaricaturesCursor): SQL {
  return sql`and (
    ca.published_at < ${cursor.publishedAt}::timestamptz
    or (
      ca.published_at = ${cursor.publishedAt}::timestamptz
      and ca.id < ${cursor.id}::uuid
    )
  )`
}

function mapCaricatureRow(row: HomepageCaricatureRow): PublicHomepageCaricatureDto {
  const translation = sanitizeCaricatureSearchableText(row.visible_text_translation_en)

  return {
    id: row.id,
    headline: row.headline.trim() || "Untitled caricature",
    description: row.description.trim(),
    credit: row.credit.trim(),
    categoryName: row.category_name.trim(),
    language: row.language,
    hasVisibleText: row.has_visible_text,
    hasTranslation: Boolean(translation),
    depictedSubjects: sanitizeCaricatureSearchableStringList(row.depicted_subjects),
    publishedAt: toIso(row.published_at) ?? new Date().toISOString(),
    previewUrl: row.preview_url.trim(),
    previewWidth: row.preview_width,
    previewHeight: row.preview_height,
  }
}

function parseWindowDays(value: string | null): number {
  if (!value) return DEFAULT_WINDOW_DAYS
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_WINDOW_DAYS) {
    throw new AppError(400, "INVALID_WINDOW_DAYS", `windowDays must be an integer between 1 and ${MAX_WINDOW_DAYS}.`)
  }
  return parsed
}

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_CARICATURE_LIMIT
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_CARICATURE_LIMIT) {
    throw new AppError(400, "INVALID_LIMIT", `limit must be an integer between 1 and ${MAX_CARICATURE_LIMIT}.`)
  }
  return parsed
}

function parseCursor(value: string | null): LatestCaricaturesCursor | null {
  const normalized = value?.trim()
  if (!normalized) return null

  try {
    const padded = normalized
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
    const parsed = JSON.parse(atob(padded)) as Partial<LatestCaricaturesCursor>
    if (!parsed.publishedAt || !parsed.id || !isUuid(parsed.id)) throw new Error("invalid cursor")
    if (!toIso(parsed.publishedAt)) throw new Error("invalid cursor")
    return { publishedAt: parsed.publishedAt, id: parsed.id }
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "Cursor is invalid.")
  }
}

function encodeLatestCaricaturesCursor(cursor: LatestCaricaturesCursor): string {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

async function executeRows<T>(db: PublicReadQueryClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[]
  }
  return []
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function encodeLatestCaricaturesCursorForTest(cursor: LatestCaricaturesCursor): string {
  return encodeLatestCaricaturesCursor(cursor)
}
