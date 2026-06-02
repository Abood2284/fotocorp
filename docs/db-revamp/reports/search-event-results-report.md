# Search Event Results Report

Date: 2026-05-30

## Summary

Added clickable **Events** results on the public `/search` page. Users can switch between **Images** (default grid) and **Events** (grouped event cards). Event cards link to `/assets/[representativeAssetId]` — no event detail route was created.

## Existing Search Behavior

- Public search uses Typesense via `GET /api/v1/search/assets` (BFF: `/api/public/search/assets`) when `NEXT_PUBLIC_USE_TYPESENSE_SEARCH=true`.
- Asset search queries `event_title`, `caption`, `who_is_in_picture`, `people`, `keywords`, `category_name`, and `fotokey`.
- Filters: `status:=ACTIVE`, `visibility:=PUBLIC`, plus category/event/city/year/month filters from the search page.
- Frontend: `SearchExperience` renders image grid/card views with page pagination (50 per page).
- Previously, the **Events** count showed the total number of filter-panel events (or `1` when an event filter was active), not unique matching events for the query.

## New Event-Results Behavior

- **Images tab** (default): unchanged image masonry/grid behavior, filters, and pagination.
- **Events tab** (`?mode=events`): fetches grouped event results for the active query and filters. The page no longer performs the initial asset-search SSR fetch when rendering event mode.
- Each event card shows preview, title, date/location, and matching asset count.
- Clicking a card opens `/assets/[representativeAssetId]` using the top grouped Typesense hit for that `event_id`.
- Event count in the header comes from the grouped Typesense search (`foundEvents`), not filter-panel totals.

## Typesense Grouping Strategy

Single Typesense request per event search:

| Parameter | Value |
|---|---|
| `group_by` | `event_id` |
| `group_limit` | `1` |
| `group_missing_values` | `false` |
| `query_by` | Same as asset search |
| `filter_by` | Same as asset search plus `event_date_ts:>0` |
| `sort_by` | Event-specific sort (`event_date_ts` for newest/oldest; `_text_match,event_date_ts` for relevance) |

- **Representative asset:** first hit in each group (`group_limit=1`), sorted by event date for browse results.
- **Matching asset count:** each grouped hit’s `found` field (documents in that event group).
- **Total unique events (`foundEvents`):** Typesense top-level `found` after filtering out null-event legacy assets.
- **Timeout:** `TYPESENSE_EVENT_SEARCH_TIMEOUT_MS` (default **8000ms**; asset search remains 1500ms).
- **Optimization:** removed `facet_by=event_id` + `max_facet_values=65536` (caused 502 timeouts and incorrect counts when combined with `group_by`).
- No Postgres asset queries; no `/api/v1/assets` usage.

## Endpoints Added

| Method | API | BFF |
|---|---|---|
| `GET` | `/api/v1/search/events` | `/api/public/search/events` |

Query params mirror asset search: `q`, `categoryId`/`category`, `eventId`/`event`, `city`, `year`, `month`, `sort`, `page`, `limit` (default 50 from parser; frontend uses 25 for event pages).

Response shape:

```json
{
  "query": "salman khan",
  "page": 1,
  "limit": 25,
  "foundEvents": 10,
  "totalPages": 1,
  "hasMore": false,
  "items": [
    {
      "eventId": "uuid",
      "eventTitle": "Some Event Title",
      "eventDate": "2026-05-17T12:00:00.000Z",
      "eventLocation": "Mumbai",
      "matchingAssetCount": 736,
      "representativeAssetId": "uuid",
      "previewUrl": "https://...",
      "previewWidth": 300,
      "previewHeight": 200
    }
  ]
}
```

Implementation:

- `apps/api/src/lib/search/typesense-public-event-search.ts`
- `apps/api/src/routes/public/catalog-routes.ts`
- `apps/web/src/lib/api/fotocorp-api.ts` (`searchPublicEvents`)
- `apps/web/src/components/search/search-event-results-grid.tsx`
- `apps/web/src/components/search/search-experience.tsx`

## Frontend Behavior

- Header metrics **Images | Events** act as tabs (`ResultMetric` buttons).
- URL param: `mode=events` (default images omits param).
- Switching tabs resets page to 1.
- View toggle (grid/card) hidden in events mode.
- Event count fetched via lightweight `limit=1` query while on Images tab; full event list when on Events tab.

## Event Click Behavior

Event cards use:

```tsx
href={`/assets/${representativeAssetId}`}
```

No `/event/[eventId]` or `/events/[eventId]` route was created or used.

## Typesense Reindex

**Not required.** Existing `public_assets_current` documents already include `event_id` (facetable), `event_title`, `event_date_ts`, `event_location`, `city`, and preview fields (`apps/api/scripts/search/index-public-assets-typesense.ts`).

## Schema Changes

**None.**

## `/api/v1/assets` Usage

**Not used** for event grouping or event search.

## Verification

| Check | Result |
|---|---|
| Unit tests: event URL builder + response mapper | Pass (`apps/api/test/typesense-public-event-search.test.ts`) |
| Unit tests: existing asset search mapping | Pass (`apps/api/test/typesense-public-assets.test.ts`) |
| No new event route | Confirmed |
| Event cards link to `/assets/[representativeAssetId]` | Implemented in `SearchEventResultsGrid` |
| Image search endpoint unchanged | Confirmed — `/api/v1/search/assets` untouched |

Live queries (`q=salman khan`, `q=cricket`, category filters) require Typesense + API runtime with production-like data; run manually against staging when available:

```bash
curl "/api/v1/search/events?q=salman%20khan&page=1&limit=25"
curl "/api/public/search/events?q=salman%20khan&page=1&limit=25"
```

## Pagination Note

Event pagination uses Typesense `page` / `per_page` over **groups** (not documents). Default event page size on the web is 25 vs 50 for images, matching the spec example.
