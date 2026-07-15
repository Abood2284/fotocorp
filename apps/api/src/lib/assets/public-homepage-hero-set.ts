import { sql, type SQL } from "drizzle-orm"
import {
  heroPublicReadyJoinSql,
  heroPublicReadyWhereSql,
  HOMEPAGE_HERO_POOL_SIZE,
} from "./homepage-hero-pool"
import {
  resolvePublicStablePreviewUrl,
  type PublicPreviewCdnConfig,
} from "../media/public-preview-cdn-url"

export const PUBLIC_HOMEPAGE_HERO_DISPLAY_COUNT = 9

type PublicReadQueryClient = {
  execute(query: SQL): Promise<unknown>
}

// Previous stable cache (edge could stick a fixed set for ~30s) — kept for easy revert
// export const PUBLIC_HOMEPAGE_HERO_SET_CACHE_CONTROL =
//   "public, max-age=0, s-maxage=30, stale-while-revalidate=60"
// Trial: no edge stickiness so each refresh can observe a new shuffle from the pool
export const PUBLIC_HOMEPAGE_HERO_SET_CACHE_CONTROL = "private, no-store"

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

interface PoolAssetRow {
  position: number | string
  asset_id: string
  fotokey: string | null
  headline: string | null
  caption: string | null
  event_id: string | null
  event_name: string | null
  card_storage_key: string
}

export async function getPublicHomepageHeroSet(
  db: PublicReadQueryClient,
  cdn: PublicPreviewCdnConfig,
): Promise<PublicHomepageHeroSetResponseDto> {
  const rows = await fetchPoolAssetRows(db)

  if (rows.length !== HOMEPAGE_HERO_POOL_SIZE) {
    return emptyHeroSetResponse()
  }

  // Previous stable selection (fixed first 9 by pool position) — kept for easy revert
  // const selected = rows
  //   .slice(0, PUBLIC_HOMEPAGE_HERO_DISPLAY_COUNT)
  //   .map((row) => mapPoolRowToItem(row, cdn))

  // Trial: shuffle the curated pool of 25, then take 9 for this request
  const items = rows.map((row) => mapPoolRowToItem(row, cdn))
  const selected = shuffleArray(items).slice(0, PUBLIC_HOMEPAGE_HERO_DISPLAY_COUNT)

  return {
    setKey: "curated_pool",
    activeFrom: null,
    activeUntil: null,
    items: selected.map((item, index) => ({ ...item, slot: index + 1 })),
  }
}

async function fetchPoolAssetRows(db: PublicReadQueryClient): Promise<PoolAssetRow[]> {
  return executeRows<PoolAssetRow>(db, sql`
    select
      p.position,
      a.id as asset_id,
      a.fotokey,
      a.headline,
      a.caption,
      a.event_id,
      e.name as event_name,
      card.storage_key as card_storage_key
    from public_homepage_hero_pool_items p
    join image_assets a on a.id = p.asset_id
    left join photo_events e on e.id = a.event_id
    ${heroPublicReadyJoinSql()}
    where ${heroPublicReadyWhereSql()}
    order by p.position asc
  `)
}

function mapPoolRowToItem(
  row: PoolAssetRow,
  cdn: PublicPreviewCdnConfig,
): PublicHomepageHeroSetItemDto {
  return {
    slot: Number(row.position),
    assetId: row.asset_id,
    fotokey: row.fotokey,
    title: resolveTitle(row),
    eventId: row.event_id,
    eventName: row.event_name,
    previewUrl: resolvePublicStablePreviewUrl(cdn, {
      storageKey: row.card_storage_key,
      assetId: row.asset_id,
      variant: "card",
    }),
  }
}

function emptyHeroSetResponse(): PublicHomepageHeroSetResponseDto {
  return {
    setKey: null,
    activeFrom: null,
    activeUntil: null,
    items: [],
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

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = copy[index]!
    copy[index] = copy[swapIndex]!
    copy[swapIndex] = current
  }
  return copy
}

async function executeRows<T>(db: PublicReadQueryClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[]
  }
  return []
}
