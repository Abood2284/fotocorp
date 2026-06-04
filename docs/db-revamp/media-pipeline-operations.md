# Media Pipeline Operations (Temporary)

This runbook is for production cutover sequencing before large derivative generation.

## Production-scale order

1. Fast import/map legacy assets into Neon with R2 check skipped.
2. Verify mapped originals against R2 in controlled chunks.
3. Generate preview derivatives only for verified assets. **Client policy:** `thumb` and `card` are **clean** (no tiled watermark); **`detail` remains watermarked**. Objects stay under the historical prefix `previews/watermarked/<variant>/…` for all three (the folder name is misleading for thumb/card until a later migration).
4. Check status after every batch.

## Public preview CDN delivery

Public **preview derivatives** (thumb, card, detail) are served from the R2 previews bucket behind the custom domain configured as `PUBLIC_PREVIEW_CDN_BASE_URL` (optional `PUBLIC_PREVIEW_CDN_VERSION`, default `v1`). Public catalog, homepage, and latest-events API responses build CDN URLs from each derivative's `image_derivatives.storage_key` when the env var is set; otherwise they fall back to existing same-origin API preview routes. **Originals and paid-size downloads remain protected** behind authenticated entitlement routes and are never exposed via the public CDN domain.

Helper: `apps/api/src/lib/media/public-preview-cdn-url.ts`.

Typesense public search indexing and the parallel `/api/v1/search/assets` route are documented in:

- [`typesense-cloudflare-access-runbook.md`](typesense-cloudflare-access-runbook.md)
- [`reports/typesense-public-indexer-report.md`](reports/typesense-public-indexer-report.md)
- [`reports/typesense-public-search-api-report.md`](reports/typesense-public-search-api-report.md)

Current Typesense cutover target: build and validate `public_assets_20260519_v2`, then point alias `public_assets_current` at it. The v2 search contract indexes `who_is_in_picture` and does not search `title`; frontend cutover waits until that alias swap is complete.

Production Typesense access must go through a secured Cloudflare Tunnel hostname, not a public raw Typesense port. The production Worker cannot use the VPS-local `127.0.0.1:8108`; configure `TYPESENSE_HOST=https://search.fotocorp.com`, keep `TYPESENSE_API_KEY` as an API Worker secret, and set both `TYPESENSE_CF_ACCESS_CLIENT_ID` and `TYPESENSE_CF_ACCESS_CLIENT_SECRET` when Cloudflare Access service auth protects the hostname. If any Typesense API key or Access secret is exposed, rotate it.

Smoke search connectivity without the browser:

```bash
TYPESENSE_HOST=http://127.0.0.1:8108 pnpm --dir apps/api search:smoke-typesense
TYPESENSE_HOST=https://search.fotocorp.com TYPESENSE_CF_ACCESS_CLIENT_ID=... TYPESENSE_CF_ACCESS_CLIENT_SECRET=... pnpm --dir apps/api search:smoke-typesense
```

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

## Protected preview migration (big-bang)

All variants (`thumb`, `card`, `detail`) use the tiered protected renderer in `@fotocorp/media-preview`. R2 keys stay at `previews/watermarked/<variant>/…` (overwrite in place). DB profiles: `fotocorp_thumb_light_preview_v1`, `fotocorp_card_light_preview_v1`, `fotocorp_detail_preview_v1`; `is_watermarked = true` for all three.

### Prerequisites (Mac + each Windows shard machine)

