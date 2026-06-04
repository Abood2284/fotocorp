# Fotocorp Jobs (`apps/jobs`)

Node CLI package for background image publish work. This is **not** a Cloudflare Worker: it runs under real **Node.js** so **native Sharp** and similar addons are supported.

## Scripts

| Script | Command | Notes |
| --- | --- | --- |
| `dev` | `tsx src/index.ts --dry-run` | Local developer convenience. |
| `publish:dry-run` | `tsx src/index.ts --dry-run` | Safe read-only mode. Connects to Neon only if `DATABASE_URL` is set; if unset, the CLI warns and reports `pending publish jobs=unknown`. Never claims or mutates rows. |
| `publish:once` | `tsx src/index.ts --once` | Validates required env, runs one poll iteration, then exits. Gated by `IMAGE_PUBLISH_PROCESSING_ENABLED` (see below). |
| `publish:drain` | `tsx src/index.ts --drain` | **One-shot.** Processes queued publish jobs until empty or limits, then exits. Structured `publish_drain_*` logs. |
| `publish:wake` | `tsx src/wakeIndex.ts` | **Production trigger.** Minimal HTTP server on `JOBS_WAKE_PORT` (default `18765`). `POST /internal/publish/drain` with header `x-jobs-wake-secret` starts a background drain; `409` if a drain is already running. `GET /health` for probes. |
| `publish:worker` | `tsx src/index.ts --worker` | **Dev/manual only.** Continuous poll loop (`IMAGE_PUBLISH_POLL_INTERVAL_MS`). Blocked in production unless `ALLOW_CONTINUOUS_JOB_WORKER=true`. Use Docker profile `dev-worker` (`fotocorp-jobs-worker`). |
| `smoke:sharp` | `tsx scripts/smoke/check-sharp-node.ts` | Proves Sharp loads and encodes a tiny in-memory image. |
| `check` | `tsc -p tsconfig.json --noEmit` | Typecheck. |

Root `pnpm dev` starts web + API only. Run `pnpm dev:jobs` manually when you need a quick dry-run of the jobs CLI.

## Publish pipeline (PR-16F + PR-16G)

The worker polls real `image_publish_jobs` rows from Neon via native `pg`. Status vocabulary follows the existing API schema:

| Lifecycle stage | `image_publish_jobs.status` | `image_publish_job_items.status` |
| --- | --- | --- |
| Created by staff approval | `QUEUED` | `QUEUED` |
| Claimed by the worker | `RUNNING` | `RUNNING` per item as processing starts |
| Success | `COMPLETED` (or `PARTIAL_FAILED` if some items failed) | `COMPLETED` |
| Failure | `FAILED` or `PARTIAL_FAILED` | `FAILED` with `failure_code` / `failure_message` |

The schema enums are `QUEUED / RUNNING / COMPLETED / FAILED / PARTIAL_FAILED` (jobs) and `QUEUED / RUNNING / COMPLETED / FAILED` (items).

### Safety flag

```env
IMAGE_PUBLISH_PROCESSING_ENABLED=false   # default — count queued jobs only, no claims
IMAGE_PUBLISH_PROCESSING_ENABLED=true      # VPS — claim and run Sharp + R2 publish
```

| Flag | `publish:dry-run` | `publish:once` / `publish:drain` / `publish:worker` |
| --- | --- | --- |
| any | counts queued jobs if `DATABASE_URL` is set; never claims | — |
| `false` | — | counts queued jobs, logs `processing disabled`, does **not** claim (`publish:drain` exits non-zero if jobs remain queued) |
| `true` | — | claims queued jobs (one per `runOnce`; `publish:drain` loops until empty or limits) |

**Invariant:** assets stay `APPROVED+PRIVATE` until all required derivatives are written to R2 and `completeSuccessfulPublishItem` commits `ACTIVE+PUBLIC`. Leave `IMAGE_PUBLISH_PROCESSING_ENABLED=false` until Neon + R2 credentials on the VPS match production buckets.

### Concurrency and duplicate claims

Claiming uses an explicit transaction with `SELECT … FOR UPDATE SKIP LOCKED LIMIT 1` followed by an `UPDATE … SET status = 'RUNNING'`. Running multiple worker instances against the same DB will not double-claim a job. Items are processed sequentially (concurrency env reserved for future use).

### Local dry-run

