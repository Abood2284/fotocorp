import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { joinPublicCardDerivative, publicAssetPredicate } from "./public-catalog-sql"

export interface HomepageAssetRow {
  id: string
  fotokey: string | null
  who_is_in_picture: string | null
  caption: string | null
  image_date: Date | string | null
  created_at: Date | string | null
  event_name: string | null
  category_name: string | null
  card_width: number | null
  card_height: number | null
}

export async function listHomepageAssets(
  db: DrizzleClient,
  options: { limit: number; searchQuery?: string },
): Promise<HomepageAssetRow[]> {
  return executeRows(db, buildHomepageAssetsSql(options))
}

function buildHomepageAssetsSql(options: { limit: number; searchQuery?: string }) {
  const where: SQL[] = [publicAssetPredicate("a")]
  if (options.searchQuery) {
    where.push(
      sql`to_tsvector('english', coalesce(a.search_text, '') || ' ' || coalesce(a.who_is_in_picture, '')) @@ plainto_tsquery('english', ${options.searchQuery})`,
    )
  }

  return sql`
    select
      a.id,
      a.fotokey,
      a.who_is_in_picture,
      a.caption,
      a.image_date,
      a.created_at,
      e.name as event_name,
      coalesce(ac.name, ec.name) as category_name,
      card.width as card_width,
      card.height as card_height
    from image_assets a
    ${joinPublicCardDerivative("a", "card")}
    left join photo_events e on e.id = a.event_id
    left join asset_categories ac on ac.id = a.category_id
    left join asset_categories ec on ec.id = e.category_id
    where ${sql.join(where, sql` and `)}
    order by coalesce(e.event_date, a.image_date, a.created_at) desc, a.id desc
    limit ${options.limit}
  `
}

async function executeRows<T>(db: DrizzleClient, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[]
  }
  return []
}
