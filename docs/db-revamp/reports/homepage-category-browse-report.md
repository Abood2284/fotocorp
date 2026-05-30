# Homepage Category Browse Report

Date: 2026-05-30 (updated after `photo_events` source change)

## Summary

Homepage Editorial category tabs (News, Sports, Entertainment, Retro) use:

```txt
GET /api/v1/public/events/browse?section=...&limit=25&cursor=...
GET /api/public/events/browse?section=...&limit=25&cursor=...
```

**Latest** continues to use `public_event_feed_items` via `/api/v1/public/events/latest` (unchanged).

**Category browse** now reads **`photo_events` directly** after `photo_events.category_id` was backfilled from dominant public asset categories (see [`photo-events-category-backfill-report.md`](./photo-events-category-backfill-report.md)).

---

## Why `public_event_feed_items` Was Removed as Category Browse Source

Initial browse implementation reused the Latest feed projection table. That was incorrect because:

1. `public_event_feed_items` is a **30-day rolling Latest/homepage projection**, not an archive catalog.
2. On Development it contained **one row**, so category tabs returned empty even after category backfill populated 13k+ News events on `photo_events`.
3. Category archive browsing should include **all ACTIVE categorized events with public previews**, not only recent feed-eligible rows.

Latest still correctly uses the projection. Browse no longer depends on it.

---

## New Data Source

```txt
photo_events
  join asset_categories on photo_events.category_id = asset_categories.id
```

Filters:

- `photo_events.status = 'ACTIVE'`
- `photo_events.category_id is not null`
- Section: `lower(asset_categories.name) = section` (`news`, `sports`, `entertainment`, `retro`)
- At least one eligible public preview asset exists for the event (see below)

Sort / pagination:

- `photo_events.event_date desc nulls last, photo_events.id desc`
- Keyset cursor: `{ eventDate, id }` (null `event_date` encodes as epoch in cursor)
- Fetch `limit + 1`, return max `limit`, no totals

Implementation: `buildEventCategoryBrowseSql()` in `apps/api/src/lib/assets/public-homepage.ts`.

---

## Preview Lookup Strategy

Preview and `assetCount` are resolved **only for the current page’s event IDs**:

1. CTE `page_events` — paginated `photo_events` matching category + preview existence.
2. CTE `eligible_assets` — `image_assets` where `event_id in (select event_id from page_events)` with `publicAssetPredicate("a")` and `joinPublicCardDerivative("a", "browse_card")` from `public-catalog-sql.ts`.
3. `event_counts` — count eligible assets per event.
4. `event_previews` — `distinct on (event_id)` picking newest asset by `coalesce(image_date, created_at) desc`.

Preview URLs are built with `resolvePublicStablePreviewUrl()` (same as Latest cards). No `/api/v1/assets` call.

---

## Latest Untouched

| Item | Status |
|------|--------|
| `GET /api/v1/public/events/latest` | Unchanged |
| Latest cache `max-age=60, s-maxage=300` | Unchanged |
| `public_event_feed_items` sync/cleanup | Unchanged |
| `home-category-section.tsx` Latest tab | Still uses `fetchPublicLatestEvents()` |

---

## Schema / Asset API

| Constraint | Status |
|------------|--------|
| No schema changes | Confirmed |
| No new tables | Confirmed |
| No `/api/v1/assets` | Confirmed |
| No total counts | Confirmed |
| Homepage hero untouched | Confirmed |

---

## Cache Behavior

Category browse (API + BFF):

```txt
Cache-Control: public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400
```

Latest cache unchanged. During local testing, use DevTools **Disable cache** or `?t=timestamp` because browsers may hold prior empty 24h responses.

---

## Files Changed (browse source update)

- `apps/api/src/lib/assets/public-homepage.ts`
- `apps/api/src/routes/public/homepage-routes.ts`
- `apps/api/docs/api-routing-audit.md`
- `docs/db-revamp/reports/homepage-category-browse-report.md`

---

## Verification

### Static

```bash
pnpm --dir apps/api run check
pnpm --dir apps/api run test
```

### API (cache-buster recommended)

```bash
curl -s -D - "http://127.0.0.1:8787/api/v1/public/events/browse?section=news&limit=25&t=123" -o /tmp/news.json
curl -s -D - "http://127.0.0.1:8787/api/v1/public/events/browse?section=sports&limit=25&t=123" -o /tmp/sports.json
curl -s -D - "http://127.0.0.1:8787/api/v1/public/events/browse?section=entertainment&limit=25&t=123" -o /tmp/ent.json
curl -s -D - "http://127.0.0.1:8787/api/v1/public/events/browse?section=retro&limit=25&t=123" -o /tmp/retro.json
curl -s -D - "http://127.0.0.1:8787/api/v1/public/events/latest?section=latest&limit=15&t=123" -o /tmp/latest.json
```

### Web BFF

```bash
curl -s -D - "http://127.0.0.1:3000/api/public/events/browse?section=news&limit=25&t=123" -o /tmp/bff-news.json
```

Record observed counts in the verification section below after running against Development.

### Expected

- News, Sports, Entertainment, Retro: non-empty `items` (post backfill + public preview assets).
- Each page: ≤ 25 items.
- `hasMore` / `nextCursor` present when more pages exist.
- No `total` / `totalCount` fields.
- Browse cache header: 1-day browser / 30-day edge.
- Latest cache header unchanged.

---

## Verification Results

Local runtime (Neon Development, `2026-05-30`):

| Section | HTTP | items.length | hasMore | Cache-Control |
|---------|------|-------------:|---------|---------------|
| news | 200 | 25 | true | `public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400` |
| sports | 200 | 25 | true | same |
| entertainment | 200 | 25 | true | same |
| retro | 200 | 25 | true | same |
| latest (control) | 200 | 1 | false | `public, max-age=60, s-maxage=300, stale-while-revalidate=3600` |

Additional checks:

- News page 2 via `nextCursor`: 25 items, `hasMore: true`, different first title than page 1.
- No `total` / `totalCount` fields in responses.
- Web BFF `GET /api/public/events/browse?section=news&limit=25&t=123`: 200, 25 items, same category cache header.
- Sample first items: News → “Disha Patani & Aditya Thackeray…”, Sports → “C N Wadia Gold Cup…”, Entertainment → “Song launch of film Cocktail 2”, Retro → “Sanjay Dutt”.

---

## Historical Notes (initial browse PR)

The first browse PR wired UI + BFF + route but read `public_event_feed_items`. That was superseded by this `photo_events` source change after category backfill and source investigation:

- [`homepage-category-source-investigation.md`](./homepage-category-source-investigation.md)
- [`photo-events-category-backfill-report.md`](./photo-events-category-backfill-report.md)
