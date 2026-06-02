# Royalty-Free Featured Table Rename and Query Optimization

Date: 2026-05-30

## Table rename

| | Name |
|--|------|
| Old table | `public_creative_featured_items` |
| New table | `public_royalty_free_featured_items` |
| Migration | `apps/api/drizzle/0038_royalty_free_featured_items_rename.sql` |

## Index / constraint renames

- `public_creative_featured_items_pkey` → `public_royalty_free_featured_items_pkey`
- `public_creative_featured_items_period_key_check` → `public_royalty_free_featured_items_period_key_check`
- `public_creative_featured_items_rank_check` → `public_royalty_free_featured_items_rank_check`
- `public_creative_featured_items_status_check` → `public_royalty_free_featured_items_status_check`
- `public_creative_featured_items_asset_id_image_assets_id_fk` → `public_royalty_free_featured_items_asset_id_image_assets_id_fk`
- `public_creative_featured_items_period_rank_uidx` → `public_royalty_free_featured_items_period_rank_uidx`
- `public_creative_featured_items_period_asset_uidx` → `public_royalty_free_featured_items_period_asset_uidx`
- `public_creative_featured_items_active_period_rank_idx` dropped and recreated as `public_royalty_free_featured_items_active_period_rank_idx` (partial index predicate updated for new table name)

**New indexes added:** none (speculative indexes not added).

## Query change

**Before:** `FROM image_assets` + `fromAssetSql()` + late join to featured table → planner scanned ~all public `image_assets` and CARD `image_derivatives` (~7–8 s `timings.query` locally).

**After:** `WITH featured AS MATERIALIZED (... LIMIT 50)` on `public_royalty_free_featured_items`, then `fromRoyaltyFreeFeaturedAssetSql()` joining only those asset IDs.

## Files changed

- `apps/api/drizzle/0038_royalty_free_featured_items_rename.sql`
- `apps/api/drizzle/meta/_journal.json`
- `apps/api/src/db/schema/public-royalty-free-featured-items.ts` (replaces `public-creative-featured-items.ts`)
- `apps/api/src/db/schema/index.ts`
- `apps/api/src/lib/assets/public-assets.ts`
- `apps/api/scripts/public/refresh-royalty-free-featured.ts`
- `apps/api/scripts/public/refresh-creative-featured.ts` (shim)
- `apps/api/package.json`
- `apps/api/docs/api-routing-audit.md`
- `context/architecture.md`
- `context/progress-tracker.md`

## Timing (local wrangler, after deploy)

| Route | `durationMs` | `timings.query` | `timings.previewResolve` |
|-------|-------------:|----------------:|-------------------------:|
| `/api/v1/public/royalty-free/featured` | 661 | 657 | 3 |
| `/api/v1/public/creative/featured` (legacy) | 180 | 176 | 3 |

**Before (same environment, pre-optimization):** `timings.query` ~7804–7489 ms.

**EXPLAIN (ANALYZE)** on optimized shape after rename: **Execution Time ~0.5 ms** DB time (50 featured rows → `image_assets_pkey` + `image_derivatives_ready_card_asset_idx`).

## Risk

Stale featured rows pointing at inactive assets or assets without a ready CARD derivative are omitted by `publicAssetPredicate` / inner CARD join; fewer than 50 items is acceptable (same as before).

## Creative references retained (intentional)

- API route `GET /api/v1/public/creative/featured` (legacy alias)
- BFF path `creative/featured`
- Package script `creative:refresh-featured` (alias to royalty-free refresh script)
- Refresh candidate selection still prefers category name `creative` (precompute logic unchanged)
- TypeScript export alias `publicCreativeFeaturedItems` / `listPublicCreativeFeaturedAssets`
