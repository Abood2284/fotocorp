import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db/http"
import { buildPublicStablePreviewPath } from "../media/stable-preview-path"
import { joinPublicCardDerivative, publicAssetPredicate } from "./public-catalog-sql"

export const PUBLIC_EVENT_FEED_WINDOW_DAYS = 30

export interface SyncPublicEventFeedResult {
  eventId: string
  action: "upserted" | "hidden" | "deleted" | "not_found"
  isPublic: boolean
}

export interface CleanupResult {
  windowDays: number
  deletedOldRows: number
  durationMs: number
  status: "ok"
}

interface EventRow {
  id: string
  name: string
  event_date: Date | string | null
  created_at: Date | string
  status: string
}

interface FeedPreviewRow {
  preview_asset_id: string
  preview_width: number | null
  preview_height: number | null
  asset_count: number | string
}

export async function syncPublicEventFeedForEvent(
  db: DrizzleClient,
  eventId: string,
): Promise<SyncPublicEventFeedResult> {
  const events = await executeRows<EventRow>(
    db,
    sql`
      select id, name, event_date, created_at, status
      from photo_events
      where id = ${eventId}::uuid
      limit 1
    `,
  )
  const event = events[0]
  if (!event) {
    return { eventId, action: "not_found", isPublic: false }
  }

  const withinWindow = await isEventWithinFeedWindow(db, event.created_at)
  const eventEligible = event.status === "ACTIVE" && withinWindow

  if (!eventEligible) {
    if (!withinWindow) {
      await db.execute(sql`
        delete from public_event_feed_items
        where event_id = ${eventId}::uuid
      `)
      return { eventId, action: "deleted", isPublic: false }
    }

    await db.execute(sql`
      insert into public_event_feed_items (
        event_id,
        title,
        event_date,
        created_at,
        asset_count,
        preview_asset_id,
        preview_width,
        preview_height,
        preview_url,
        is_public,
        last_computed_at,
        updated_at
      )
      values (
        ${eventId}::uuid,
        ${event.name},
        ${event.event_date},
        ${event.created_at},
        0,
        null,
        null,
        null,
        '',
        false,
        now(),
        now()
      )
      on conflict (event_id) do update set
        title = excluded.title,
        event_date = excluded.event_date,
        created_at = excluded.created_at,
        asset_count = 0,
        preview_asset_id = null,
        preview_width = null,
        preview_height = null,
        preview_url = '',
        is_public = false,
        last_computed_at = now(),
        updated_at = now()
    `)
    return { eventId, action: "hidden", isPublic: false }
  }

  const feedRows = await executeRows<FeedPreviewRow>(
    db,
    sql`
      with eligible_assets as (
        select
          a.id as asset_id,
          a.image_date,
          a.created_at,
          card.width,
          card.height
        from image_assets a
        ${joinPublicCardDerivative("a", "card")}
        where a.event_id = ${eventId}::uuid
          and ${publicAssetPredicate("a")}
      ),
      event_counts as (
        select count(*)::int as asset_count
        from eligible_assets
      ),
      event_previews as (
        select
          asset_id as preview_asset_id,
          width as preview_width,
          height as preview_height
        from eligible_assets
        order by coalesce(image_date, created_at) desc, asset_id desc
        limit 1
      )
      select
        ep.preview_asset_id,
        ep.preview_width,
        ep.preview_height,
        ec.asset_count
      from event_counts ec
      left join event_previews ep on true
    `,
  )

  const feed = feedRows[0]
  const assetCount = Number(feed?.asset_count ?? 0)
  if (!feed?.preview_asset_id || assetCount < 1) {
    await db.execute(sql`
      insert into public_event_feed_items (
        event_id,
        title,
        event_date,
        created_at,
        asset_count,
        preview_asset_id,
        preview_width,
        preview_height,
        preview_url,
        is_public,
        last_computed_at,
        updated_at
      )
      values (
        ${eventId}::uuid,
        ${event.name},
        ${event.event_date},
        ${event.created_at},
        0,
        null,
        null,
        null,
        '',
        false,
        now(),
        now()
      )
      on conflict (event_id) do update set
        title = excluded.title,
        event_date = excluded.event_date,
        created_at = excluded.created_at,
        asset_count = 0,
        preview_asset_id = null,
        preview_width = null,
        preview_height = null,
        preview_url = '',
        is_public = false,
        last_computed_at = now(),
        updated_at = now()
    `)
    return { eventId, action: "hidden", isPublic: false }
  }

  const previewUrl = buildPublicStablePreviewPath(feed.preview_asset_id, "card")
  await db.execute(sql`
    insert into public_event_feed_items (
      event_id,
      title,
      event_date,
      created_at,
      asset_count,
      preview_asset_id,
      preview_width,
      preview_height,
      preview_url,
      is_public,
      last_computed_at,
      updated_at
    )
    values (
      ${eventId}::uuid,
      ${event.name},
      ${event.event_date},
      ${event.created_at},
      ${assetCount},
      ${feed.preview_asset_id}::uuid,
      ${feed.preview_width},
      ${feed.preview_height},
      ${previewUrl},
      true,
      now(),
      now()
    )
    on conflict (event_id) do update set
      title = excluded.title,
      event_date = excluded.event_date,
      created_at = excluded.created_at,
      asset_count = excluded.asset_count,
      preview_asset_id = excluded.preview_asset_id,
      preview_width = excluded.preview_width,
      preview_height = excluded.preview_height,
      preview_url = excluded.preview_url,
      is_public = excluded.is_public,
      last_computed_at = now(),
      updated_at = now()
  `)

  return { eventId, action: "upserted", isPublic: true }
}

