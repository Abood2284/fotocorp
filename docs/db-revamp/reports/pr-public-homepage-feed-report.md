# PR: Public homepage feed + stable preview URLs

## Summary

- Added `GET /api/v1/public/homepage` returning up to 12 latest events (last 30 days by `photo_events.created_at`, `event_date` optional) with stable `/api/media/assets/:id/preview/card` URLs (no signed tokens).
- Added stable public preview routes (`/api/media/...` and `/api/v1/media/...` aliases) for thumb/card/detail using existing READY derivative profiles (thumb/card clean, detail watermarked).
- Homepage Editorial → Latest now uses the feed only (event tiles, empty/failure states); removed per-asset masonry from Latest.
- Added partial indexes in `drizzle/0029_public_homepage_feed_indexes.sql` and `drizzle/0030_public_homepage_created_at_idx.sql` (`photo_events.created_at` for homepage feed).

## Verification (local, API on `:8787`)

| Check | Result |
|---|---|
| `GET /api/v1/public/homepage` | 200, ~0.6–1.0s |
| `GET /api/v1/assets/events` (legacy) | 200, ~12–36s (cold/contended) |
| Response shape | `latestEvents`, `generatedAt`; no signed URLs, counts, or asset lists |
| `pnpm --dir apps/api check` | pass |
| `pnpm --dir apps/api smoke:hono-routes` | pass |
| `pnpm --dir apps/web build` | pass |

## EXPLAIN

Run against Neon after applying `0029_public_homepage_feed_indexes.sql`:

```sql
EXPLAIN (ANALYZE, BUFFERS)
-- paste SQL from apps/api/src/lib/assets/public-homepage.ts buildLatestEventsSql()
```

## Notes

- `photo_events` has no `visibility` column; homepage filters use `status = 'ACTIVE'` and public assets via `publicAssetPredicate`.
- Web proxies stable previews at `apps/web/src/app/api/media/assets/[assetId]/preview/[variant]/route.ts`.