- Repo at migration commit; `pnpm install` at monorepo root.
- `apps/api/.dev.vars` (or env) with `DATABASE_URL` and R2 credentials for originals + previews buckets.
- Use single-line commands (PowerShell-safe); avoid bash `\` line continuations on Windows.

### Maintenance window order

1. `SITE_UNDER_CONSTRUCTION=true` on production **web** Worker; use `?preview=<bypass_secret>` to verify.
2. Deploy **API Worker** with new profile gates (unregenerated assets 404 until processed).
3. Rebuild **VPS jobs** (`docker compose … up -d --build fotocorp-jobs`) so new publishes match backfill.
4. Optionally `IMAGE_PUBLISH_PROCESSING_ENABLED=false` on VPS during bulk backfill.
5. Run generation shards; then Typesense reindex; purge CDN cache for preview hostname.
6. Set `PUBLIC_PREVIEW_CDN_VERSION=v2` on API if using versioned fallback URLs.
7. `SITE_UNDER_CONSTRUCTION=false`.

### Mac pilot — 100 assets

```bash
pnpm --dir apps/api run media:generate-derivatives -- --scope all-verified --variants thumb,card,detail --force --limit 100 --batch-size 25 --asset-concurrency 2 --upload-concurrency 4
```

Verify with bypass cookie on homepage/search/asset detail; then `pnpm --dir apps/api media:pipeline-status`.

### Windows — 5 parallel shards

One terminal per machine; keep `--shard-count 5` fixed for the whole wave. Create `apps/api/logs` if missing.

Shard 0:

```bash
pnpm --dir apps/api run media:generate-derivatives -- --scope all-verified --variants thumb,card,detail --force --shard-count 5 --shard-index 0 --batch-size 50 --asset-concurrency 1 --upload-concurrency 3 --report-file logs/derivative-shard-0-report.json
```

Shards 1–4: same command with `--shard-index 1` … `4` and matching `--report-file logs/derivative-shard-N-report.json`.

Dry-run on Windows first: add `--dry-run --limit 20`.

### VPS jobs (one-shot drain — no idle Neon polling)

Production uses **`publish:drain`**: process all `QUEUED` `image_publish_jobs` (up to `PUBLISH_DRAIN_MAX_JOBS` / `PUBLISH_DRAIN_MAX_RUNTIME_SECONDS`), then exit. Pending jobs stay in Neon until the next drain (cron backup or approve-time webhook in PR-2/3).

From repo root on VPS (e.g. `/opt/fotocorp/app`):

```bash
cd /opt/fotocorp/app
git pull
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production build fotocorp-jobs
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs smoke:sharp
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs
```

Example backup cron (every 2 days — adjust path/schedule):

```cron
0 3 */2 * * cd /opt/fotocorp/app && docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs >> /var/log/fotocorp-jobs-drain.log 2>&1
```

Set `IMAGE_PUBLISH_PROCESSING_ENABLED=true` in `apps/jobs/.env.production` before expecting real publishes.

**Dev-only** continuous 15s poller: `docker compose -f docker-compose.jobs.yml --profile dev-worker up -d fotocorp-jobs-worker` (requires `ALLOW_CONTINUOUS_JOB_WORKER=true` in compose).

`docker compose restart` does **not** load new code; rebuild the image after `git pull`.

### Typesense (after backfill)

No collection schema change. Reindex so eligibility matches new CARD/THUMB profiles:

```bash
pnpm --dir apps/api run typesense:index-public-assets
```

If using versioned collections, build a new collection, validate counts, swap alias `public_assets_current`. Smoke:

```bash
TYPESENSE_HOST=... pnpm --dir apps/api search:smoke-typesense
```

Run reindex **before** lifting under-construction when search is Typesense-backed.

### CDN cache

Most URLs use `{CDN}/{storage_key}`; `PUBLIC_PREVIEW_CDN_VERSION` does not bust those paths. After overwrite, **purge Cloudflare cache** for the previews CDN hostname or `previews/watermarked/*`.

### General backfill (non-sharded)

```bash
pnpm --dir apps/api media:generate-derivatives -- --scope all-verified --dry-run --limit 200
pnpm --dir apps/api media:generate-derivatives -- --scope all-verified --limit 200 --batch-size 50 --asset-concurrency 4 --upload-concurrency 8
```

Use `--force` to overwrite existing objects. Originals remain private.

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
  - `assetsReadyForPublicListing`: strict gate (`APPROVED`, `PUBLIC`, verified original, all required READY derivatives with **`is_watermarked=true`** and expected protected profiles for thumb/card/detail).
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
