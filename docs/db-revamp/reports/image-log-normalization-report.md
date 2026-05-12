# Image Log Normalization Report

## What Changed

DB Revamp PR-04 adds clean log tables:

- `image_access_logs`
- `image_download_logs`

Both tables are backfilled from the current legacy-compatible log tables while preserving log UUIDs.

## Why Clean Log Tables Exist

The old log tables are named around old table boundaries:

- `asset_media_access_logs`
- `asset_download_logs`

The clean tables align logs with the normalized image model:

- `image_access_logs.image_asset_id -> image_assets.id`
- `image_access_logs.image_derivative_id -> image_derivatives.id`
- `image_download_logs.image_asset_id -> image_assets.id`

## Why UUIDs Are Preserved

`image_access_logs.id = asset_media_access_logs.id` and `image_download_logs.id = asset_download_logs.id`.

Preserving UUIDs keeps audit/history rows traceable, makes old/new comparison direct, and avoids a permanent log mapping table.

## Why Logs Use `on delete set null`

Logs are audit/history records. They should survive if an image or derivative record is removed later. The clean tables therefore use nullable foreign keys with `on delete set null` instead of cascade.

## Why Old Log Tables Are Retained

Current API/media/download routes still write to the old log tables. This PR creates backfilled snapshots only. Route write switching is deferred to a later PR so runtime behavior does not change in a schema migration.

## Separate Access and Download Logs

Access logs record preview/derivative delivery attempts and outcomes. Download logs record subscriber download attempts, quota state, sizes, and failures. They remain separate because they answer different audit and operations questions.

## Deferred Work

- API/media/download write switching is deferred.
- Dual writes are not added in this PR.
- Photographer accounts are still deferred.
- Old log tables are not deleted or renamed.

## Validation Commands

```bash
pnpm --dir apps/api db:validate:image-logs
pnpm --dir apps/api db:validate:image-derivatives
pnpm --dir apps/api db:validate:image-assets
pnpm --dir apps/api db:validate:photographers
```

## Expected Validation Output

Critical checks must pass:

```txt
old_media_access_logs = new_image_access_logs
missing_preserved_access_log_ids = 0
image_access_logs_with_missing_image_asset = 0
image_access_logs_with_missing_image_derivative = 0
unknown_old_access_variants = 0
unknown_new_access_variants = 0
old_download_logs = new_image_download_logs
missing_preserved_download_log_ids = 0
image_download_logs_with_missing_image_asset = 0
unknown_old_download_sizes = 0
unknown_old_download_statuses = 0
missing_auth_user_id_count = 0
PASS image log normalization validation passed.
```
