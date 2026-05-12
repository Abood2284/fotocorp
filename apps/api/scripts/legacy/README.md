# Legacy Fotocorp Import Tools

These scripts import exported SQL Server data into the flexible Fotocorp skeleton tables owned by `apps/api/src/db/schema`.

`apps/api` owns the asset catalog, photographer profile, import batch, import issue, and R2 reconciliation schema. Better Auth tables and `app_user_profiles` are still owned by the current web auth setup and are intentionally not part of the API Drizzle migration yet.

## Expected Files

Place CSV or JSONL exports under `data/legacy/` at the repository root:

```text
data/legacy/
  CategoryMaster.csv         or CategoryMaster.jsonl
  eventtb.csv                or eventtb.jsonl
  PhotographerMaster.csv     or PhotographerMaster.jsonl
  fotocorp_images.csv        or fotocorp_images.jsonl
```

JSONL is preferred for large files. CSV must include a header row.
Lowercase filenames such as `categorymaster.csv` and `photographermaster.csv` are also supported.

## Environment

The script preserves existing shell environment variables first. It then loads `apps/api/.dev.vars`, `apps/api/.env.local`, `apps/api/.env`, root `.env.local`, and root `.env` in that order without printing secrets.

Required for database writes:

```bash
DATABASE_URL=postgresql://...
```

Required for asset R2 checks unless `--skip-r2-check` is used. Dry runs warn and skip R2 checks when these are missing:

```bash
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ORIGINALS_BUCKET=fotocorp-2026-megafinal
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
```

Fallback aliases are also supported:

