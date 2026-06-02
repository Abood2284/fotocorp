# Public Route Cache Audit

Date: 2026-05-29

## Scope

This audit covers public web/API caching and navigation behavior for homepage event feeds, creative featured assets, public search, public asset lists, public asset detail metadata, auth/session lookups, and staff auth checks.

## Route Caller Inventory

| Route | Caller | Caller type | Current behavior | New behavior / status |
| --- | --- | --- | --- | --- |
| `/api/public/assets` | `apps/web/src/lib/api/fotocorp-api.ts` via `listPublicAssets()` in browser contexts | same-origin BFF proxy | DB-backed compatibility route; slow for query listing such as `q=News` | No longer used by homepage Editorial or Creative sections. Remaining use is compatibility/event/category/related listing. Query/search UI should use `/api/public/search/assets`. |
| `/api/public/assets/:assetId` | Available through `apps/web/src/app/api/public/[...path]/route.ts` | same-origin BFF proxy | Previously unmapped by the BFF | Maps to `/api/v1/assets/:assetId`; public/live metadata responses use `public, max-age=300, s-maxage=2592000, stale-while-revalidate=604800`. |
| `/api/public/search/assets` | `/search` through `SearchExperience` and `searchPublicAssets()`; query-driven public search links | client component via same-origin BFF proxy | Live web layer returned `private, no-store`; client refetched on back navigation | `GET` and `HEAD` explicitly preserve/set `public, max-age=30, s-maxage=120, stale-while-revalidate=300`. `/search` uses TanStack Query keyed by full search params with 60s stale time and keeps previous results while revalidating. |
| `/api/public/events/latest` | `HomeCategorySection` via `fetchPublicLatestEvents()` | public client component via same-origin BFF proxy | Live web layer returned `private, no-store` for `GET`/`HEAD` | `GET` and `HEAD` explicitly preserve/set `public, max-age=60, s-maxage=300, stale-while-revalidate=3600`. Supports `section=latest|news|sports|entertainment|retro`, `limit`, `windowDays`, and `cursor`. |
| `/api/public/creative/featured` | `HomeCategorySection` Creative tab via `fetchCreativeFeaturedAssets()` | public client component via same-origin BFF proxy | New route | Maps to `/api/v1/public/creative/featured`; reads precomputed monthly rows from `public_creative_featured_items`, limit 50, cache `public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800`. |
| `/api/public/homepage/hero-set` | `HomeHeroBackdropLoader` via `fetchPublicHomepageHeroSet()` | public client component via same-origin BFF proxy | New route | Maps to `/api/v1/public/homepage/hero-set`; reads `public_homepage_hero_sets` + items only. Homepage SSR does not call `/api/v1/assets`. Cache `public, max-age=300, s-maxage=900, stale-while-revalidate=3600`. |
| `/api/v1/assets/:assetId` | `getPublicAsset()` from `apps/web/src/app/(marketing)/assets/[id]/page.tsx`; optional direct API verification | public page SSR/API route | Public metadata route, previously shorter cache | Returns public metadata and preview URLs only with `public, max-age=300, s-maxage=2592000, stale-while-revalidate=604800`. Entitlement/download state remains separate. |
| `/api/v1/public/events/latest` | `apps/api/src/routes/public/homepage-routes.ts`, reached through BFF | API public route | Projection-backed latest events | Adds section filtering using `public_event_feed_items` plus lightweight event/category joins; keeps public feed cache and latency logging. |
| `/api/v1/public/creative/featured` | `apps/api/src/routes/public/homepage-routes.ts`, reached through BFF | API public route | New route | Reads active rows for the current `YYYY-MM` period from `public_creative_featured_items`, then joins only those asset ids to public metadata and preview URLs. No full-catalog request-time sort. |
| `/api/v1/search/assets` | `apps/api/src/routes/public/catalog-routes.ts`, reached through BFF | API public route | Typesense-backed public search | Returns public anonymous cache header `public, max-age=30, s-maxage=120, stale-while-revalidate=300`; no entitlement, staff fields, quota, or original URLs. |
| `/api/auth/get-session` | `apps/web/src/lib/app-user.ts` / protected account and download flows | auth/session logic | Must remain private | Public marketing layout and asset detail page no longer block initial render on this route. Protected routes and download checks retain private auth behavior. |
| `/api/v1/staff/auth/me` | `apps/web/src/lib/staff-session.ts` through staff layouts/helpers | staff-only auth logic | Must remain private | Public marketing layout no longer calls staff auth. Staff dashboard/auth behavior remains unchanged. |