```bash
pnpm --dir apps/jobs publish:dry-run
```

Set `DATABASE_URL` first (e.g. in your shell) if you want the dry-run to count real queued jobs. Without it the dry-run prints `pending publish jobs=unknown` and warns about the missing env vars.

## Docker (private VPS, no public URL)

Build context is the **monorepo root**. Containers run as user **`node`** and load secrets from **`apps/jobs/.env.production`** (gitignored; start from `.env.production.example`). The **wake** service binds HTTP inside the container; Compose publishes it only on **host loopback** (`127.0.0.1:18765`) for Cloudflare Tunnel — not on the public internet.

The image **bakes in** `apps/jobs` at build time (`COPY` in `apps/jobs/Dockerfile`). **`docker compose restart` does not load new code** from `git pull`; you must **`build`** again (or use **`up -d --build`**). See **`§11`** in the runbook below.

```bash
cp apps/jobs/.env.production.example apps/jobs/.env.production
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production config
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production build fotocorp-jobs
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs smoke:sharp
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs publish:dry-run
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs
```

**`fotocorp-jobs-wake`** (always-on trigger, no Neon polling):

```bash
# Set JOBS_WAKE_SECRET in apps/jobs/.env.production first
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production up -d --build fotocorp-jobs-wake
curl -sS http://127.0.0.1:18765/health
curl -sS -X POST http://127.0.0.1:18765/internal/publish/drain \
  -H "x-jobs-wake-secret: YOUR_SECRET"
```

Point **cloudflared** at `http://127.0.0.1:18765` (same pattern as Typesense on the VPS). PR-3 will have the API Worker POST through that tunnel on staff approve.

**`fotocorp-jobs`** (one-shot drain): `docker compose … run --rm fotocorp-jobs` for cron backup. Do **not** leave the old 15s poller running in production.

### Deploy or refresh after merging jobs code (VPS)

From the repo root (example path `/opt/fotocorp/app`):

```bash
cd /opt/fotocorp/app
git pull
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production build fotocorp-jobs
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production up -d --build fotocorp-jobs-wake
```

Operator steps (tunnel, cron, logs) live in **[`docs/db-revamp/media-pipeline-operations.md`](../../docs/db-revamp/media-pipeline-operations.md)** (VPS jobs section).

**CapRover / DNS** are not required for this path. The wake port is loopback-only; public access is only via your tunnel hostname if you configure one.

## Layout

- `src/index.ts` — CLI entry (`--dry-run`, `--once`, `--drain`, `--worker`).
- `src/wakeIndex.ts` — `publish:wake` entry.
- `src/publishWakeServer.ts` — HTTP trigger (`POST /internal/publish/drain`, mutex, `202`/`409`).
- `src/executePublishDrain.ts` — shared drain runner for CLI + wake.
- `src/publishDrain.ts` — drain loop and structured `publish_drain_*` logs.
- `src/config/env.ts` — typed env loader; dry-run tolerates missing service env vars with warnings; parses `IMAGE_PUBLISH_PROCESSING_ENABLED`.
- `src/db/client.ts` — Node-native `pg.Pool` singleton and `withJobsTransaction` helper.
- `src/lib/r2Client.ts` — AWS4-signed GET/HEAD/PUT for R2 (originals + previews buckets).
- `src/media/publishImageDerivatives.ts` — Sharp WebP **THUMB/CARD clean**, **DETAIL** watermarked; profiles aligned with `apps/api/scripts/media/process-image-publish-jobs.ts`.
- `src/services/imagePublishJobService.ts` — publish job + item SQL (`claimNextPendingJob`, `markItemRunning`, `completeSuccessfulPublishItem`, `reconcilePublishJobAggregate`, failure helpers).
- `src/services/imagePublishProcessor.ts` — orchestrates R2 reads/writes + DB promotion per claimed job.
- `src/lib/public-event-feed-projection.ts` — post-publish `public_event_feed_items` sync (`pg`; Docker-safe, no `apps/api` import).
- `src/workers/imagePublishWorker.ts` — one-iteration orchestration with the safety flag gate.

## Environment

See `apps/jobs/.env.production.example` and `src/config/env.ts`. Staging reads use **`R2_CONTRIBUTOR_STAGING_BUCKET`**. Optional: **`R2_ENDPOINT`** / **`R2_REGION`** (defaults: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, `auto`).
