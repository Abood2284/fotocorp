# Royalty-Free Featured Route Rename Report

Date: 2026-05-30

## Summary

Renamed the public homepage featured feed API from **Creative** to **Royalty-Free** while keeping the old path as a compatibility alias. Added structured timing breakdown logs to locate the ~13s request latency before query optimization.

## Routes

| Role | Path |
|------|------|
| **Canonical (new)** | `GET /api/v1/public/royalty-free/featured` |
| **Compatibility alias** | `GET /api/v1/public/creative/featured` |

Web BFF:

| Role | Path |
|------|------|
| **Canonical (new)** | `GET /api/public/royalty-free/featured` → `/api/v1/public/royalty-free/featured` |
| **Compatibility alias** | `GET /api/public/creative/featured` → `/api/v1/public/creative/featured` |

No HTTP redirects were added. Both API routes invoke the same shared handler (`handleRoyaltyFreeFeaturedRequest`).

## Compatibility behavior

- Old and new routes return the same JSON shape: `{ items, nextCursor, hasMore }`.
- Cache headers unchanged: `public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800`.
- Database table `public_creative_featured_items` and refresh script `creative:refresh-featured` are unchanged (no schema migration in this PR).

## Logging

Event name (both routes): `public_royalty_free_featured_request`

Canonical route:

```json
{
  "event": "public_royalty_free_featured_request",
  "route": "/api/v1/public/royalty-free/featured",
  "legacyRoute": false,
  "durationMs": 0,
  "status": "ok",
  "itemCount": 50,
  "cacheControl": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
  "timings": {
    "query": 0,
    "previewResolve": 0,
    "responseBuild": 0,
    "total": 0
  }
}
```

Legacy alias:

```json
{
  "event": "public_royalty_free_featured_request",
  "route": "/api/v1/public/creative/featured",
  "legacyRoute": true,
  ...
}
```

Timing fields measure:

- `query` — SQL fetch from `public_creative_featured_items` + asset joins
- `previewResolve` — `Promise.all` preview URL / DTO mapping (`toAssetDto`)
- `responseBuild` — assembling `{ items, nextCursor, hasMore }`
- `total` — handler-internal service work (excludes route wrapper overhead; compare with `durationMs` for full request)

## Frontend

- Updated `fetchRoyaltyFreeFeaturedAssets()` in `apps/web/src/lib/api/fotocorp-api.ts` to call `/api/public/royalty-free/featured`.
- `HomeCategorySection` Royalty Free tab uses the new helper and query key `homepage-royalty-free-featured`.
- User-facing copy in the Royalty Free section empty states now says “royalty-free picks” (tab label was already “Royalty Free”).

## Files changed

- `apps/api/src/routes/public/homepage-routes.ts` — shared handler, dual routes, logging
- `apps/api/src/lib/assets/public-assets.ts` — `listPublicRoyaltyFreeFeaturedAssets` + timings
- `apps/web/src/app/api/public/[...path]/route.ts` — BFF path map
- `apps/web/src/lib/api/fotocorp-api.ts` — client fetch helper
- `apps/web/src/components/marketing/home-category-section.tsx` — query + copy
- `apps/api/docs/api-routing-audit.md` — route ownership note
- `context/architecture.md` — public route documentation

## Performance notes (follow-up)

Local verification (2026-05-30, `wrangler dev` on port 8787, remote Neon):

| Route | `durationMs` | `timings.query` | `timings.previewResolve` | `timings.responseBuild` |
|-------|-------------:|----------------:|-------------------------:|------------------------:|
| `/api/v1/public/royalty-free/featured` | 7808 | 7804 | 3 | 0 |
| `/api/v1/public/creative/featured` (legacy) | 7494 | 7489 | 4 | 0 |

The ~7–8s delay is almost entirely in the SQL `query` phase, not preview URL mapping. Next PR should focus on the featured-items join query (plan, indexes, join breadth) rather than `toAssetDto` / CDN URL work.

After deploy, continue comparing `timings.query` vs `timings.previewResolve` on slow requests.

Do not remove `/api/v1/public/creative/featured` until callers and edge caches have migrated.

## Verification

```bash
curl -i "http://localhost:8787/api/v1/public/royalty-free/featured"
curl -i "http://localhost:8787/api/v1/public/creative/featured"
```

Check Worker logs for `public_royalty_free_featured_request` with `timings` on each request.
