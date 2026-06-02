# Homepage Event Category Source Investigation

Date: 2026-05-30  
Database: Neon project `Fotocorp` (`tiny-thunder-19900347`), **Development branch** `br-steep-sun-ao0nw2cc`  
Note: the default `production` branch in Neon contains only `neon_auth` tables; all app-table evidence below comes from Development.

## Executive Summary

| Question | Answer |
|----------|--------|
| Where does homepage category filtering look today? | `photo_events.category_id → asset_categories.name` (joined at query time; not stored in `public_event_feed_items`) |
| Is that field populated? | **No for legacy data.** `1 / 50,001` events have `category_id` set |
| Where does real category data live? | **`image_assets.category_id → asset_categories.id`**, populated during legacy import from per-image `imagecatid` / `categoryid` |
| Why are category tabs empty? | Browse filters on empty `photo_events.category_id`, and the feed projection currently contains only **one** public row |
| Can browse work without schema changes? | **Not with the current query path.** Smallest truthful fix: **backfill `photo_events.category_id`** from a verified per-event source (recommended: dominant public `image_assets.category_id`) |

**Conclusion: B — not possible without backfill** (for the current `photo_events.category_id` browse filter).

---

## 1. Homepage Latest Flow

### End-to-end path

```txt
Homepage Latest tab
  → apps/web/src/components/marketing/home-category-section.tsx
      fetchHomepageEventsSection("latest")
      → fetchPublicLatestEvents({ windowDays: 30, limit: 15, section: "latest" })
  → apps/web/src/lib/api/fotocorp-api.ts
      Browser: GET /api/public/events/latest?windowDays=30&limit=15&section=latest
      SSR:     GET /api/v1/public/events/latest?...
  → apps/web/src/app/api/public/[...path]/route.ts
      Maps events/latest → /api/v1/public/events/latest
      Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=3600
  → apps/api/src/routes/public/homepage-routes.ts
      GET /api/v1/public/events/latest
      Cache-Control: PUBLIC_HOMEPAGE_FEED_CACHE_CONTROL (same as BFF)
  → apps/api/src/lib/assets/public-homepage.ts
      fetchPublicLatestEventsRows → buildLatestEventsSql
  → DB query on public_event_feed_items (+ joins)
```

### Components and helpers

| Layer | File | Role |
|-------|------|------|
| Frontend | `apps/web/src/app/(marketing)/page.tsx` | Renders `HomeCategorySection` |
| Frontend | `apps/web/src/components/marketing/home-category-section.tsx` | Latest tab; limit 15; 30-day window |
| Web API | `apps/web/src/lib/api/fotocorp-api.ts` → `fetchPublicLatestEvents()` | Same-origin BFF in browser; direct API in SSR |
| BFF | `apps/web/src/app/api/public/[...path]/route.ts` | Proxy + cache headers |
| API route | `apps/api/src/routes/public/homepage-routes.ts` | Parses query, returns JSON |
| Query | `apps/api/src/lib/assets/public-homepage.ts` | Keyset pagination on feed projection |

### DB source

Primary table: **`public_event_feed_items`** (`f`)

Joins at read time (category is **not** denormalized into the feed table):

```sql
left join photo_events e on e.id = f.event_id
left join asset_categories c on c.id = e.category_id
left join image_derivatives card on card.image_asset_id = f.preview_asset_id
  and card.variant = 'CARD' and card.generation_status = 'READY'
```

Latest filters:

- `f.is_public = true`
- `f.event_date is not null`
- `f.event_date >= now() - (windowDays * 1 day)` (default 30)
- **No category filter** when `section=latest`
- Order: `event_date desc, event_id desc`
- Keyset cursor: `{ eventDate, id }` (base64 JSON)

### Cache headers

| Layer | Cache-Control |
|-------|---------------|
| API | `public, max-age=60, s-maxage=300, stale-while-revalidate=3600` |
| Web BFF | Same |

### Response shape

`PublicLatestEventsResponse`:

