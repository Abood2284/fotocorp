# Image Asset Normalization Report

## What Changed

DB Revamp PR-02 adds clean, industry-named tables while leaving the current API on the legacy-compatible tables:

- `photo_events` backfilled from `asset_events`
- `image_assets` backfilled from `assets`

No old tables were deleted or renamed. No public/API route reads were switched.

## Why `image_assets` Exists

The current `assets` table is a legacy-compatible import table. It mixes app-facing image fields, storage fields, relationship fields, and legacy JSON dependencies under generic names.

`image_assets` makes the domain explicit:

- image identity and editorial metadata
- photographer relationship through `photographers.id`
- event relationship through `photo_events.id`
- storage status using clear original-file fields
- legacy identifiers kept as reconciliation fields

## Why Old UUIDs Are Preserved

`photo_events.id = asset_events.id` and `image_assets.id = assets.id`.

Preserving UUIDs makes later migrations safer:

- media derivative migration can keep the same asset IDs
- download log migration can keep the same asset IDs
- API transition can compare old and new rows directly
- no permanent old/new UUID mapping table is needed

If UUID preservation ever fails, the migration should stop rather than invent a hidden mapping workaround.

## Legacy Payload Policy

`legacy_payload` is retained for archive and audit. Hot fields are extracted into typed columns so application code does not need to depend on JSON for core relationships, status, dates, storage, event, photographer, or category identifiers.

## Photographer Mapping

Image assets join to photographers by numeric legacy ID only:

```sql
assets.legacy_photographer_id = photographers.legacy_photographer_id
```

Name matching is forbidden. `tempphotographer` is not a primary mapping source.

## Event Mapping

`photo_events.id` preserves `asset_events.id`, so current `assets.event_id` can be copied directly to `image_assets.event_id`. The validation script still checks for orphan event links.

## Why `legacy_image_code` Is Not Unique Yet

Legacy imports have known duplicate image-code issues. `legacy_image_code` is indexed for search and reconciliation, but uniqueness is deferred until duplicate import issues are resolved.

## Category Cleanup Is Deferred

`image_assets.category_id` remains nullable and references the current `asset_categories` table where available. The category/domain rename and deeper category cleanup are deferred to a later DB revamp PR.

## Deferred Work

- Derivative tables still point to old `assets`.
- Download logs still point to old `assets`.
- API reads still use old `assets`, `asset_events`, and `photographer_profiles`.
- Route switching is deferred to PR-03/PR-04.

## Validation Commands

```bash
pnpm --dir apps/api db:validate:image-assets
pnpm --dir apps/api db:validate:photographers
```

## Expected Validation Output

Critical checks must pass:

```txt
old_asset_events = new_photo_events
old_assets = new_image_assets
missing_preserved_image_asset_ids = 0
missing_preserved_photo_event_ids = 0
with_legacy_photographer_id = legacy_image_assets
with_photographer_id = legacy_image_assets
orphan_photographer_links = 0
orphan_legacy_photographer_ids = 0
old_assets_with_event_id = new_image_assets_with_event_id
orphan_event_links = 0
duplicate_legacy_source_asset_id_rows = 0
PASS image asset normalization validation passed.
```
