# Homepage Root TTFB Investigation

Date: 2026-05-30

## Summary

The root homepage `GET /` is slow because server rendering awaits the homepage hero candidate fetch from the generic public catalog endpoint:

```txt
apps/web/src/app/(marketing)/page.tsx
HomePage() -> listPublicAssets({ limit: 80, sort: "newest" })
```

That call resolves server-side to:

```txt
GET /api/v1/assets?limit=80&sort=newest
```

The current run shows the homepage spending **11.8s** inside that asset fetch before returning HTML. The API breakdown shows the time is not JSON parsing or DTO mapping; it is the main SQL query in `/api/v1/assets`.

## Exact Responsible Path

- Homepage render: `apps/web/src/app/(marketing)/page.tsx`
  - `HomePage()` awaits `listPublicAssets({ limit: HERO_ASSET_POOL_LIMIT, sort: "newest" })`.
  - `HERO_ASSET_POOL_LIMIT = 80`, `HERO_ITEMS_LIMIT = 9`.
- Web API helper: `apps/web/src/lib/api/fotocorp-api.ts`
  - `listPublicAssets()` builds `limit=80&sort=newest`.
  - On the server, `resolveAssetsPath()` returns `/api/v1/assets`.
- API route: `apps/api/src/routes/public/catalog-routes.ts`
  - `GET /api/v1/assets` calls `listPublicAssets()` from `apps/api/src/lib/assets/public-assets.ts`.
- API query builder: `apps/api/src/lib/assets/public-assets.ts`
  - `buildListSql()` uses `selectAssetSql()`, `fromAssetSql()`, `buildWhere()`, and `orderBySql("newest")`.
  - The SQL includes public asset predicates, card/thumb/detail derivative joins, category/event/contributor joins, a per-row `event_asset_count` subquery, and ordering by `coalesce(e.event_date, a.image_date, a.created_at) desc, a.id desc`.

## Local Timings Captured

Commands run with the local web/API dev servers started under homepage latency instrumentation:

```bash
HOMEPAGE_DEBUG_LATENCY=true NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787 PUBLIC_API_BASE_URL=http://127.0.0.1:8787 pnpm --filter web dev
HOMEPAGE_DEBUG_LATENCY=true pnpm --filter @fotocorp/api dev
```

Measured curl timings:

| Request | TTFB | Total |
| --- | ---: | ---: |
| `http://localhost:3000/` | 14.185523s | 14.190625s |
| `http://localhost:8787/api/v1/assets?limit=80&sort=newest` | 12.707992s | 12.837089s |
| `http://localhost:8787/api/v1/public/events/latest?windowDays=30&limit=15&section=latest` | 1.765785s | 1.770924s |
| `http://localhost:8787/api/v1/assets?limit=9&sort=newest` | 8.875700s | 8.877159s |
| `http://localhost:8787/api/v1/assets?limit=1&sort=newest` | 8.293216s | 8.293564s |

The `limit=1` and `limit=9` timings show that the generic newest listing query itself is expensive even when response size is tiny.

## Timeline: `GET /`

Relevant structured logs:

```json
{"event":"homepage_render_step","step":"fetch_hero_candidates_start","source":"public_assets","poolLimit":80,"limit":9,"sort":"newest"}
{"event":"homepage_render_step","step":"api_fetch_start","route":"/api/v1/assets","requestPath":"/api/v1/assets?limit=80&sort=newest"}
{"event":"homepage_render_step","step":"api_fetch_done","route":"/api/v1/assets","durationMs":11819,"status":200,"cacheControl":"public, max-age=30, s-maxage=120, stale-while-revalidate=300"}
{"event":"homepage_render_step","step":"api_json_parse_done","route":"/api/v1/assets","durationMs":25,"totalMs":11844}
{"event":"homepage_render_step","step":"list_public_assets_request_done","route":"/api/v1/assets","durationMs":11847,"normalizeMs":1,"rowCount":80,"hasMore":true}
{"event":"homepage_render_step","step":"fetch_hero_candidates_done","durationMs":11848,"status":"ok","rowCount":80,"hasMore":true}
{"event":"homepage_render_step","step":"homepage_page_return","durationMs":11849,"heroItemCount":9}
```

Next's request line for the same run:

```txt
GET / 200 in 14.2s (next.js: 1076ms, proxy.ts: 621ms, application-code: 12.5s)
```

Conclusion: `GET /` is blocked on the hero candidate `listPublicAssets()` await before the HTML response can finish.

## Timeline: `/api/v1/assets`

Relevant structured logs for the homepage-triggered assets request:

```json
{"event":"public_assets_latency_step","route":"/api/v1/assets","step":"cdn_config_parse_done","durationMs":0,"cdnConfigured":true}
{"event":"public_assets_latency_step","route":"/api/v1/assets","step":"request_parse_done","durationMs":0,"limit":80,"sort":"newest","hasQuery":false,"hasCursor":false,"hasCategoryId":false,"hasEventId":false,"hasContributorId":false}
{"event":"public_assets_latency_step","route":"/api/v1/assets","step":"main_db_query_start","limit":81,"sort":"newest"}
{"event":"public_assets_latency_step","route":"/api/v1/assets","step":"main_db_query_done","durationMs":11267,"rowCount":81}
{"event":"public_assets_latency_step","route":"/api/v1/assets","step":"pagination_slice_done","durationMs":0,"rowCount":80,"hasMore":true}
{"event":"public_assets_latency_step","route":"/api/v1/assets","step":"result_mapping_done","durationMs":0,"rowCount":80}
{"event":"public_assets_latency_step","route":"/api/v1/assets","step":"response_build_done","durationMs":0,"totalDurationMs":11267,"rowCount":80,"hasMore":true,"responseBytes":92883}
{"event":"public_assets_latency_step","route":"/api/v1/assets","step":"route_complete","durationMs":11267,"rowCount":80,"hasMore":true}
```

