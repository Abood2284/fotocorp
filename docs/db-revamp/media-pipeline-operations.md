# Media Pipeline Operations (Temporary)

This runbook is for production cutover sequencing before large derivative generation.

## Production-scale order

1. Fast import/map legacy assets into Neon with R2 check skipped.
2. Verify mapped originals against R2 in controlled chunks.
3. Generate preview derivatives only for verified assets. **Client policy:** `thumb` and `card` are **clean** (no tiled watermark); **`detail` remains watermarked**. Objects stay under the historical prefix `previews/watermarked/<variant>/…` for all three (the folder name is misleading for thumb/card until a later migration).
4. Check status after every batch.

## Current status

```bash
pnpm --dir apps/api media:pipeline-status
```

Optional:

```bash
pnpm --dir apps/api media:pipeline-status -- --detail-watermark-profile fotocorp-preview-v4-dense-dark-lowquality --failed-limit 30
```

Equivalent SQL snapshot on `image_assets`:

```sql
select count(*) as total_assets from image_assets;

select count(*) as assets_with_original_key
from image_assets
where original_storage_key is not null
  and original_storage_key <> '';

select count(*) as r2_exists_true
from image_assets
where original_exists_in_storage = true;

select count(*) as r2_exists_false
from image_assets
where original_exists_in_storage = false;

select count(*) as r2_exists_null
from image_assets
where original_exists_in_storage is null;
```

## Import/map legacy assets

Fast 10k test (no R2 HEAD during import):

```bash
pnpm --dir apps/api legacy:import -- --only assets --skip-r2-check --limit 10000 --batch-size 1000 --default-ext jpg
```

Fast 50k run:

```bash
pnpm --dir apps/api legacy:import -- --only assets --skip-r2-check --limit 50000 --batch-size 1000 --default-ext jpg
```

Chunked runner without manual end-offset planning (`--auto-end` default):

```bash
pnpm --dir apps/api legacy:import:chunks -- --run-name assets-fast-map --only assets --chunk-size 10000 --batch-size 1000 --skip-r2-check
```

Resume:

```bash
pnpm --dir apps/api legacy:import:chunks -- --resume --run-name assets-fast-map
```

## Verify mapped originals against R2

10k test:

```bash
pnpm --dir apps/api media:verify-r2-originals -- --limit 10000 --batch-size 500 --concurrency 20
```

50k run:

```bash
pnpm --dir apps/api media:verify-r2-originals -- --limit 50000 --batch-size 500 --concurrency 20
```

Dry run:

```bash
pnpm --dir apps/api media:verify-r2-originals -- --dry-run --limit 5000 --batch-size 250 --concurrency 10
```

Force re-check:

```bash
pnpm --dir apps/api media:verify-r2-originals -- --force --limit 20000 --batch-size 500 --concurrency 20
```

## Derivative generation (after verification)

**Thumb and card** are **clean** (no tiled watermark) but keep the historical R2 prefixes `previews/watermarked/thumb/` and `previews/watermarked/card/` so URLs and keys stay stable. **`Detail` stays watermarked** at `previews/watermarked/detail/…`. Do **not** delete existing preview objects first; use `--force` only for the variants you intend to overwrite.

Backfill thumb and/or card after code deploy (dry-run first):

```bash
pnpm --dir apps/api media:generate-derivatives -- --scope all-verified --dry-run --force --variants thumb,card --limit 200
pnpm --dir apps/api media:generate-derivatives -- --scope all-verified --force --variants thumb,card --limit 500 --batch-size 50 --concurrency 4
```

Avoid regenerating **`detail`** unless explicitly requested (`--variants` must include `detail`). Originals remain private and must never be exposed directly to the browser.

Dry run first:

```bash
pnpm --dir apps/api media:generate-derivatives -- --scope all-verified --dry-run --limit 200
```

Small controlled real batch:

```bash
pnpm --dir apps/api media:generate-derivatives -- --scope all-verified --limit 200 --batch-size 50 --concurrency 4
```

Migration batch command:

```bash
pnpm --dir apps/api media:generate-derivatives -- \
  --scope all-verified \
  --limit 10000 \
  --batch-size 100 \
  --concurrency 4
```

Benchmark 1k with split concurrency + retries:

```bash
pnpm --dir apps/api media:generate-derivatives -- \
  --scope all-verified \
  --limit 1000 \
  --batch-size 100 \
  --asset-concurrency 4 \
  --upload-concurrency 8 \
  --r2-retry-attempts 3
```

Time-boxed 10k benchmark with report file:

```bash
pnpm --dir apps/api media:generate-derivatives -- \
  --scope all-verified \
  --limit 10000 \
  --batch-size 100 \
  --asset-concurrency 4 \
  --upload-concurrency 8 \
  --r2-retry-attempts 3 \
  --max-runtime-minutes 60 \
  --report-file logs/derivative-benchmark-10k.json
```

## Notes

- `legacy:import` remains offset-compatible, but chunk runner + state removes manual offset counting for long runs.
- Import/map is idempotent (`on conflict` upsert keyed by legacy identifiers).
- R2 verification is idempotent and updates `original_exists_in_storage` + `original_storage_checked_at`.
- Derivative generator scopes:
  - `public-ready`: only `APPROVED + PUBLIC` assets with verified originals.
  - `all-verified`: all verified image assets with mapped originals, regardless of current public listing status.
- Pipeline status labels:
  - `assetsReadyForPublicListing`: strict gate (`APPROVED`, `PUBLIC`, verified original, all required READY derivatives: **`THUMB`/`CARD` with `is_watermarked=false`** and expected clean profiles; **`DETAIL` with `is_watermarked=true`** and the expected detail `watermark_profile`).
  - `assetsCurrentlyVisibleInPublicApi`: assets that satisfy current public API listing conditions (can differ from strict publish-ready gate during migration windows).
- Derivative generation exit behavior:
  - Default (recommended for bulk migration): item-level failures are logged/classified and the run exits `0`.
  - Corrupt/unsupported legacy originals are marked `FAILED` and skipped for continued processing.
  - Strict mode for QA/smoke: add `--fail-on-item-errors` to exit `1` when any item-level failures occur.
- Derivative generator now prints timing + throughput metrics and supports:
  - `--asset-concurrency` and `--upload-concurrency`
  - `--r2-retry-attempts` and `--r2-retry-base-ms`
  - `--max-runtime-minutes` to stop safely after the current batch
  - `--report-file` to persist JSON run metrics
- Do not run the full 740k batch inside Codex; use controlled server/operator runs.