```json
{
  "items": [{
    "id": "uuid",
    "title": "string",
    "slug": null,
    "eventDate": "ISO8601 | null",
    "createdAt": "ISO8601",
    "assetCount": 40,
    "location": "string | null",
    "categoryName": "Entertainment | null",
    "previewUrl": "string",
    "previewWidth": 300,
    "previewHeight": 200
  }],
  "nextCursor": "string | null",
  "hasMore": false,
  "generatedAt": "ISO8601"
}
```

---

## 2. Homepage Category Tab Flow (Current)

### End-to-end path

```txt
News / Sports / Entertainment / Retro tab
  → home-category-section.tsx
      fetchPublicEventCategoryBrowse({ limit: 25, section })
  → fotocorp-api.ts
      Browser: GET /api/public/events/browse?section=...&limit=25
  → BFF route.ts
      Maps events/browse → /api/v1/public/events/browse
      Cache-Control: public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400
  → homepage-routes.ts
      GET /api/v1/public/events/browse
  → public-homepage.ts
      fetchPublicEventCategoryBrowseRows → buildEventCategoryBrowseSql
  → DB: public_event_feed_items + same joins as Latest
```

### Category filter (current code)

`latestEventsSectionWhere()` in `public-homepage.ts`:

| Section | SQL filter on `asset_categories.name` via `photo_events.category_id` |
|---------|------------------------------------------------------------------------|
| news | `lower(coalesce(c.name, '')) = 'news'` |
| sports | `lower(coalesce(c.name, '')) = 'sports'` |
| entertainment | `lower(coalesce(c.name, '')) = 'entertainment'` |
| retro | `lower(c.name) = 'retro' OR lower(c.name) LIKE '%archive%'` |

Browse differs from Latest only by:

- No `windowDays` predicate in SQL
- Default `limit=25`
- Heavier cache TTL (30-day CDN cache policy)

**Important operational constraint:** although browse SQL has no date window, **`public_event_feed_items` is maintained for a 30-day rolling window only** (sync eligibility + daily cleanup). Browse cannot surface events outside that projection retention without changing projection policy or querying a different source.

---

## 3. `public_event_feed_items` Purpose and Population

### Purpose

Denormalized **Latest/public homepage event feed projection**:

- One row per `photo_events.id`
- Stores title, dates, asset count, preview asset/URL, `is_public`
- **Does not store category/section** — category is joined from `photo_events` at read time

Schema: `apps/api/src/db/schema/public-event-feed-items.ts`  
Migration: `apps/api/drizzle/0033_public_event_feed_items.sql`

### Writers

| Trigger | Location |
|---------|----------|
| Per-event sync | `apps/api/src/lib/assets/public-event-feed-projection.ts` → `syncPublicEventFeedForEvent()` |
| Publish completion | `apps/jobs/src/services/imagePublishProcessor.ts`, `apps/api/scripts/media/process-image-publish-jobs.ts` |
| Asset publish / editorial changes | `admin-catalog.ts`, `admin-events.ts`, contributor event service |
| Daily cleanup + drift repair | `apps/api/src/lib/assets/public-event-feed-scheduled.ts` (cron `0 3 * * *`) |

Duplicate implementation for jobs worker: `apps/jobs/src/lib/public-event-feed-projection.ts`

### Eligibility rules (`syncPublicEventFeedForEvent`)

An event is upserted as public when **all** are true:

1. `photo_events.status = 'ACTIVE'`
2. `event_date` within **30 days** (`PUBLIC_EVENT_FEED_WINDOW_DAYS = 30`)
3. At least one eligible public asset with a ready watermarked CARD derivative

Otherwise: row hidden (`is_public=false`) or deleted (if outside window).

### Rebuild / backfill

- **Rebuildable:** yes — `syncPublicEventFeedForEvent` per event, daily `reconcilePublicEventFeedProjectionDrift`, and one-time SQL documented in `docs/db-revamp/reports/pr-public-event-feed-projection-report.md`
- **Not a full historical archive:** daily `deleteOldPublicEventFeedItems` removes rows with `event_date` older than 30 days

### Why Development has only one row

Verified counts on Development branch:

