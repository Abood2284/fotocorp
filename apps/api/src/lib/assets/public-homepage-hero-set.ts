import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"

export const PUBLIC_HOMEPAGE_HERO_SET_CACHE_CONTROL =
  "public, max-age=300, s-maxage=900, stale-while-revalidate=3600"

export interface PublicHomepageHeroSetItemDto {
  slot: number
  assetId: string
  fotokey: string | null
  title: string
  eventId: string | null
  eventName: string | null
  previewUrl: string
}

export interface PublicHomepageHeroSetResponseDto {
  setKey: string | null
  activeFrom: string | null
  activeUntil: string | null
  items: PublicHomepageHeroSetItemDto[]
}

interface HeroSetRow {
  id: string
  set_key: string
  active_from: Date | string
  active_until: Date | string
}

interface HeroSetItemRow {
  slot: number | string
  asset_id: string
  fotokey: string | null
  title: string
  event_id: string | null
  event_name: string | null
  preview_url: string
}

export async function getPublicHomepageHeroSet(
  db: DrizzleClient,
): Promise<PublicHomepageHeroSetResponseDto> {
  const activeSet = await fetchHeroSetRow(db, sql`
    select id, set_key, active_from, active_until
    from public_homepage_hero_sets
    where active_from <= now()
      and active_until > now()
    order by active_from desc
    limit 1
  `)

  const setRow = activeSet ?? await fetchHeroSetRow(db, sql`
    select id, set_key, active_from, active_until
    from public_homepage_hero_sets
    where active_from <= now()
    order by active_from desc
    limit 1
  `)

  if (!setRow) {
    return {
      setKey: null,
      activeFrom: null,
      activeUntil: null,
      items: [],
    }
  }

  const items = await fetchHeroSetItems(db, setRow.id)

  return {
    setKey: setRow.set_key,
    activeFrom: toIso(setRow.active_from),
    activeUntil: toIso(setRow.active_until),
    items,
  }
}

async function fetchHeroSetRow(db: DrizzleClient, query: SQL): Promise<HeroSetRow | null> {
  const rows = await executeRows<HeroSetRow>(db, query)
  return rows[0] ?? null
}

async function fetchHeroSetItems(db: DrizzleClient, setId: string): Promise<PublicHomepageHeroSetItemDto[]> {
  const rows = await executeRows<HeroSetItemRow>(db, sql`
    select
      slot,
      asset_id,
      fotokey,
      title,
      event_id,
      event_name,
      preview_url
    from public_homepage_hero_set_items
    where set_id = ${setId}::uuid
    order by slot asc
  `)

  return rows.map((row) => ({
    slot: Number(row.slot),
    assetId: row.asset_id,
    fotokey: row.fotokey,
    title: row.title,
    eventId: row.event_id,
    eventName: row.event_name,
    previewUrl: row.preview_url,
  }))
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
