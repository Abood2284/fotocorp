# Homepage Hero Sets Projection

Date: 2026-05-30

## 1. Problem summary

The marketing homepage `GET /` blocked server rendering on:

```txt
listPublicAssets({ limit: 80, sort: "newest" })
  -> GET /api/v1/assets?limit=80&sort=newest
```

Local investigation ([`homepage-root-ttfb-investigation.md`](./homepage-root-ttfb-investigation.md)) measured ~11.8s inside that fetch and ~14.2s total root TTFB. The generic catalog list runs a heavy SQL path (broad joins, `event_asset_count`, compatibility ordering) for data the hero only needs as nine card preview URLs.

## 2. New tables

Migration: [`apps/api/drizzle/0037_public_homepage_hero_sets.sql`](../../apps/api/drizzle/0037_public_homepage_hero_sets.sql)

### `public_homepage_hero_sets`

- `id`, `set_key` (unique), `active_from`, `active_until`, `generated_at`, `generation_run_id`, `created_at`
- Index `(active_from, active_until)` for active-window lookup
- Check `active_until > active_from`

### `public_homepage_hero_set_items`

- `set_id` → `public_homepage_hero_sets` (cascade)
- `asset_id` → `image_assets` (cascade)
- `slot` (unique per set), denormalized `preview_url`, `title`, `event_id`, `event_name`, `fotokey`
- Index `(set_id, slot)`

## 3. Job command

```bash
pnpm --dir apps/api homepage:refresh-hero-sets
pnpm --dir apps/api homepage:refresh-hero-sets -- --day 2026-05-31 --dry-run
```

**Behavior:**

- Defaults to the **next UTC calendar day** (`--day YYYY-MM-DD` optional).
- Builds 96 sets per day (15-minute windows) with up to 9 items each.
- Selects candidates from a bounded pool (`HOMEPAGE_HERO_CANDIDATE_POOL_SIZE`, default 500) using public-ready predicates and indexed newest ordering; shuffles per set in application code (no `ORDER BY random()`).
- Replaces rows for the target UTC day window in one transaction.

**Scheduled run (operator / external cron, not Worker `scheduled`):**

```bash
0 3 * * * cd /path/to/fotocorp && pnpm --dir apps/api homepage:refresh-hero-sets
```

Worker cron at `0 3 * * *` remains reserved for lightweight `public_event_feed_items` cleanup only.

**Env (optional):**

- `HOMEPAGE_HERO_CANDIDATE_POOL_SIZE` (default 500)
- `HOMEPAGE_HERO_SET_SIZE` (default 9)
- `HOMEPAGE_HERO_SET_INTERVAL_MINUTES` (default 15)

## 4. Endpoint added

```txt
GET /api/v1/public/homepage/hero-set
```

- Owner: [`apps/api/src/routes/public/homepage-routes.ts`](../../apps/api/src/routes/public/homepage-routes.ts)
- Reader: [`apps/api/src/lib/assets/public-homepage-hero-set.ts`](../../apps/api/src/lib/assets/public-homepage-hero-set.ts)
- Does **not** call `listPublicAssets` or `/api/v1/assets`
- Active set: `active_from <= now() AND active_until > now()`
- Fallback: latest set with `active_from <= now()`
- Empty DB: `200` with `items: []`

**Web BFF:** `GET /api/public/homepage/hero-set` → same upstream route.

## 5. Cache behavior

API and BFF:

```txt
Cache-Control: public, max-age=300, s-maxage=900, stale-while-revalidate=3600
```

Browser client uses TanStack Query with 5-minute stale time. Next.js server `getJson` uses `revalidate: 300` when called from RSC (hero is client-only today).

## 6. Before / after homepage timing

| Request | Before (investigation) | After (expected) |
| --- | ---: | ---: |
| `GET /` TTFB | ~14.2s (blocked on `/api/v1/assets`) | Near shell/layout only; hero loads after hydration |
| `GET /api/v1/public/homepage/hero-set` | n/a | Small projection read (ms–low hundreds ms) |

Verify locally:

```bash
curl -w "\nTTFB:%{time_starttransfer}s TOTAL:%{time_total}s\n" -o /tmp/home.html -s http://localhost:3000/
curl -w "\nTTFB:%{time_starttransfer}s TOTAL:%{time_total}s\n" -o /tmp/hero-set.json -s http://127.0.0.1:8787/api/v1/public/homepage/hero-set
```

Run migration + refresh before expecting hero images:

```bash
pnpm --dir apps/api db:migrate
pnpm --dir apps/api homepage:refresh-hero-sets -- --day $(date -u +%Y-%m-%d)
```

## 7. Homepage no longer calls `/api/v1/assets`

- [`apps/web/src/app/(marketing)/page.tsx`](../../apps/web/src/app/(marketing)/page.tsx) is synchronous; no `listPublicAssets`.
- Hero images load via [`HomeHeroBackdropLoader`](../../apps/web/src/components/marketing/home-hero-backdrop-loader.tsx) → `fetchPublicHomepageHeroSet()` → `/api/public/homepage/hero-set`.
- There should be **no** homepage-triggered request to `/api/v1/assets?limit=80&sort=newest`.

## 8. Deferred follow-ups

- `public_asset_cards` projection for catalog cards
- `/api/v2/public/assets` compatibility cutover
- Generic `/api/v1/assets` newest-query optimization (`EXPLAIN`, order-by index alignment, trim `event_asset_count`)
- Optional: remove marketing layout `headers()` if root HTML cacheability becomes a goal
