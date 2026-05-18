/**
 * Post-publish sync for `public_event_feed_items`.
 *
 * Logic aligned with `apps/api/src/lib/assets/public-event-feed-projection.ts`
 * but uses the jobs `pg` pool so the Docker image does not depend on `apps/api`.
 */
import type { Pool } from "pg"
import { getJobsPool } from "../db/client"
import { CARD_CLEAN_PROFILE } from "./watermarkProfile"

export const PUBLIC_EVENT_FEED_WINDOW_DAYS = 30

const POST_PUBLISH_SYNC_ATTEMPTS = 3
const POST_PUBLISH_SYNC_BASE_DELAY_MS = 250

export interface SchedulePublicEventFeedSyncOptions {
  critical?: boolean
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

function buildPublicStablePreviewPath(assetId: string, variant: "card"): string {
  return `/api/media/assets/${encodeURIComponent(assetId)}/preview/${variant}`
}

function publicAssetPredicate(alias: string): string {
  return `${alias}.status = 'ACTIVE' and ${alias}.visibility = 'PUBLIC' and ${alias}.media_type = 'IMAGE' and ${alias}.original_exists_in_storage = true`
}

function joinPublicCardDerivativeSql(assetAlias: string, cardAlias: string, profileParam: string): string {
  return `join image_derivatives ${cardAlias}
    on ${cardAlias}.image_asset_id = ${assetAlias}.id
    and ${cardAlias}.variant = 'CARD'
    and ${cardAlias}.generation_status = 'READY'
    and ${cardAlias}.is_watermarked = false
    and ${cardAlias}.watermark_profile = ${profileParam}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isEventWithinFeedWindow(pool: Pool, createdAt: Date | string): Promise<boolean> {
  const { rows } = await pool.query<{ within_window: boolean }>(
    `select ($1::timestamptz >= now() - ($2::int * interval '1 day')) as within_window`,
    [createdAt, PUBLIC_EVENT_FEED_WINDOW_DAYS],
  )
  return Boolean(rows[0]?.within_window)
}

async function syncPublicEventFeedForEvent(pool: Pool, eventId: string): Promise<void> {
  const eventResult = await pool.query<EventRow>(
    `select id::text as id, name, event_date, created_at, status
     from photo_events
     where id = $1::uuid
     limit 1`,
    [eventId],
  )
  const event = eventResult.rows[0]
  if (!event) return

  const withinWindow = await isEventWithinFeedWindow(pool, event.created_at)
  const eventEligible = event.status === "ACTIVE" && withinWindow

  if (!eventEligible) {
    if (!withinWindow) {
      await pool.query(`delete from public_event_feed_items where event_id = $1::uuid`, [eventId])
      return
    }

    await pool.query(
      `insert into public_event_feed_items (
        event_id, title, event_date, created_at, asset_count,
        preview_asset_id, preview_width, preview_height, preview_url,
        is_public, last_computed_at, updated_at
      ) values (
        $1::uuid, $2, $3, $4, 0,
        null, null, null, '',
        false, now(), now()
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
        updated_at = now()`,
      [eventId, event.name, event.event_date, event.created_at],
    )
    return
  }

  const feedSql = `
    with eligible_assets as (
      select
        a.id as asset_id,
        a.image_date,
        a.created_at,
        card.width,
        card.height
      from image_assets a
      ${joinPublicCardDerivativeSql("a", "card", "$2")}
      where a.event_id = $1::uuid
        and ${publicAssetPredicate("a")}
    ),
    event_counts as (
      select count(*)::int as asset_count from eligible_assets
    ),
    event_previews as (
      select asset_id as preview_asset_id, width as preview_width, height as preview_height
      from eligible_assets
      order by coalesce(image_date, created_at) desc, asset_id desc
      limit 1
    )
    select
      ep.preview_asset_id::text as preview_asset_id,
      ep.preview_width,
      ep.preview_height,
      ec.asset_count
    from event_counts ec
    left join event_previews ep on true
  `

  const feedResult = await pool.query<FeedPreviewRow>(feedSql, [eventId, CARD_CLEAN_PROFILE])
  const feed = feedResult.rows[0]
  const assetCount = Number(feed?.asset_count ?? 0)

  if (!feed?.preview_asset_id || assetCount < 1) {
    await pool.query(
      `insert into public_event_feed_items (
        event_id, title, event_date, created_at, asset_count,
        preview_asset_id, preview_width, preview_height, preview_url,
        is_public, last_computed_at, updated_at
      ) values (
        $1::uuid, $2, $3, $4, 0,
        null, null, null, '',
        false, now(), now()
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
        updated_at = now()`,
      [eventId, event.name, event.event_date, event.created_at],
    )
    return
  }

  const previewUrl = buildPublicStablePreviewPath(feed.preview_asset_id, "card")
  await pool.query(
    `insert into public_event_feed_items (
      event_id, title, event_date, created_at, asset_count,
      preview_asset_id, preview_width, preview_height, preview_url,
      is_public, last_computed_at, updated_at
    ) values (
      $1::uuid, $2, $3, $4, $5,
      $6::uuid, $7, $8, $9,
      true, now(), now()
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
      updated_at = now()`,
    [
      eventId,
      event.name,
      event.event_date,
      event.created_at,
      assetCount,
      feed.preview_asset_id,
      feed.preview_width,
      feed.preview_height,
      previewUrl,
    ],
  )
}

async function runPublicEventFeedSyncWithRetries(
  pool: Pool,
  eventId: string,
  critical: boolean,
): Promise<void> {
  const maxAttempts = critical ? POST_PUBLISH_SYNC_ATTEMPTS : 1
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await syncPublicEventFeedForEvent(pool, eventId)
      console.info(
        JSON.stringify({
          event: "public_event_feed_sync",
          eventId,
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

export async function schedulePublicEventFeedSyncForAsset(
  databaseUrl: string,
  assetId: string,
  previousEventId?: string | null,
  options?: SchedulePublicEventFeedSyncOptions,
): Promise<void> {
  const pool = getJobsPool(databaseUrl)
  const { rows } = await pool.query<{ event_id: string | null }>(
    `select event_id::text as event_id from image_assets where id = $1::uuid limit 1`,
    [assetId],
  )
  const currentEventId = rows[0]?.event_id ?? null
  const eventIds = new Set<string>()
  if (previousEventId) eventIds.add(previousEventId)
  if (currentEventId) eventIds.add(currentEventId)
  const critical = Boolean(options?.critical)
  await Promise.all([...eventIds].map((id) => runPublicEventFeedSyncWithRetries(pool, id, critical)))
}
