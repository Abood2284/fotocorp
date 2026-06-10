# Legacy Table Retirement Runbook

This runbook covers the production-safe retirement of old legacy/import mirror tables after the clean schema cutover. Runtime catalog code must use `image_assets`, `photo_events`, and `image_derivatives`; re-running the old legacy import/sync commands is no longer supported on the production schema after this migration.

## Scope

### Tables dropped

- `asset_import_issues`
- `image_assets_duplicate_backup_20260518`
- `asset_download_logs`
- `asset_fotobox_items`
- `asset_media_access_logs`
- `asset_media_derivatives`
- `assets`
- `asset_events`

### Tables explicitly kept

- `asset_admin_audit_logs`
- `asset_import_batches`
- `asset_categories`
- `fotobox_boards`
- `photographer_profiles`

### Active canonical tables not touched

- `image_assets`
- `image_assets_metadata`
- `image_derivatives`
- `photo_events`
- `contributors`
- `asset_categories`
- `public_event_feed_items`
- `image_access_logs`
- `image_download_logs`

## Required Backup / Export

Before running the migration on production, create a Neon PITR restore point or confirm point-in-time restore coverage, then export every drop candidate to cold storage.

Example export checklist, run from a trusted operator machine with production credentials:

```bash
mkdir -p exports/legacy-table-retirement

pg_dump "$DATABASE_URL" --data-only --column-inserts --table=public.asset_import_issues > exports/legacy-table-retirement/asset_import_issues.sql
pg_dump "$DATABASE_URL" --data-only --column-inserts --table=public.assets > exports/legacy-table-retirement/assets.sql
pg_dump "$DATABASE_URL" --data-only --column-inserts --table=public.asset_events > exports/legacy-table-retirement/asset_events.sql
pg_dump "$DATABASE_URL" --data-only --column-inserts --table=public.asset_media_derivatives > exports/legacy-table-retirement/asset_media_derivatives.sql
pg_dump "$DATABASE_URL" --data-only --column-inserts --table=public.asset_media_access_logs > exports/legacy-table-retirement/asset_media_access_logs.sql
pg_dump "$DATABASE_URL" --data-only --column-inserts --table=public.asset_download_logs > exports/legacy-table-retirement/asset_download_logs.sql
pg_dump "$DATABASE_URL" --data-only --column-inserts --table=public.asset_fotobox_items > exports/legacy-table-retirement/asset_fotobox_items.sql
pg_dump "$DATABASE_URL" --data-only --column-inserts --table=public.image_assets_duplicate_backup_20260518 > exports/legacy-table-retirement/image_assets_duplicate_backup_20260518.sql
```

Also store:

- The exact Git SHA and migration filename.
- The production Neon branch id/name.
- The PITR timestamp or restore-point confirmation.
- Checksums for each export file.

Do not export canonical active tables as the primary rollback strategy; rely on Neon PITR/branch restore for full-database rollback.

## Production Branch Clone Test

Do not apply this migration directly to production first.

1. Create a fresh clone/branch from the production Neon branch.
2. Point a staging API/Web environment at the clone.
3. Run the pre-migration validation queries below on the clone.
4. Apply the generated Drizzle migration on the clone.
5. Run post-migration validation queries and app smoke checks.
6. Only after clone validation passes, schedule production migration.

## Pre-Migration Validation

Run before the migration on the production clone and again immediately before production execution:

```sql
SELECT to_regclass('public.assets') IS NOT NULL AS assets_exists;
SELECT to_regclass('public.asset_events') IS NOT NULL AS asset_events_exists;
SELECT to_regclass('public.asset_import_issues') IS NOT NULL AS asset_import_issues_exists;

SELECT COUNT(*) FROM image_assets;
SELECT COUNT(*) FROM photo_events;
SELECT COUNT(*) FROM image_derivatives;

SELECT
  COUNT(*) AS audit_rows,
  COUNT(ia.id) AS audit_rows_matching_image_assets
FROM asset_admin_audit_logs aal
LEFT JOIN image_assets ia ON ia.id = aal.asset_id
WHERE aal.asset_id IS NOT NULL;
```

Additional safety checks:

