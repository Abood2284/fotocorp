import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { HOMEPAGE_HERO_POOL_SIZE } from "../../db/schema/public-homepage-hero-pool-items"
import { AppError } from "../errors"
import { CARD_LIGHT_PREVIEW_PROFILE } from "../media/watermark"

export { HOMEPAGE_HERO_POOL_SIZE }

export interface HomepageHeroPoolItemDto {
  position: number
  assetId: string
  fotokey: string | null
  title: string
  eventId: string | null
  eventName: string | null
  cardPreviewReady: boolean
}

export interface HomepageHeroPoolResponseDto {
  poolSize: number
  items: HomepageHeroPoolItemDto[]
  updatedAt: string | null
}

export interface HomepageHeroPoolCandidateDto {
  assetId: string
  fotokey: string | null
  title: string
  eventId: string | null
  eventName: string | null
  imageDate: string | null
  cardPreviewReady: boolean
}

export interface HomepageHeroPoolCandidatesResponseDto {
  items: HomepageHeroPoolCandidateDto[]
  nextCursor: string | null
}

interface PoolRow {
  position: number | string
  asset_id: string
  fotokey: string | null
  headline: string | null
  caption: string | null
  event_id: string | null
  event_name: string | null
  card_status: string | null
  updated_at: Date | string
}

interface CandidateRow {
  id: string
  fotokey: string | null
  headline: string | null
  caption: string | null
  event_id: string | null
  event_name: string | null
  image_date: Date | string | null
  image_sort_at: Date | string
  card_status: string | null
}

interface CursorPayload {
  imageSortAt: string
  id: string
}

export function heroPublicReadyJoinSql(): SQL {
  return sql`
    join image_derivatives card
      on card.image_asset_id = a.id
     and card.variant = 'CARD'
     and card.generation_status = 'READY'
     and card.is_watermarked = true
     and card.watermark_profile = ${CARD_LIGHT_PREVIEW_PROFILE}
  `
}

export function heroPublicReadyWhereSql(): SQL {
  return sql`
    a.status = 'ACTIVE'
    and a.visibility = 'PUBLIC'
    and a.media_type = 'IMAGE'
    and a.original_exists_in_storage = true
    and nullif(btrim(card.storage_key), '') is not null
  `
}

export async function getHomepageHeroPool(db: DrizzleClient): Promise<HomepageHeroPoolResponseDto> {
  const rows = await executeRows<PoolRow>(db, sql`
    select
      p.position,
      a.id as asset_id,
      a.fotokey,
      a.headline,
      a.caption,
      a.event_id,
      e.name as event_name,
      card.generation_status as card_status,
      p.updated_at
    from public_homepage_hero_pool_items p
    join image_assets a on a.id = p.asset_id
    left join photo_events e on e.id = a.event_id
    left join image_derivatives card
      on card.image_asset_id = a.id
     and card.variant = 'CARD'
    order by p.position asc
  `)

  const latestUpdated = rows.reduce<string | null>((latest, row) => {
    const iso = toIso(row.updated_at)
    if (!iso) return latest
    if (!latest || iso > latest) return iso
    return latest
  }, null)

  return {
    poolSize: HOMEPAGE_HERO_POOL_SIZE,
    items: rows.map(mapPoolRow),
    updatedAt: latestUpdated,
  }
}

export async function listHomepageHeroPoolCandidates(
  db: DrizzleClient,
  input: { q?: string; cursor?: string; limit: number },
): Promise<HomepageHeroPoolCandidatesResponseDto> {
  const limit = Math.min(Math.max(input.limit, 1), 50)
  const q = input.q?.trim() || null
  const cursor = parseCursor(input.cursor)
  const searchClause = buildSearchClause(q)

  const rows = await executeRows<CandidateRow>(db, sql`
    select
      a.id,
      a.fotokey,
      a.headline,
      a.caption,
      a.event_id,
      e.name as event_name,
      a.image_date,
      card.generation_status as card_status,
      coalesce(a.image_date, a.created_at) as image_sort_at
    from image_assets a
    ${heroPublicReadyJoinSql()}
    left join photo_events e on e.id = a.event_id
    where ${heroPublicReadyWhereSql()}
      ${searchClause}
      ${cursor ? sql`and (coalesce(a.image_date, a.created_at), a.id) < (${cursor.imageSortAt}::timestamptz, ${cursor.id}::uuid)` : sql``}
    order by coalesce(a.image_date, a.created_at) desc nulls last, a.id desc
    limit ${limit + 1}
  `)

  const pageRows = rows.slice(0, limit)
  const last = pageRows.at(-1)
  const nextCursor =
    rows.length > limit && last
      ? encodeCursor({
          imageSortAt: toIso(last.image_sort_at) ?? new Date().toISOString(),
          id: last.id,
        })
      : null

  return {
    items: pageRows.map(mapCandidateRow),
    nextCursor,
  }
}