| Metric | Count |
|--------|------:|
| Total `public_event_feed_items` rows | 1 |
| Public rows | 1 |
| Public rows in last 30 days | 1 |
| ACTIVE events in last 30 days with public-ready CARD assets | 1 |

The projection is working as coded; Development simply has **one recently published public event** in the 30-day window. Reconcile can only upsert candidates inside that window.

### Category data in projection

Intentionally excluded. Category for display/filter is resolved via:

```txt
public_event_feed_items.event_id → photo_events.category_id → asset_categories.name
```

---

## 4. Where Event Category Is Actually Stored

### Tables inspected

#### `photo_events`

Relevant columns: `category_id` (uuid FK → `asset_categories`), `legacy_payload` (jsonb)

| Metric | Value |
|--------|------:|
| Total rows | 50,001 |
| `category_id IS NOT NULL` | **1** (0.002%) |
| ACTIVE rows | 49,422 |
| ACTIVE with `category_id` | **1** |
| `legacy_payload->>'catid'` | `NULL` (26,249), `'0'` (23,751), missing (1) — **no usable legacy event category** |

Legacy sync (`PHOTO_EVENTS_UPSERT` in `apps/api/scripts/legacy/sync-clean-schema-after-import.ts`) copies from `asset_events` and **never sets `category_id`**.

`category_id` on `photo_events` is used for **contributor/Fotocorp portal-created events** (`apps/api/src/routes/contributor/events/service.ts`).

#### `asset_categories`

18 rows; homepage sections map to:

| Name | `legacy_category_code` | UUID (excerpt) |
|------|------------------------|----------------|
| News | 1 | `9e362ccd-7fc3-4c37-ae65-6e0ff908bbf2` |
| Sports | 4 | `2063714a-59da-4861-b372-c3416eb154de` |
| Entertainment | 5 | `a72b0672-699e-4380-baf4-92a6209913f8` |
| Retro | 37 | `82ba7b49-86fb-4abb-b70b-f4317b1f29ab` |

All four homepage section names exist as first-class category rows.

#### `asset_events`

50,000 rows aligned 1:1 with `photo_events.id` for legacy imports.  
**No `category_id` column.** Event-level category was never imported here.

#### `image_assets`

| Metric | Value |
|--------|------:|
| Total rows | 733,067 |
| With `event_id` | 666,459 |
| With `category_id` | 663,565 (99.6% of linked assets) |
| With `legacy_category_id` | 0 |

Category populated during legacy import from per-image fields:

```txt
assets.category_id ← legacy imagecatid/categoryid
  → image_assets.category_id (via IMAGE_ASSETS_UPSERT)
```

See `resolveRelations()` in `apps/api/scripts/legacy/import-legacy-fotocorp.ts`.

#### `assets` (legacy staging)

668,389 rows with event link; 665,493 have `category_id`.  
Legacy `legacy_payload->>'catid'` on `assets` is null for all rows in Development (category stored in resolved UUID column instead).

### Reliable relations found

| Path | Event-level? | Populated? | Used by homepage browse? |
|------|--------------|------------|--------------------------|
| `photo_events.category_id → asset_categories` | Yes | **1 row** | **Yes (current filter)** |
| `image_assets.category_id → asset_categories` | Per asset | **~664k assets** | **No** |
| `assets.category_id → asset_categories` | Per asset (legacy) | ~665k | No |
| `asset_events → category` | — | **No column** | No |
| `photo_events.legacy_payload.catid` | — | **Not usable** | No |
| Code hardcoded mapping | — | Section name → exact match on `asset_categories.name` | Yes |

### Catalog precedent (not used by homepage browse)

Public catalog code already treats category as **asset-first, event fallback**:

```txt
coalesce(image_assets.category_id, photo_events.category_id)
```

See `apps/api/src/lib/assets/public-assets.ts` and `public-homepage-assets.ts`.  
Homepage event browse **does not** use this coalesce pattern.

### Derived event category (not stored)

Using dominant `image_assets.category_id` per event (mode by asset count):

| Dominant category | Distinct events |
|-------------------|----------------:|
| news | 12,971 |
| sports | 2,213 |
| entertainment | 10,755 |
| retro | 548 |

