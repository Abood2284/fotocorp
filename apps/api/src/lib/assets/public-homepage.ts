import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { AppError } from "../errors"
import {
  type PublicPreviewCdnConfig,
  resolvePublicStablePreviewUrl,
} from "../media/public-preview-cdn-url"

export interface PublicHomepageEventDto {
  id: string
  title: string
  slug: string | null
  eventDate: string | null
  createdAt: string
  assetCount: number
  location: string | null
  categoryName: string | null
  previewUrl: string
  previewWidth: number | null
  previewHeight: number | null
}

export interface PublicLatestEventsResponseDto {
  items: PublicHomepageEventDto[]
  nextCursor: string | null
  hasMore: boolean
  generatedAt: string
}

export interface PublicHomepageFeedDto {
  latestEventsPreview: {
    items: PublicHomepageEventDto[]
    nextCursor: string | null
    hasMore: boolean
  }
  generatedAt: string
}

export interface PublicLatestEventsQueryInput {
  windowDays?: string | null
  limit?: string | null
  cursor?: string | null
  section?: string | null
}

interface PublicLatestEventsQuery {
  windowDays: number
  limit: number
  cursor: LatestEventsCursor | null
  section: PublicLatestEventsSection
}

export type PublicLatestEventsSection = "latest" | "news" | "sports" | "entertainment" | "retro"

interface LatestEventsCursor {
  eventDate: string
  id: string
}

interface HomepageEventRow {
  event_id: string
  title: string
  event_date: Date | string | null
  created_at: Date | string
  asset_count: number | string
  event_location: string | null
  category_name: string | null
  preview_asset_id: string | null
  preview_width: number | null
  preview_height: number | null
  preview_url: string
  preview_storage_key: string | null
}

const DEFAULT_WINDOW_DAYS = 30
const DEFAULT_EVENT_LIMIT = 15
const MAX_EVENT_LIMIT = 50
const MAX_WINDOW_DAYS = 365

export async function getPublicHomepageFeed(
  db: DrizzleClient,
  cdn: PublicPreviewCdnConfig = { baseUrl: null, version: null },
): Promise<PublicHomepageFeedDto> {
  const latestEvents = await listPublicLatestEvents(db, {
    windowDays: String(DEFAULT_WINDOW_DAYS),
    limit: String(DEFAULT_EVENT_LIMIT),
    cursor: null,
  }, cdn)

  return {
    latestEventsPreview: {
      items: latestEvents.items,
      nextCursor: latestEvents.nextCursor,
      hasMore: latestEvents.hasMore,
    },
    generatedAt: new Date().toISOString(),
  }
}

export interface PublicLatestEventsDbTrace {
  dbMs: number
  rowCount: number
  queryName: "public_latest_events_projection"
  projection: true
  sourceTable: "public_event_feed_items"
  windowDays: number
  limit: number
  hasCursor: boolean
  section: PublicLatestEventsSection
}

export async function fetchPublicLatestEventsRows(
  db: DrizzleClient,
  query: PublicLatestEventsQuery,
): Promise<{ rows: HomepageEventRow[]; dbTrace: PublicLatestEventsDbTrace }> {
  const dbStartedAt = Date.now()
  const rows = await executeRows<HomepageEventRow>(db, buildLatestEventsSql(query))
  const dbMs = Date.now() - dbStartedAt

  return {
    rows,
    dbTrace: {
      dbMs,
      rowCount: rows.length,
      queryName: "public_latest_events_projection",
      projection: true,
      sourceTable: "public_event_feed_items",
      windowDays: query.windowDays,
      limit: query.limit,
      hasCursor: Boolean(query.cursor),
      section: query.section,
    },
  }
}

export async function listPublicLatestEvents(
  db: DrizzleClient,
  input: PublicLatestEventsQueryInput,
  cdn: PublicPreviewCdnConfig = { baseUrl: null, version: null },
): Promise<PublicLatestEventsResponseDto> {
  const query = parseLatestEventsQuery(input)
  const { rows } = await fetchPublicLatestEventsRows(db, query)
  return buildLatestEventsResponse(rows, query, cdn)
}

export function buildLatestEventsResponse(
  rows: HomepageEventRow[],
  query: PublicLatestEventsQuery,
  cdn: PublicPreviewCdnConfig = { baseUrl: null, version: null },
): PublicLatestEventsResponseDto {
  const pageRows = rows.slice(0, query.limit)
  const lastReturnedRow = pageRows.at(-1)
  const hasMore = rows.length > query.limit
  const nextCursor = hasMore && lastReturnedRow
    ? encodeLatestEventsCursor({
        eventDate: toIso(lastReturnedRow.event_date) ?? new Date(0).toISOString(),
        id: lastReturnedRow.event_id,
      })
    : null

  return {
    items: pageRows.map((row) => mapEventRow(row, cdn)),
    nextCursor,
    hasMore,
    generatedAt: new Date().toISOString(),
  }
}

