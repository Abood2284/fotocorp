import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db/http"
import {
  type PublicPreviewCdnConfig,
  resolvePublicStablePreviewUrl,
} from "../media/public-preview-cdn-url"
import { joinPublicCardDerivative, publicAssetPredicate } from "./public-catalog-sql"

export const PUBLIC_EVENT_FEED_WINDOW_DAYS = 30

const POST_PUBLISH_SYNC_ATTEMPTS = 3
const POST_PUBLISH_SYNC_BASE_DELAY_MS = 250

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

/** Options for feed projection sync (retries when `critical` for publish paths). */
export interface SchedulePublicEventFeedSyncOptions {
  /**
   * When true (publish worker / publish CLI only): run a few sync attempts with backoff
   * so transient DB errors do not leave `public_event_feed_items` stale. Does not throw
   * after `image_publish_job_items` is already COMPLETED — see `public_event_feed_sync_post_publish_exhausted` logs + daily reconcile.
   */
  critical?: boolean
}

export interface ReconcilePublicEventFeedProjectionResult {
  candidateEventCount: number
  upsertedPublicCount: number
  hiddenOrDeletedCount: number
  errorCount: number
  durationMs: number
  status: "ok" | "error"
  errorMessage?: string
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
  preview_storage_key: string | null
  asset_count: number | string
}

export async function syncPublicEventFeedForEvent(
  db: DrizzleClient,
  eventId: string,
  cdn: PublicPreviewCdnConfig = { baseUrl: null, version: null },
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

  const withinWindow = event.event_date ? await isEventWithinFeedWindow(db, event.event_date) : false
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
          card.height,
          card.storage_key
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
          height as preview_height,
          storage_key as preview_storage_key
        from eligible_assets
        order by coalesce(image_date, created_at) desc, asset_id desc
        limit 1
      )
      select
        ep.preview_asset_id,
        ep.preview_width,
        ep.preview_height,
        ep.preview_storage_key,
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

  const previewUrl = resolvePublicStablePreviewUrl(cdn, {
    storageKey: feed.preview_storage_key,
    assetId: feed.preview_asset_id,
    variant: "card",
  })
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
    where event_date is null
      or event_date < now() - (${windowDays}::int * interval '1 day')
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
  options?: SchedulePublicEventFeedSyncOptions & { cdn?: PublicPreviewCdnConfig },
): Promise<void> {
  if (!eventId) return
  await runPublicEventFeedSyncWithRetries(db, eventId, Boolean(options?.critical), options?.cdn)
}

export async function schedulePublicEventFeedSyncForAsset(
  db: DrizzleClient,
  assetId: string,
  previousEventId?: string | null,
  options?: SchedulePublicEventFeedSyncOptions & { cdn?: PublicPreviewCdnConfig },
): Promise<void> {
  const rows = await executeRows<{ event_id: string | null }>(
    db,
    sql`select event_id from image_assets where id = ${assetId}::uuid limit 1`,
  )
  const currentEventId = rows[0]?.event_id ?? null
  const eventIds = new Set<string>()
  if (previousEventId) eventIds.add(previousEventId)
  if (currentEventId) eventIds.add(currentEventId)
  const critical = Boolean(options?.critical)
  const cdn = options?.cdn
  await Promise.all([...eventIds].map((id) => runPublicEventFeedSyncWithRetries(db, id, critical, cdn)))
}

/**
 * Repairs `public_event_feed_items` when it lags behind real public-ready assets (e.g. post-publish sync missed).
 * Intended for the daily Worker cron after age-based cleanup.
 */