Conclusion: `/api/v1/assets` spends the missing time in the main DB query. Request parsing, CDN config parsing, pagination slicing, DTO mapping, and response building are effectively zero in this run. JSON parse on the web side was 25ms.

## Is Latest Events Involved?

No. The latest-events endpoint is not blocking the root HTML in the current homepage implementation. `HomeCategorySection` is a client component and fetches latest events through TanStack Query after hydration.

The local API trace for latest events was:

```json
{"event":"latency_trace","route":"/api/v1/public/events/latest","status":"ok","durationMs":149,"timings":{"parse":0,"db":149,"map":0,"response_build":0,"total":149},"db":{"rowCount":1,"queryName":"public_latest_events_projection","sourceTable":"public_event_feed_items","windowDays":30,"limit":15,"section":"latest"}}
```

Wrangler's outer request timing for that curl was about 1.76s, still far below the root document and public-assets timings.

## What `/api/v1/assets` Is Doing That Homepage Hero Does Not Need

For the homepage hero, the page only needs a small set of image IDs, titles/hrefs, and card preview URLs. The generic public catalog list currently does substantially more:

- Builds the full public catalog DTO.
- Joins `CARD`, `THUMB`, and optionally `DETAIL` derivative rows.
- Joins categories, events, and contributors.
- Computes `event_asset_count` with a per-row correlated count subquery.
- Supports generic query/category/event/contributor/year/month/cursor modes.
- Orders by `coalesce(e.event_date, a.image_date, a.created_at) desc, a.id desc`, which does not directly match the existing `image_assets_public_newest_idx` on `image_date desc, created_at desc`.
- Returns 80 rows and about 92.9 KB of JSON for a server render that only displays 9 hero panels.

The measured `limit=1` request still spent 7.89s in the main DB query, so response size and DTO mapping are not the primary cause.

## Why `latency_trace public_shell` Was Misleading

`apps/web/src/app/(marketing)/layout.tsx` logs `GET /` shell timing after the marketing shell builds the header/footer wrapper. That trace currently measures only the shell/layout step:

```txt
public_shell: 364ms
```

It does not include the child page's awaited hero asset fetch. Next's own request line includes the complete route render and correctly reported:

```txt
application-code: 12.5s
```

## Dynamic Route and Cache-Control Findings

The root marketing route is dynamic today because `apps/web/src/app/(marketing)/layout.tsx` calls `headers()` to resolve/log a request id. That is enough for Next/OpenNext to treat the document as request-specific and emit:

```txt
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
```

The public asset fetch itself uses `next: { revalidate: 30 }` on the server and the API returns public cache headers, but the final HTML remains private/no-store because the route render is dynamic. Cloudflare caching may hide or expose the pain depending on deployment behavior, but the proven root cause is application render work awaiting a slow generic catalog query.

## Recommended Fix Options

1. Stop homepage SSR from awaiting `/api/v1/assets`.
   - Safest immediate PR: render the homepage hero with fallback/static placeholders or move hero image hydration client-side so the document can return without the generic catalog query.

2. Replace hero candidates with a dedicated lightweight homepage/projection endpoint.
   - Reuse or revive a homepage-specific asset query/projection that returns only `{ id, title, href, imageUrl }`.
   - Avoid generic catalog list behavior, `event_asset_count`, broad DTO joins, and full listing compatibility.

3. Remove dynamic blockers before making `/` cacheable.
   - The marketing layout's `headers()` request-id trace must be removed or moved out of the HTML render path before relying on page cacheability.
   - Do not make `/` cacheable while it still depends on request-specific APIs or blocking slow work.

4. Optimize `/api/v1/assets` separately.
   - The generic public catalog list remains important for compatibility and older callers.
   - Its slow newest query should be investigated with `EXPLAIN (ANALYZE, BUFFERS)` against the production-like database, with attention to the `coalesce(e.event_date, a.image_date, a.created_at)` order, derivative joins, and `event_asset_count` subquery.

## Instrumentation Added

Temporary structured logs are behind `HOMEPAGE_DEBUG_LATENCY=true` in the web process. When enabled, the web helper also sends `x-homepage-debug-latency: true` so the API route can emit matching debug logs in local Worker dev, where arbitrary shell env vars are not automatically exposed as Worker bindings.

Files instrumented:

- `apps/web/src/app/(marketing)/page.tsx`
- `apps/web/src/lib/api/fotocorp-api.ts`
- `apps/api/src/routes/public/catalog-routes.ts`
- `apps/api/src/lib/assets/public-assets.ts`
- `apps/api/src/appTypes.ts`

This instrumentation does not change public response shapes, UI, database schema, or route ownership.

## Verification Notes

- `npm --prefix apps/api run check` passed.
- `npm --prefix apps/web run lint` did not complete under the default Node heap; it failed with JavaScript heap out of memory after about 57s.
- The first homepage run before API debug-header propagation hit the existing 15s client timeout and rendered fallback hero panels; the second run captured the successful 11.8s hero asset fetch and 14.2s full root render.
