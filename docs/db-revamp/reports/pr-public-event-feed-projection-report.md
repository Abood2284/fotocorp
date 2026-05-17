# PR: Public event feed projection (Latest Events)

## 1. Table added

Migration `apps/api/drizzle/0033_public_event_feed_items.sql` creates `public_event_feed_items`:

- Primary key `event_id` → `photo_events(id)` ON DELETE CASCADE
- Denormalized event fields: `title`, `event_date`, `created_at`
- Feed fields: `asset_count`, `preview_asset_id`, `preview_width`, `preview_height`, `preview_url`
- Visibility: `is_public`, `last_computed_at`, `updated_at`
- Partial index `public_event_feed_items_public_created_idx` on `(created_at DESC, event_id DESC) WHERE is_public = true`

Drizzle schema: `apps/api/src/db/schema/public-event-feed-items.ts`.

## 2. Backend maintenance

`apps/api/src/lib/assets/public-event-feed-projection.ts`:

- `syncPublicEventFeedForEvent(eventId)` — loads event, applies 30-day + ACTIVE + public asset + clean CARD rules, upserts or hides/deletes projection row
- `deleteOldPublicEventFeedItems({ windowDays })` — deletes rows older than the window by `created_at`
- `schedulePublicEventFeedSync` / `schedulePublicEventFeedSyncForAsset` — non-throwing wrappers with structured logs

Preview URL uses `buildPublicStablePreviewPath` → `/api/media/assets/{assetId}/preview/card` (same stable public path as the rest of the homepage feed).

## 3. Flows that call `syncPublicEventFeedForEvent`

| Flow | Location |
|------|----------|
| Staff asset publish / unpublish (single) | `updateInternalAdminAssetPublish` in `admin-catalog.ts` |
| Staff asset publish bulk | via `updateInternalAdminAssetPublish` |
| Staff editorial / `event_id` change (single + bulk) | `updateInternalAdminAssetEditorial`, `updateInternalAdminAssetEditorialBulk` |
| Admin event update | `updateInternalAdminEvent` in `admin-events.ts` |
| Contributor event create / patch | `contributor/events/service.ts` |
| Publish job completion (API script) | `scripts/media/process-image-publish-jobs.ts` |
| Publish job completion (VPS jobs worker) | `apps/jobs/src/services/imagePublishProcessor.ts` |
| CARD derivative batch upsert (backfill script) | `scripts/media/generate-watermarked-derivatives.ts` when a ready `card` variant is written |

Event purge deletes `photo_events` → projection row cascades via FK.

Daily cleanup: Cloudflare cron `0 3 * * *` → `scheduled` in `apps/api/src/index.ts` → `runPublicEventFeedCleanup`.

## 4. No one-time script

Initial fill is operator-run SQL in Neon only (see §5). Ongoing correctness is maintained by the sync hooks above.

## 5. One-time Neon SQL (backfill)

Run after `pnpm --dir apps/api db:migrate` in the Neon SQL editor. Preview path matches `buildPublicStablePreviewPath` (`/api/media/assets/.../preview/card`):

```sql
WITH eligible_assets AS (
  SELECT
    a.event_id,
    a.id AS asset_id,
    a.image_date,
    a.created_at,
    card.width,
    card.height
  FROM image_assets a
  JOIN image_derivatives card
    ON card.image_asset_id = a.id
   AND card.variant = 'CARD'
   AND card.generation_status = 'READY'
   AND card.is_watermarked = false
   AND card.watermark_profile = 'fotocorp-card-clean-v1'
  WHERE a.status = 'ACTIVE'
    AND a.visibility = 'PUBLIC'
    AND a.media_type = 'IMAGE'
    AND a.original_exists_in_storage = true
),
event_counts AS (
  SELECT
    event_id,
    count(*)::int AS asset_count
  FROM eligible_assets
  GROUP BY event_id
),
event_previews AS (
  SELECT DISTINCT ON (event_id)
    event_id,
    asset_id AS preview_asset_id,
    width AS preview_width,
    height AS preview_height
  FROM eligible_assets
  ORDER BY event_id, coalesce(image_date, created_at) DESC, asset_id DESC
),
upserted AS (
  INSERT INTO public_event_feed_items (
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
  SELECT
    e.id AS event_id,
    e.name AS title,
    e.event_date,
    e.created_at,
    ec.asset_count,
    ep.preview_asset_id,
    ep.preview_width,
    ep.preview_height,
    '/api/media/assets/' || ep.preview_asset_id::text || '/preview/card' AS preview_url,
    true AS is_public,
    now() AS last_computed_at,
    now() AS updated_at
  FROM photo_events e
  JOIN event_counts ec ON ec.event_id = e.id
  JOIN event_previews ep ON ep.event_id = e.id
  WHERE e.status = 'ACTIVE'
    AND e.created_at >= now() - interval '30 days'
  ON CONFLICT (event_id) DO UPDATE SET
    title = excluded.title,
    event_date = excluded.event_date,
    created_at = excluded.created_at,
    asset_count = excluded.asset_count,
    preview_asset_id = excluded.preview_asset_id,
    preview_width = excluded.preview_width,
    preview_height = excluded.preview_height,
    preview_url = excluded.preview_url,
    is_public = excluded.is_public,
    last_computed_at = excluded.last_computed_at,
    updated_at = excluded.updated_at
  RETURNING event_id
),
deleted_old AS (
  DELETE FROM public_event_feed_items
  WHERE created_at < now() - interval '30 days'
  RETURNING event_id
)
SELECT
  (SELECT count(*) FROM upserted) AS upserted_rows,
  (SELECT count(*) FROM deleted_old) AS deleted_old_rows,
  (
    SELECT count(*)
    FROM public_event_feed_items
    WHERE is_public = true
      AND created_at >= now() - interval '30 days'
  ) AS public_last_30_days_rows;
```