function mapEventRow(row: HomepageEventRow, cdn: PublicPreviewCdnConfig): PublicHomepageEventDto {
  const previewUrl = row.preview_asset_id
    ? resolvePublicStablePreviewUrl(cdn, {
        storageKey: row.preview_storage_key,
        assetId: row.preview_asset_id,
        variant: "card",
      })
    : row.preview_url

  return {
    id: row.event_id,
    title: row.title ?? "Untitled event",
    slug: null,
    eventDate: toIso(row.event_date),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    assetCount: Number(row.asset_count),
    location: row.event_location,
    categoryName: row.category_name,
    previewUrl,
    previewWidth: row.preview_width,
    previewHeight: row.preview_height,
  }
}

function buildLatestEventsSql(query: PublicLatestEventsQuery): SQL {
  const pageSize = query.limit + 1
  const cursorWhere = query.cursor
    ? sql`and (
        f.event_date < ${query.cursor.eventDate}::timestamptz
        or (
          f.event_date = ${query.cursor.eventDate}::timestamptz
          and f.event_id < ${query.cursor.id}::uuid
        )
      )`
    : sql``
  const sectionWhere = latestEventsSectionWhere(query.section)

  return sql`
    select
      f.event_id,
      f.title,
      f.event_date,
      f.created_at,
      f.asset_count,
      e.location as event_location,
      c.name as category_name,
      f.preview_asset_id,
      f.preview_width,
      f.preview_height,
      f.preview_url,
      card.storage_key as preview_storage_key
    from public_event_feed_items f
    left join photo_events e on e.id = f.event_id
    left join asset_categories c on c.id = e.category_id
    left join image_derivatives card
      on card.image_asset_id = f.preview_asset_id
      and card.variant = 'CARD'
      and card.generation_status = 'READY'
    where f.is_public = true
      and f.event_date is not null
      and f.event_date >= (current_timestamp - (${query.windowDays}::int * interval '1 day'))
      ${sectionWhere}
      ${cursorWhere}
    order by f.event_date desc, f.event_id desc
    limit ${pageSize}
  `
}

export function parseLatestEventsQuery(input: PublicLatestEventsQueryInput): PublicLatestEventsQuery {
  return {
    windowDays: parseWindowDays(input.windowDays ?? null),
    limit: parseLimit(input.limit ?? null),
    cursor: parseCursor(input.cursor ?? null),
    section: parseSection(input.section ?? null),
  }
}

function parseSection(value: string | null): PublicLatestEventsSection {
  const normalized = value?.trim().toLowerCase()
  if (!normalized || normalized === "latest") return "latest"
  if (
    normalized === "news" ||
    normalized === "sports" ||
    normalized === "entertainment" ||
    normalized === "retro"
  ) {
    return normalized
  }
  throw new AppError(400, "INVALID_SECTION", "section must be latest, news, sports, entertainment, or retro.")
}

function latestEventsSectionWhere(section: PublicLatestEventsSection): SQL {
  if (section === "latest") return sql``
  if (section === "retro") {
    return sql`and (
      lower(coalesce(c.name, '')) = 'retro'
      or lower(coalesce(c.name, '')) like '%archive%'
    )`
  }
  return sql`and lower(coalesce(c.name, '')) = ${section}`
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
  if (!value) return DEFAULT_EVENT_LIMIT
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_EVENT_LIMIT) {
    throw new AppError(400, "INVALID_LIMIT", `limit must be an integer between 1 and ${MAX_EVENT_LIMIT}.`)
  }
  return parsed
}

function parseCursor(value: string | null): LatestEventsCursor | null {
  const normalized = value?.trim()
  if (!normalized) return null

  try {
    const padded = normalized
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
    const parsed = JSON.parse(atob(padded)) as Partial<LatestEventsCursor>
    if (!parsed.eventDate || !parsed.id || !isUuid(parsed.id)) throw new Error("invalid cursor")
    if (!toIso(parsed.eventDate)) throw new Error("invalid cursor")
    return { eventDate: parsed.eventDate, id: parsed.id }
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "Cursor is invalid.")
  }
}

function encodeLatestEventsCursor(cursor: LatestEventsCursor): string {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
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