export async function reconcilePublicEventFeedProjectionDrift(
  db: DrizzleClient,
  options?: { limit?: number; cdn?: PublicPreviewCdnConfig },
): Promise<ReconcilePublicEventFeedProjectionResult> {
  const startedAt = Date.now()
  const limit = Math.min(Math.max(options?.limit ?? 250, 1), 2000)
  const half = Math.ceil(limit / 2)

  try {
    const hiddenButEligible = await executeRows<{ event_id: string }>(
      db,
      sql`
        select distinct f.event_id::text as event_id
        from public_event_feed_items f
        inner join photo_events pe on pe.id = f.event_id
        where pe.status = 'ACTIVE'
          and f.is_public = false
          and exists (
            select 1
            from image_assets a
            ${joinPublicCardDerivative("a", "card")}
            where a.event_id = f.event_id
              and ${publicAssetPredicate("a")}
          )
        limit ${half}
      `,
    )

    const missingRowButEligible = await executeRows<{ event_id: string }>(
      db,
      sql`
        select pe.id::text as event_id
        from photo_events pe
        where pe.status = 'ACTIVE'
          and pe.event_date is not null
          and pe.event_date >= now() - (${PUBLIC_EVENT_FEED_WINDOW_DAYS}::int * interval '1 day')
          and not exists (select 1 from public_event_feed_items f where f.event_id = pe.id)
          and exists (
            select 1
            from image_assets a
            ${joinPublicCardDerivative("a", "card")}
            where a.event_id = pe.id
              and ${publicAssetPredicate("a")}
          )
        limit ${half}
      `,
    )

    const orderedIds: string[] = []
    const seen = new Set<string>()
    for (const row of [...hiddenButEligible, ...missingRowButEligible]) {
      if (!row.event_id || seen.has(row.event_id)) continue
      seen.add(row.event_id)
      orderedIds.push(row.event_id)
      if (orderedIds.length >= limit) break
    }

    let upsertedPublicCount = 0
    let hiddenOrDeletedCount = 0
    let errorCount = 0

    for (const eventId of orderedIds) {
      try {
        const result = await syncPublicEventFeedForEvent(db, eventId, options?.cdn)
        if (result.action === "upserted" && result.isPublic) upsertedPublicCount += 1
        else if (result.action === "hidden" || result.action === "deleted") hiddenOrDeletedCount += 1
      } catch {
        errorCount += 1
      }
    }

    return {
      candidateEventCount: orderedIds.length,
      upsertedPublicCount,
      hiddenOrDeletedCount,
      errorCount,
      durationMs: Date.now() - startedAt,
      status: "ok",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      candidateEventCount: 0,
      upsertedPublicCount: 0,
      hiddenOrDeletedCount: 0,
      errorCount: 0,
      durationMs: Date.now() - startedAt,
      status: "error",
      errorMessage: message,
    }
  }
}

async function runPublicEventFeedSyncWithRetries(
  db: DrizzleClient,
  eventId: string,
  critical: boolean,
  cdn: PublicPreviewCdnConfig = { baseUrl: null, version: null },
): Promise<void> {
  const maxAttempts = critical ? POST_PUBLISH_SYNC_ATTEMPTS : 1
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await syncPublicEventFeedForEvent(db, eventId, cdn)
      console.info(
        JSON.stringify({
          event: "public_event_feed_sync",
          eventId,
          action: result.action,
          isPublic: result.isPublic,
          status: "ok",
          attempt,
          maxAttempts,
        }),
      )
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        JSON.stringify({
          event: "public_event_feed_sync",
          eventId,
          status: "error",
          attempt,
          maxAttempts,
          errorMessage: message,
        }),
      )
      if (attempt < maxAttempts) await sleep(POST_PUBLISH_SYNC_BASE_DELAY_MS * attempt)
    }
  }

  if (critical) {
    const message = lastError instanceof Error ? lastError.message : String(lastError)
    console.error(
      JSON.stringify({
        event: "public_event_feed_sync_post_publish_exhausted",
        eventId,
        errorMessage: message,
        mitigation: "Daily reconcilePublicEventFeedProjectionDrift should repair projection rows",
      }),
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isEventWithinFeedWindow(
  db: DrizzleClient,
  eventDate: Date | string,
): Promise<boolean> {
  const rows = await executeRows<{ within_window: boolean }>(
    db,
    sql`
      select (${eventDate}::timestamptz >= now() - (${PUBLIC_EVENT_FEED_WINDOW_DAYS}::int * interval '1 day')) as within_window
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