export async function replaceHomepageHeroPool(
  db: DrizzleClient,
  input: {
    assetIds: string[]
    staffMemberId: string | null
  },
): Promise<HomepageHeroPoolResponseDto> {
  const assetIds = [...new Set(input.assetIds)]
  if (assetIds.length !== HOMEPAGE_HERO_POOL_SIZE) {
    throw new AppError(
      400,
      "INVALID_POOL_SIZE",
      `Homepage hero pool must contain exactly ${HOMEPAGE_HERO_POOL_SIZE} unique assets.`,
    )
  }

  for (const assetId of assetIds) {
    if (!isUuid(assetId)) {
      throw new AppError(400, "INVALID_ASSET_ID", "One or more asset ids are invalid.")
    }
  }

  const assetIdInList = sql.join(assetIds.map((id) => sql`${id}::uuid`), sql`, `)
  const eligibleRows = await executeRows<{ id: string }>(db, sql`
    select a.id
    from image_assets a
    ${heroPublicReadyJoinSql()}
    where ${heroPublicReadyWhereSql()}
      and a.id in (${assetIdInList})
  `)

  const eligibleIds = new Set(eligibleRows.map((row) => row.id))
  const ineligible = assetIds.filter((id) => !eligibleIds.has(id))
  if (ineligible.length > 0) {
    throw new AppError(
      409,
      "ASSET_NOT_ELIGIBLE",
      "One or more assets are not public-ready with a CARD preview.",
      { ineligibleAssetIds: ineligible },
    )
  }

  await db.execute(sql`delete from public_homepage_hero_pool_items`)

  for (let index = 0; index < assetIds.length; index += 1) {
    const assetId = assetIds[index]!
    const position = index + 1
    await db.execute(sql`
      insert into public_homepage_hero_pool_items (
        asset_id,
        position,
        selected_by_staff_member_id,
        created_at,
        updated_at
      ) values (
        ${assetId}::uuid,
        ${position},
        ${input.staffMemberId},
        now(),
        now()
      )
    `)
  }

  return getHomepageHeroPool(db)
}

function buildSearchClause(q: string | null): SQL {
  if (!q) return sql``
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`
  return sql`
    and (
      a.fotokey ilike ${pattern}
      or a.headline ilike ${pattern}
      or a.caption ilike ${pattern}
      or a.who_is_in_picture ilike ${pattern}
      or e.name ilike ${pattern}
    )
  `
}

function mapPoolRow(row: PoolRow): HomepageHeroPoolItemDto {
  return {
    position: Number(row.position),
    assetId: row.asset_id,
    fotokey: row.fotokey,
    title: resolveTitle(row),
    eventId: row.event_id,
    eventName: row.event_name,
    cardPreviewReady: row.card_status === "READY",
  }
}

function mapCandidateRow(row: CandidateRow): HomepageHeroPoolCandidateDto {
  return {
    assetId: row.id,
    fotokey: row.fotokey,
    title: resolveTitle(row),
    eventId: row.event_id,
    eventName: row.event_name,
    imageDate: toIso(row.image_date),
    cardPreviewReady: row.card_status === "READY",
  }
}

function resolveTitle(row: {
  event_name: string | null
  headline: string | null
  caption: string | null
  fotokey?: string | null
}): string {
  return (
    row.event_name?.trim()
    || row.headline?.trim()
    || row.caption?.trim()
    || row.fotokey?.trim()
    || "Fotocorp image"
  )
}

function parseCursor(value: string | undefined): CursorPayload | null {
  if (!value?.trim()) return null
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CursorPayload
    if (!decoded.imageSortAt || !decoded.id || !isUuid(decoded.id)) return null
    return decoded
  } catch {
    return null
  }
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[]
  }
  return []
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
