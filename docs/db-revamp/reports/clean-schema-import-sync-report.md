# PR-07: Clean schema sync after legacy import

## Problem

Legacy import scripts write **old** tables (`photographer_profiles`, `asset_events`, `assets`, `asset_media_derivatives`, import batch/issue tables). Application runtime (catalog, media, admin, downloads) reads **clean** tables (`photographers`, `photo_events`, `image_assets`, `image_derivatives`, clean logs). Without a sync step, new imported rows are invisible to the product.

## Solution

`pnpm --dir apps/api legacy:sync-clean-schema` runs an **idempotent** upsert pipeline:

1. **Photographers** — canonical row per numeric legacy `srno` from `photographer_profiles.legacy_payload`, same ranking as PR-01 (valid email, active status, richness, `created_at`, id).
2. **Assets backfill** — sets `assets.legacy_photographer_id` from `legacy_payload->>'photographid'` when null.
3. **Photo events** — `photo_events.id = asset_events.id`, field mapping per spec, `ON CONFLICT (id) DO UPDATE`.
4. **Image assets** — `image_assets.id = assets.id`, join `photographers` on `legacy_photographer_id`, status/visibility mapping per PR-07, `ON CONFLICT (id) DO UPDATE`.
5. **Image derivatives** — `image_derivatives.id = asset_media_derivatives.id`, variants lowercased from old table mapped to `THUMB` / `CARD` / `DETAIL`, `source = LEGACY_MIGRATION`, join `image_assets` so orphan `asset_id` rows are not inserted.

Old tables are **not** deleted or renamed. Old log tables are **not** synced (runtime writes clean logs only).

## Batch-scoped sync

**Deferred.** `asset_import_batches` / `asset_import_issues` do not tie individual assets to a batch in a way that allows a safe batch-only sync. Passing `--batch-id` logs that batch-specific sync is deferred and runs a **full** idempotent sync (same as no flag).

## Operator workflow

1. Run legacy import as today (`pnpm --dir apps/api legacy:import` or `legacy:import:chunks`).
2. After a **successful** chunked run, the runner invokes `legacy:sync-clean-schema` automatically unless `--no-sync-clean-schema` or `--dry-run`.
3. If a chunk **fails**, sync does **not** run unless `--sync-even-if-issues` (use only when you intentionally want partial old data propagated).
4. Validate: `pnpm --dir apps/api db:validate:clean-sync` plus existing normalization scripts.

## Commands

```bash
pnpm --dir apps/api legacy:sync-clean-schema
pnpm --dir apps/api legacy:sync-clean-schema -- --batch-id <uuid>   # full sync; batch filter deferred
pnpm --dir apps/api db:validate:clean-sync
```

## Risks

- Sync assumes old FK integrity (e.g. every `asset_media_derivatives.asset_id` exists in `assets`). After `image_assets` upsert, derivative rows whose `asset_id` still has no `image_assets` row are skipped; parity checks fail until data is fixed.
- Unknown `asset_media_derivatives.variant` values (other than thumb/card/detail) cause the sync to **abort** before writing.
- `legacy_event_id` mismatch between `asset_events` and `photo_events` (same legacy id, different UUID) causes a **hard failure** with affected ids printed.

## Files

- `apps/api/scripts/legacy/sync-clean-schema-after-import.ts` — sync implementation
- `apps/api/scripts/db/validate-clean-schema-sync.ts` — validation
- `apps/api/scripts/legacy/run-legacy-import-chunks.ts` — optional post-run sync