## 6. Backfill result counts

_Fill after running SQL in Neon:_

| Metric | Value |
|--------|-------|
| `upserted_rows` | _TBD_ |
| `deleted_old_rows` | _TBD_ |
| `public_last_30_days_rows` | _TBD_ |

## 7. Scheduled cleanup

- Wrangler: `"triggers": { "crons": ["0 3 * * *"] }`
- Handler: `runPublicEventFeedCleanup` logs `{ event: "public_event_feed_cleanup", windowDays, deletedOldRows, durationMs, status }`
- Deletes `public_event_feed_items` where `created_at < now() - interval '30 days'`

## 8. Projection row counts

_After backfill, run in Neon:_

```sql
SELECT
  count(*) AS total_projection_rows,
  count(*) FILTER (WHERE is_public = true) AS public_rows,
  min(created_at) AS oldest_created_at,
  max(created_at) AS newest_created_at
FROM public_event_feed_items;
```

## 9. Latest Events API timing

| Phase | Before (live joins) | After (projection) |
|-------|---------------------|---------------------|
| Warm DB | ~1.7–2.4s | _TBD — target &lt;100–200ms local_ |
| Handler overhead | negligible | negligible |

```bash
curl -sS -o /dev/null \
  -w "status=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s size=%{size_download}\n" \
  "http://127.0.0.1:8787/api/v1/public/events/latest?windowDays=30&limit=15"
```

Latency trace: `queryName: "public_latest_events_projection"`, `projection: true`, `sourceTable: "public_event_feed_items"`.

## 10. Web proxy timing

```bash
bash scripts/diagnostics/homepage-latency.sh
```

_Record BFF/proxy segment before vs after backfill._

## 11. Endpoint returns 15 events?

```bash
curl -s "http://127.0.0.1:8787/api/v1/public/events/latest?windowDays=30&limit=15" \
  | jq '{count: (.items|length), hasMore, first: .items[0]}'
```

Expected: `count: 15` when ≥15 eligible projection rows exist.

## 12. If fewer than 15

Document exact cause:

- Not enough `ACTIVE` events with `created_at` in last 30 days
- No public `ACTIVE` image assets with `original_exists_in_storage`
- No ready clean CARD derivative (`fotocorp-card-clean-v1`, not watermarked)
- Backfill not run yet (projection empty)

## 13. Deployment order

1. Deploy migration `0033_public_event_feed_items.sql`
2. Run one-time Neon SQL backfill (§5)
3. Verify projection rows (§8, missing-preview and old-row queries below)
4. Deploy API + jobs worker with maintenance wiring
5. Test `GET /api/v1/public/events/latest` and homepage
6. Confirm cron `0 3 * * *` is active on the API Worker

### Verification SQL

```sql
SELECT count(*) AS public_last_30_days
FROM public_event_feed_items
WHERE is_public = true
  AND created_at >= now() - interval '30 days';

SELECT count(*) AS public_rows_missing_preview
FROM public_event_feed_items
WHERE is_public = true
  AND (
    preview_asset_id IS NULL
    OR preview_url IS NULL
    OR preview_url = ''
  );

SELECT count(*) AS old_projection_rows
FROM public_event_feed_items
WHERE created_at < now() - interval '30 days';
```

Expected after backfill + cleanup: `public_rows_missing_preview = 0`, `old_projection_rows = 0`.