```bash
R2_ACCOUNT_ID=...
R2_ORIGINALS_BUCKET=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

The older `CLOUDFLARE_R2_BUCKET`/`R2_BUCKET_NAME` names are accepted only as legacy fallbacks. New code should use the explicit originals bucket variable.

Optional:

```bash
CLOUDFLARE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
CLOUDFLARE_R2_REGION=auto
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_REGION=auto
```

## Running Imports

Start with a small limit:

```bash
pnpm legacy:import -- --dry-run --skip-r2-check --limit 10
```

Import a small category sample:

```bash
pnpm legacy:import -- --only categories --limit 20
```

Override the legacy data directory:

```bash
pnpm legacy:import -- --dry-run --skip-r2-check --data-dir data/legacy --limit 10
```

Import only assets and skip R2 checks:

```bash
pnpm legacy:import -- --only assets --limit 1000 --skip-r2-check --default-ext jpg
```

Use an R2 prefix when objects are stored under a folder:

```bash
pnpm legacy:import -- --only assets --limit 1000 --r2-prefix originals
```

Large imports run in bulk upsert batches. Use `--batch-size` to control DB chunk size, and use `--offset` with `--limit` to resume or process the legacy files in deterministic windows:

```bash
pnpm legacy:import -- --only assets --skip-r2-check --offset 0 --limit 10000 --batch-size 1000 --default-ext jpg
pnpm legacy:import -- --only assets --skip-r2-check --offset 10000 --limit 10000 --batch-size 1000 --default-ext jpg
```

Fast metadata import without R2 verification still infers the expected object key and filename:

```bash
pnpm legacy:import -- --only assets --skip-r2-check --offset 0 --limit 10000 --batch-size 1000 --default-ext jpg
```

Verified import performs read-only R2 HEAD checks:

```bash
pnpm legacy:import -- --only assets --offset 0 --limit 1000 --batch-size 100 --default-ext jpg
```

## Validation Commands

Use these small checks before any large import:

```bash
pnpm legacy:import -- --dry-run --skip-r2-check --limit 10 --batch-size 5
pnpm legacy:import -- --only categories --batch-size 1000
pnpm legacy:import -- --only assets --skip-r2-check --offset 0 --limit 100 --batch-size 25 --default-ext jpg
```

The importer runs in this order for `--only all`: categories, events, contributors, assets. It is resumable through upserts keyed by legacy identifiers. Asset rows use `legacy_source + legacy_srno`; `legacy_imagecode` is not assumed unique.

## R2 Verification

For each `fotocorp_images` row, the script trims `imagecode`, then performs read-only R2 HEAD checks using these extension fallbacks:

```text
.jpg, .jpeg, .png, .webp, .JPG, .JPEG, .PNG, .WEBP
```

It supports both flat keys like `FC0101072.jpg` and prefixed keys via `--r2-prefix`. The importer must not upload, move, rename, delete, or rewrite R2 objects during initial migration reconciliation.

When `--skip-r2-check` is used, the importer does not send HEAD requests but still stores the deterministic expected key using `--default-ext` when the legacy imagecode has no extension. For example, `FC02120992` becomes `FC02120992.jpg`, or `originals/FC02120992.jpg` with `--r2-prefix originals`.

If an object is found, the asset is saved with `r2_exists = true`, `r2_original_key`, `original_filename`, `original_ext`, and `r2_checked_at`.

If no object is found, the asset is still inserted with `r2_exists = false`, and an `asset_import_issues` row is written with `issue_type = MISSING_R2_OBJECT`.

## Reconciliation Report

Each non-dry run creates an `asset_import_batches` row. At the end it updates:

- `total_rows`: rows processed by this run
- `inserted_rows`: new rows inserted
- `updated_rows`: existing rows updated
- `r2_matched_rows`: asset rows with a detected R2 object
- `r2_missing_rows`: asset rows without a detected R2 object
- `duplicate_imagecode_rows`: asset rows whose `imagecode` appears more than once in the processed export scope
- `failed_rows`: rows that failed to import
- `status`: `COMPLETED` or `FAILED`

Detailed row-level reconciliation lives in `asset_import_issues`. Expected issue types include missing R2 objects, duplicate imagecodes, missing relations, invalid dates, unknown statuses, and import errors.

## Chunk Runner

For long imports, use the chunk runner. It does not contain import logic; it repeatedly invokes the existing importer with deterministic `--offset` and `--limit` windows.

```bash
pnpm legacy:import:chunks -- --run-name assets-verified-0-1000 --only assets --start 0 --end 1000 --chunk-size 100 --batch-size 100 --default-ext jpg
```

Run the first 1000 verified assets with read-only R2 HEAD checks:

```bash
pnpm legacy:import:chunks -- --run-name assets-r2-0-1000 --only assets --start 0 --end 1000 --chunk-size 100 --batch-size 100 --default-ext jpg
```

Fast metadata-only chunks without R2 HEAD checks:

```bash
pnpm legacy:import:chunks -- --run-name assets-fast-1000-plus --only assets --start 1000 --end 736232 --chunk-size 1000 --batch-size 100 --default-ext jpg --skip-r2-check
```

Resume a stopped or failed run:

```bash
pnpm legacy:import:chunks -- --resume --run-name assets-r2-0-1000
```

Run the next 9000 assets:

```bash
pnpm legacy:import:chunks -- --run-name assets-r2-1000-10000 --only assets --start 1000 --end 10000 --chunk-size 100 --batch-size 100 --default-ext jpg
```

Inspect all missing R2 objects:

```bash
grep ',MISSING_R2_OBJECT,' data/legacy/import-runs/assets-r2-0-1000/issues/all-issues.csv
```

Run files are written under:

```text
data/legacy/import-runs/<run-name>/
  issues/
    all-issues.csv
    all-issues.jsonl
    chunk-<offset>-<limit>.csv
    chunk-<offset>-<limit>.jsonl
  state.json
  chunks.jsonl
  summary.md
  run.lock
```

`state.json` tracks the next offset. `chunks.jsonl` appends one record per attempted chunk, including the importer's `batchId`, counters, exit code, and error text when available. When a chunk has a `batchId`, the runner queries `asset_import_issues` for that batch and writes per-chunk issue JSONL/CSV files plus aggregate `all-issues.jsonl` and `all-issues.csv`. Aggregate issue reports are de-duplicated by `batch_id + legacy_srno + issue_type`. `summary.md` is regenerated after every chunk with totals, issue report paths, the last 10 issues, and the resume command.

If the process is interrupted, the runner marks the state `STOPPED`, removes `run.lock`, and does not advance the offset for the incomplete chunk. If a stale `run.lock` remains after a crashed terminal, use `--force` only after confirming no runner process is still active.

R2 safety is inherited from the importer. Verified runs may perform read-only HEAD checks. The runner does not write, move, copy, rename, or delete R2 objects.

## Notes

The legacy status mapping in the importer is provisional and requires client confirmation:

- `1 -> APPROVED / PUBLIC`
- `0 -> DRAFT / PRIVATE`
- `2 -> REVIEW / PRIVATE`
- `3 -> REJECTED / PRIVATE`
- `4 -> ARCHIVED / PRIVATE`

Legacy contributors are imported as `LEGACY_ONLY` `photographer_profiles`. They are not converted into Better Auth users.

R2 verification during the initial migration must remain read-only. Import and upload scripts should use HEAD/List-style existence checks only and must not move, delete, or rewrite R2 objects while reconciling legacy records.
