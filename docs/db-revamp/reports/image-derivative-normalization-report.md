# Image Derivative Normalization Report

## What Changed

DB Revamp PR-03 adds `image_derivatives` as the clean derivative table and backfills it from `asset_media_derivatives`.

No old derivative, access-log, download-log, asset, or route behavior was removed or switched.

## Why `image_derivatives` Exists

`asset_media_derivatives` is tied to the old generic `assets` naming and uses storage-provider-specific column names. `image_derivatives` makes the relationship explicit by pointing to `image_assets.id` and using clearer names:

- `image_asset_id` instead of `asset_id`
- `storage_key` instead of `r2_key`
- `size_bytes` instead of `byte_size`

## Why `asset_media_derivatives` Is Not Deleted

Existing API/media routes still read `asset_media_derivatives`. This PR creates and validates the clean table only. Route switching is deferred to a focused follow-up so runtime media behavior does not change in this schema PR.

## Why Derivative UUIDs Are Preserved

`image_derivatives.id = asset_media_derivatives.id`.

Preserving UUIDs keeps later access-log migration and route switching safer because derivative identity does not need a permanent old/new mapping table.

## Provider-Neutral Storage Key

The new table uses `storage_key` instead of `r2_key`. The value can still contain the current stored object key, but the column name no longer hard-codes Cloudflare R2 into the normalized domain model.

## Variant Normalization

Old variants are lowercase:

- `thumb`
- `card`
- `detail`

New variants are uppercase:

- `THUMB`
- `CARD`
- `DETAIL`

Unknown old variants are not silently mapped. Validation fails if any appear.

## Deferred Work

- API/media route switching is deferred.
- Media access log migration is deferred.
- Download log migration is deferred.
- Old `asset_media_derivatives` remains the runtime source until a route-switch PR.

## Validation Commands

```bash
pnpm --dir apps/api db:validate:image-derivatives
pnpm --dir apps/api db:validate:image-assets
pnpm --dir apps/api db:validate:photographers
```

## Expected Validation Output

Critical checks must pass:

```txt
old_derivatives = new_derivatives
missing_preserved_derivative_ids = 0
derivative_rows_with_missing_image_asset = 0
old_derivatives_with_missing_image_asset = 0
duplicate_image_asset_variant_pairs = 0
unknown_old_variants = 0
missing_storage_key_count = 0
missing_mime_type_count = 0
PASS image derivative normalization validation passed.
```