## Homepage Behavior

The public marketing shell no longer fetches Better Auth or staff auth before rendering. `apps/web/src/app/(marketing)/layout.tsx` renders a public header state immediately; session/staff state remains limited to protected or staff-only route groups and download/account actions.

After render, the public header uses one shared TanStack Query session lookup (`["auth-session"]`) with 5 minute stale time and 10 minute GC time. Desktop and mobile account controls share that cache, so public homepage should make at most one client-side `/api/auth/get-session` call and must not call `/api/v1/staff/auth/me`.

Homepage Editorial now renders one active event grid:

- Latest: latest editorial events.
- News: latest News events.
- Sports: latest Sports events.
- Entertainment: latest Entertainment events.
- Retro: latest Retro/archive events.

The old lower News/Sports/Entertainment/Retro asset sections and their `/api/public/assets?q=...` calls were removed from the homepage-critical path. Event cards link to the existing gallery/search route with `eventId`.

The Creative tab uses `/api/public/creative/featured?limit=50`, backed by precomputed rows for the current month and cacheable for 30 days at the shared edge. When no rows exist, the UI shows a controlled empty state:

```text
Creative picks are being prepared.
Browse latest editorial coverage or check back soon.
```

The refresh command is:

```bash
pnpm --dir apps/api creative:refresh-featured -- --period 2026-05 --limit 50
```

Eligibility currently prefers assets whose asset/event category name is Creative. If no clear Creative category coverage exists, the documented temporary fallback fills the feed from `ACTIVE + PUBLIC` image assets with ready `CARD` and `DETAIL` previews, ordered by indexed/stable `created_at desc, id asc`; it does not use `random()` or request-time `md5()` sorting.

Editorial section tabs fetch only the selected section. Initial homepage load requests only `section=latest`; News/Sports/Entertainment/Retro fetch on selection. A selected section first requests a recent 30-day window, then widens to 365 days if empty, and finally shows a section-specific empty state instead of silently substituting Creative assets.

## Search Back Navigation

`apps/web/src/components/search/search-experience.tsx` now uses TanStack Query for public search data:

- query key: `["public-search-assets", normalizedSearchParams]`
- `staleTime: 60_000`
- `gcTime: 5 * 60_000`
- `refetchOnWindowFocus: false`
- `placeholderData: keepPreviousData`

The `/search` page renders a lightweight shell and lets the client query `/api/public/search/assets`. Results remain visible during revalidation, asset links preserve current search params, and scroll position is stored/restored when navigating from `/search` to `/assets/:id` and back.

## Asset Detail Split

Cacheable public detail data remains on `/api/v1/assets/:assetId` and `/api/public/assets/:assetId`:

- asset id
- public title/caption/headline fields
- event/category/city/date metadata
- public preview derivative URLs
- related public assets already fetched by public list/search routes

Uncached/private state remains outside public metadata:

- session
- entitlement/download quota
- original download URL
- staff-only fields
- private storage keys or signed original URLs

Download checks continue through the existing same-origin download preflight/action routes.

## Cache Invalidation

Staff metadata and publish-state updates now call `invalidatePublicAssetCache()` in `apps/api/src/lib/cache/public-cache-invalidation.ts`.

When `PUBLIC_WEB_ORIGIN`, `CLOUDFLARE_CACHE_PURGE_ZONE_ID`, and `CLOUDFLARE_CACHE_PURGE_API_TOKEN` are configured, the hook purges targeted URLs:

- `/assets/:assetId`
- `/api/public/assets/:assetId`
- `/api/v1/assets/:assetId`
- `/api/public/events/latest`
- `/api/v1/public/events/latest`
- `/search?eventId=<eventId>` when an event is known

If purge configuration is missing, the hook logs `public_cache_invalidation_skipped` with the exact paths and a TODO. It does not globally purge everything.

## Static And Preview Cache Headers

| Asset type | Expected/cache behavior | Notes |
| --- | --- | --- |
| `/_next/static/*` | `public, max-age=31536000, immutable` | Build-hashed assets should be immutable. Verify on the deployed host because OpenNext/Cloudflare own final static headers. |
| CDN preview derivatives from `PUBLIC_PREVIEW_CDN_BASE_URL` | Suitable for long immutable CDN caching when versioned by `PUBLIC_PREVIEW_CDN_VERSION` or stable storage key | JSON payloads do not expose R2 keys. |
| Stable fallback preview route `/api/media/assets/:id/preview/:variant` | `public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800` | Not content-hashed, so it intentionally avoids `immutable`. |