Caveat: **1,561 events** have public-facing assets spanning more than one of the four homepage sections. Any dominant-category rule is an inference policy, not a stored event attribute.

---

## 5. Trace: “Song launch of film Cocktail 2”

| Field | Value |
|-------|-------|
| `photo_events.id` | `a74e456d-5f82-447d-8d2d-7210cfb43c51` |
| `source` | `Fotocorp` |
| `created_by_source` | `CONTRIBUTOR` |
| `status` | `ACTIVE` |
| `event_date` | 2026-05-17 |
| `photo_events.category_id` | `a72b0672-...` → **Entertainment** |
| `legacy_payload.catid` | null |
| In `public_event_feed_items` | **Yes**, `is_public=true`, has preview |
| `image_assets` on event | 40 assets, all `ACTIVE`/`PUBLIC`, all category **Entertainment** |

### Why it appears on Latest

1. It is the **only** ACTIVE event in the last 30 days with at least one public-ready watermarked CARD asset on Development.
2. `syncPublicEventFeedForEvent` upserted it into `public_event_feed_items`.
3. Latest reads that projection with the 30-day window filter.

### Category source for this event

- **Stored at event level:** yes — `photo_events.category_id` set at contributor event creation (2026-05-20).
- **Consistent with assets:** all 40 linked `image_assets` also point to Entertainment.
- **It is currently the only event** for which the homepage category filter path (`photo_events.category_id`) can match.

Without `photo_events.category_id`, this event would still appear on Latest (feed projection does not filter by category) but would **not** appear under Entertainment browse.

---

## 6. Category Availability Report (Development branch)

### A. Category records in `asset_categories`

All four sections exist (see §4).

### B. Events linked via `photo_events.category_id` (current browse filter)

| Section | Matching events in feed | Matching events overall |
|---------|------------------------:|------------------------:|
| news | 0 | 0 |
| sports | 0 | 0 |
| entertainment | **1** | **1** |
| retro | 0 | 0 |

Current browse endpoint results: News/Sports/Retro → empty; Entertainment → 1 item.

### C. Events linked via `image_assets.category_id` (asset-level truth)

Events with ≥1 public-ready asset in category (any event date):

| Section | Events with public-ready assets |
|---------|--------------------------------:|
| news | 14,969 |
| sports | 2,713 |
| entertainment | 12,731 |
| retro | 549 |

These counts describe **asset-level** category membership aggregated to events, not the current browse query.

### D. Preview image availability

Browse/Latest both require feed preview fields populated from public CARD derivatives.  
For the single current feed row, preview data is present.  
For hypothetical backfilled categories, preview availability follows the same feed eligibility rules (public asset + ready CARD).

### E. Browse without schema changes?

| Approach | Schema change? | Truthful? | Notes |
|----------|----------------|-----------|-------|
| Current: `photo_events.category_id` filter on feed | No | Yes for 1 event | Empty for legacy corpus |
| Switch filter to dominant `image_assets.category_id` | No | Inference; 1,561 mixed events | Code change only; not stored event category |
| Backfill `photo_events.category_id` from dominant asset category | No | Best match to stored legacy data | Smallest data fix; enables current SQL |
| Add `category_id` to `public_event_feed_items` | **Yes** | — | Out of scope |

---

## 7. Re-verification of Stated Known Facts

| Fact | Verified? | Evidence |
|------|-----------|----------|
| `public_event_feed_items` has no category fields | **Yes** | Schema + SQL `\d` equivalent |
| Feed powers Latest/homepage public events | **Yes** | `buildLatestEventsSql` source table |
| `photo_events.category_id` mostly NULL | **Yes** | 1 / 50,001 |
| `asset_categories` contains News, Sports, etc. | **Yes** | 18 rows, 4 section names present |
| `photo_events.legacy_payload.catid` only NULL/0 | **Yes** | Counts above |
| Latest works | **Yes** | 1 public feed row in 30-day window |
| Category tabs need a real relationship | **Yes** | Browse filters on empty event category |