```sql
SELECT COUNT(*) AS asset_ids_matching_image_assets
FROM assets a
JOIN image_assets ia ON ia.id = a.id;

SELECT COUNT(*) AS asset_events_matching_photo_events
FROM asset_events ae
JOIN photo_events pe ON pe.legacy_event_id = ae.legacy_event_id;

SELECT COUNT(*) AS fotobox_rows_missing_image_assets
FROM asset_fotobox_items afi
LEFT JOIN image_assets ia ON ia.id = afi.asset_id
WHERE ia.id IS NULL;

SELECT COUNT(*) AS audit_rows_missing_image_assets
FROM asset_admin_audit_logs aal
LEFT JOIN image_assets ia ON ia.id = aal.asset_id
WHERE aal.asset_id IS NOT NULL AND ia.id IS NULL;
```

Expected production proof before proceeding:

- `assets.id -> image_assets.id`: `735227 / 735227` matched.
- `asset_events.legacy_event_id -> photo_events.legacy_event_id`: `54959 / 54959` matched.
- `asset_admin_audit_logs`: all non-null `asset_id` values match `image_assets.id`.
- Old child FK rows all match `image_assets.id`.
- `asset_import_issues` has no recent writes after `2026-05-16`.

`asset_fotobox_items` is intentionally retired in this migration. Account/Fotobox paths must compile/load without depending on saved-item rows; any future saved-item feature needs a new canonical table design rather than reviving the retired legacy item table.

## Migration Execution

The migration must be generated by Drizzle from schema changes. Do not handwrite raw SQL and do not use `DROP ... CASCADE`.

Clone/staging:

```bash
pnpm --dir apps/api run db:migrate
```

Production manual step after backup/export and clone validation:

```bash
pnpm --dir apps/api run db:migrate
```

Run this only from an operator environment pointed at the intended production Neon branch. Do not run it from an AI agent session.

## Post-Migration Validation

```sql
SELECT to_regclass('public.assets') AS assets;
SELECT to_regclass('public.asset_events') AS asset_events;
SELECT to_regclass('public.asset_import_issues') AS asset_import_issues;
SELECT to_regclass('public.asset_media_derivatives') AS asset_media_derivatives;
SELECT to_regclass('public.asset_media_access_logs') AS asset_media_access_logs;
SELECT to_regclass('public.asset_download_logs') AS asset_download_logs;
SELECT to_regclass('public.asset_fotobox_items') AS asset_fotobox_items;
SELECT to_regclass('public.image_assets_duplicate_backup_20260518') AS image_assets_duplicate_backup_20260518;

SELECT to_regclass('public.image_assets') AS image_assets;
SELECT to_regclass('public.image_assets_metadata') AS image_assets_metadata;
SELECT to_regclass('public.image_derivatives') AS image_derivatives;
SELECT to_regclass('public.photo_events') AS photo_events;
SELECT to_regclass('public.asset_admin_audit_logs') AS asset_admin_audit_logs;

SELECT COUNT(*) FROM image_assets;
SELECT COUNT(*) FROM photo_events;
SELECT COUNT(*) FROM image_derivatives;
SELECT COUNT(*) FROM asset_admin_audit_logs;
```

Confirm the `asset_admin_audit_logs.asset_id` FK targets `image_assets(id)`:

```sql
SELECT
  conname,
  confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE conrelid = 'public.asset_admin_audit_logs'::regclass
  AND contype = 'f';
```

## App Smoke Checks

Run against the production clone after migration:

1. Staff catalog page loads.
2. Staff catalog detail sidebar opens.
3. Public asset search/list still works.
4. Public event latest/browse still works.
5. Preview images still resolve.
6. Contributor upload/staff review pages compile/load.
7. Fotobox path compiles/loads if currently enabled.
8. API check passes.
9. Web build passes.

Commands:

```bash
pnpm -C apps/api run check
npm --prefix apps/web run build
```

## Rollback Notes

Rollback is database-level, not table-by-table.

1. If clone validation fails, discard the clone and fix the migration before retrying.
2. If production migration fails before commit, inspect the Drizzle error and do not retry until the exact failing statement is understood.
3. If production migration succeeds but runtime validation fails, restore the production branch using Neon PITR/restore point captured before migration.
4. Keep export files until production has run cleanly through at least one full operational window.

Do not attempt ad hoc `CREATE TABLE AS` restoration on production unless a DBA/operator has approved the plan and verified dependent constraints.