## Verification Commands

Replace `https://www.fotocorp.com` and IDs with the target environment values.

### Public Latest Events

```bash
curl -I "https://www.fotocorp.com/api/public/events/latest?windowDays=30&limit=15"
```

```bash
curl -sD - -o /dev/null "https://www.fotocorp.com/api/public/events/latest?windowDays=30&limit=15"
```

Expected:

```text
cache-control: public, max-age=60, s-maxage=300, stale-while-revalidate=3600
```

### Sectioned Latest Events

```bash
curl -sD - -o /dev/null "https://www.fotocorp.com/api/public/events/latest?section=news&windowDays=365&limit=15"
```

```bash
curl -w "\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" -o /dev/null -s "https://www.fotocorp.com/api/public/events/latest?section=sports&windowDays=365&limit=15"
```

### Public Search

```bash
curl -I "https://www.fotocorp.com/api/public/search/assets?page=1"
```

```bash
curl -sD - -o /dev/null "https://www.fotocorp.com/api/public/search/assets?page=1"
```

Expected:

```text
cache-control: public, max-age=30, s-maxage=120, stale-while-revalidate=300
```

```bash
curl -I "https://www.fotocorp.com/api/public/search/assets?eventId=<eventId>"
```

```bash
curl -w "\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" -o /dev/null -s "https://www.fotocorp.com/api/public/search/assets?eventId=<eventId>"
```

### Creative Featured

```bash
pnpm --dir apps/api creative:refresh-featured -- --period 2026-05 --limit 50
```

```bash
curl -I "https://www.fotocorp.com/api/public/creative/featured?limit=50"
```

Expected:

```text
cache-control: public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800
```

```bash
curl -w "\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" -o /dev/null -s "https://www.fotocorp.com/api/public/creative/featured?limit=50"
```

Expected locally after warmup:

```text
Total < 1000ms
No client_timeout_15s
```

### Old Slow Route

```bash
curl -w "\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" -o /dev/null -s "https://www.fotocorp.com/api/public/assets?q=News&limit=15&sort=newest"
```

Expected:

```text
This route must not be used by homepage-critical UI anymore.
```

### Homepage

Open the homepage and confirm:

```text
GET / logs do not include auth_session
GET / logs do not include staff_auth
Editorial tabs show event cards, not lower asset-section grids
Initial network requests include section=latest only; other sections load on selection
Public homepage makes at most one client-side /api/auth/get-session request
```

### Search Navigation

Manual browser test:

```text
1. Open /search
2. Wait for results
3. Scroll down
4. Open an asset detail page
5. Go back
6. Confirm results are still visible immediately
7. Confirm scroll position is restored
8. Confirm no full blank-state refetch occurs
```

### Asset Detail Metadata

```bash
curl -I "https://www.fotocorp.com/api/v1/assets/<assetId>"
```

```bash
curl -I "https://www.fotocorp.com/api/public/assets/<assetId>"
```

Expected for a public/live asset:

```text
cache-control: public, max-age=300, s-maxage=2592000, stale-while-revalidate=604800
```

### Preview Image URL

```bash
curl -I "https://www.fotocorp.com/api/media/assets/<assetId>/preview/card"
```

```bash
curl -w "\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" -o /dev/null -s "https://www.fotocorp.com/api/media/assets/<assetId>/preview/card"
```

### Static Asset

```bash
curl -I "https://www.fotocorp.com/_next/static/<build-asset-path>"
```

```bash
curl -w "\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" -o /dev/null -s "https://www.fotocorp.com/_next/static/<build-asset-path>"
```

## Remaining Risks

- `/api/public/assets` remains available for compatibility and may still be slow for arbitrary query searches. Public search/listing UI should prefer `/api/public/search/assets`.
- Section filtering depends on existing event category names. If the projection needs richer section ownership later, extend `public_event_feed_items` with source-domain category fields instead of joining asset tables.
- Creative featured is precomputed monthly and prefers Creative category names when present. A curated staff list would be a better long-term product source.
- Targeted Cloudflare purge is inactive until purge env vars are configured.