export async function deleteOldPublicEventFeedItems(
  db: DrizzleClient,
  options?: { windowDays?: number },
): Promise<CleanupResult> {
  const startedAt = Date.now()
  const windowDays = options?.windowDays ?? PUBLIC_EVENT_FEED_WINDOW_DAYS
  const result = await db.execute(sql`
    delete from public_event_feed_items
    where created_at < now() - (${windowDays}::int * interval '1 day')
  `)
  const deletedOldRows = readDeletedCount(result)

  return {
    windowDays,
    deletedOldRows,
    durationMs: Date.now() - startedAt,
    status: "ok",
  }
}

export async function schedulePublicEventFeedSync(
  db: DrizzleClient,
  eventId: string | null | undefined,
): Promise<void> {
  if (!eventId) return
  try {
    const result = await syncPublicEventFeedForEvent(db, eventId)
    console.info(
      JSON.stringify({
        event: "public_event_feed_sync",
        eventId,
        action: result.action,
        isPublic: result.isPublic,
        status: "ok",
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      JSON.stringify({
        event: "public_event_feed_sync",
        eventId,
        status: "error",
        errorMessage: message,
      }),
    )
  }
}

export async function schedulePublicEventFeedSyncForAsset(
  db: DrizzleClient,
  assetId: string,
  previousEventId?: string | null,
): Promise<void> {
  const rows = await executeRows<{ event_id: string | null }>(
    db,
    sql`select event_id from image_assets where id = ${assetId}::uuid limit 1`,
  )
  const currentEventId = rows[0]?.event_id ?? null
  const eventIds = new Set<string>()
  if (previousEventId) eventIds.add(previousEventId)
  if (currentEventId) eventIds.add(currentEventId)
  await Promise.all([...eventIds].map((id) => schedulePublicEventFeedSync(db, id)))
}

async function isEventWithinFeedWindow(
  db: DrizzleClient,
  createdAt: Date | string,
): Promise<boolean> {
  const rows = await executeRows<{ within_window: boolean }>(
    db,
    sql`
      select (${createdAt}::timestamptz >= now() - (${PUBLIC_EVENT_FEED_WINDOW_DAYS}::int * interval '1 day')) as within_window
    `,
  )
  return Boolean(rows[0]?.within_window)
}

function readDeletedCount(result: unknown): number {
  if (result && typeof result === "object") {
    if ("rowCount" in result && typeof result.rowCount === "number") return result.rowCount
    if ("rows" in result && Array.isArray(result.rows) && result.rows.length > 0) {
      const first = result.rows[0] as { count?: string | number }
      if (first.count !== undefined) return Number(first.count)
    }
  }
  return 0
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[]
  }
  return []
}