**Corrections / additions:**

- Category **does** exist reliably at **`image_assets.category_id`**, not at event level.
- `public_event_feed_items` currently has **1 row total** on Development (not merely “limited” — essentially unpopulated except one recent contributor event).
- Browse is capped to **~30 days of feed retention** even without a SQL window, because projection sync and cleanup enforce it.

---

## 8. Can Category Browse Work Today?

### Conclusion: **B — Not possible without backfill**

The implemented browse path is:

```txt
public_event_feed_items
  → photo_events.category_id
  → asset_categories.name (exact section match)
```

That path is **empty for legacy events** (49,999 / 50,000 missing `category_id`).

Entertainment returns one item only because the sole feed row is the one contributor event with `category_id` set.

### Why not conclusion A (possible now)?

There is no populated **event-level** relation for News/Sports/Retro/Entertainment on `photo_events`.  
Asset-level category exists but is **not wired into browse** and is not an event attribute.

Using dominant asset category in SQL would be a **query redesign + inference policy**, not use of an existing event category source.

### Why not conclusion C (no relationship anywhere)?

Category relationships **do exist** at `image_assets.category_id → asset_categories`.  
The gap is specifically **event-level denormalization** (`photo_events.category_id`) that browse already expects.

---

## 9. Safest Next Implementation Recommendation

### Step 1 — Backfill event category (no schema change)

Populate `photo_events.category_id` for legacy events from a verified source:

```sql
-- Proposed policy: dominant public asset category per event
-- Tie-break: highest asset count, then lowest legacy_category_code
WITH ranked AS (
  SELECT
    ia.event_id,
    ia.category_id,
    COUNT(*) AS cnt,
    ROW_NUMBER() OVER (
      PARTITION BY ia.event_id
      ORDER BY COUNT(*) DESC, MIN(ac.legacy_category_code) ASC
    ) AS rn
  FROM image_assets ia
  JOIN asset_categories ac ON ac.id = ia.category_id
  WHERE ia.event_id IS NOT NULL
    AND ia.category_id IS NOT NULL
    AND ia.status = 'ACTIVE'
    AND ia.visibility = 'PUBLIC'
  GROUP BY ia.event_id, ia.category_id
)
UPDATE photo_events pe
SET category_id = ranked.category_id,
    updated_at = now()
FROM ranked
WHERE ranked.event_id = pe.id
  AND ranked.rn = 1
  AND pe.category_id IS NULL;
```

Run on a Neon branch first; review mixed-category events (1,561) before production.

Also backfill contributor events going forward in publish/sync hooks so new events stay aligned.

### Step 2 — Populate feed projection for eligible 30-day events

Run drift reconcile / one-time feed backfill so `public_event_feed_items` contains all eligible recent public events, not just post-publish incremental rows. Without this, even correct categories only browse events already in the feed (currently 1 on Development).

### Step 3 — Keep browse query unchanged initially

After backfill, existing browse SQL should begin returning section-filtered results without touching Latest.

Optional later: align browse filter with catalog `coalesce(asset.category_id, event.category_id)` if event backfill is incomplete.

### Do not do

- Keyword/title-based section guessing
- `/api/v1/assets` for event browse
- Total counts
- Latest route/cache changes
- Schema changes to add category to feed table (unless denormalization is explicitly scoped)

---

## Appendix: Key Files

| Area | Path |
|------|------|
| Latest + browse SQL | `apps/api/src/lib/assets/public-homepage.ts` |
| Feed sync | `apps/api/src/lib/assets/public-event-feed-projection.ts` |
| API routes | `apps/api/src/routes/public/homepage-routes.ts` |
| Web BFF | `apps/web/src/app/api/public/[...path]/route.ts` |
| Homepage UI | `apps/web/src/components/marketing/home-category-section.tsx` |
| Legacy import relations | `apps/api/scripts/legacy/import-legacy-fotocorp.ts` |
| Legacy schema sync | `apps/api/scripts/legacy/sync-clean-schema-after-import.ts` |
| Contributor event category write | `apps/api/src/routes/contributor/events/service.ts` |
