# Fotocorp Jobs (`apps/jobs`)

Node CLI package for background image publish work. This is **not** a Cloudflare Worker: it runs under real **Node.js** so **native Sharp** and similar addons are supported.

## Scripts

| Script | Command | Notes |
| --- | --- | --- |
| `dev` | `tsx src/index.ts --dry-run` | Local developer convenience. |
| `publish:dry-run` | `tsx src/index.ts --dry-run` | Safe read-only mode. Connects to Neon only if `DATABASE_URL` is set; if unset, the CLI warns and reports `pending publish jobs=unknown`. Never claims or mutates rows. |
| `publish:once` | `tsx src/index.ts --once` | Validates required env, runs one poll iteration, then exits. Gated by `IMAGE_PUBLISH_PROCESSING_ENABLED` (see below). |
| `publish:worker` | `tsx src/index.ts --worker` | Production poll loop (`IMAGE_PUBLISH_POLL_INTERVAL_MS`). Same gating as `publish:once`; exits non-zero on unexpected fatal errors so Docker `restart: unless-stopped` can recover. |
| `smoke:sharp` | `tsx scripts/smoke/check-sharp-node.ts` | Proves Sharp loads and encodes a tiny in-memory image. |
| `check` | `tsc -p tsconfig.json --noEmit` | Typecheck. |

Root `pnpm dev` starts web + API only. Run `pnpm dev:jobs` manually when you need a quick dry-run of the jobs CLI.

## Publish-job polling (PR-16F)

The worker now polls real `image_publish_jobs` rows from Neon via native `pg`. Status vocabulary follows the existing API schema:

| Lifecycle stage | `image_publish_jobs.status` | `image_publish_job_items.status` |
| --- | --- | --- |
| Created by staff approval | `QUEUED` | `QUEUED` |
| Claimed by the worker | `RUNNING` | unchanged (item-level statuses are managed by the future processor) |
| Controlled placeholder failure (PR-16F) | `FAILED` | `FAILED` with `failure_code = PROCESSING_NOT_IMPLEMENTED` |

The schema enum reality is `QUEUED / RUNNING / COMPLETED / FAILED / PARTIAL_FAILED` (jobs) and `QUEUED / RUNNING / COMPLETED / FAILED` (items); we never introduce other enum values.

### Safety flag

```env
IMAGE_PUBLISH_PROCESSING_ENABLED=false   # default — read-only count, no claiming
IMAGE_PUBLISH_PROCESSING_ENABLED=true    # claim one job per iteration; placeholder lifecycle
```

| Flag | `publish:dry-run` | `publish:once` / `publish:worker` |
| --- | --- | --- |
| any | counts queued jobs if `DATABASE_URL` is set; never claims | — |
| `false` | — | counts queued jobs, logs `processing disabled`, does **not** claim |
| `true` | — | claims one queued job via `FOR UPDATE SKIP LOCKED`, marks its items + job `FAILED` with `failure_code = PROCESSING_NOT_IMPLEMENTED`, never touches `image_assets` |

Real Sharp + R2 derivative generation lives in a follow-up PR. Until then, **leave `IMAGE_PUBLISH_PROCESSING_ENABLED=false` for real staff/contributor data.** Only set it to `true` against a development DB you are willing to mark a job `FAILED` against.

### Concurrency and duplicate claims

Claiming uses an explicit transaction with `SELECT … FOR UPDATE SKIP LOCKED LIMIT 1` followed by an `UPDATE … SET status = 'RUNNING'`. Running multiple worker instances against the same DB will not double-claim a job.

### Local dry-run

```bash
pnpm --dir apps/jobs publish:dry-run
```

Set `DATABASE_URL` first (e.g. in your shell) if you want the dry-run to count real queued jobs. Without it the dry-run prints `pending publish jobs=unknown` and warns about the missing env vars.

## Docker (private VPS, no public URL)

Build context is the **monorepo root**. The container runs as user **`node`**, exposes **no HTTP port**, and loads secrets from **`apps/jobs/.env.production`** (gitignored; start from `.env.production.example`).

```bash
cp apps/jobs/.env.production.example apps/jobs/.env.production
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production config
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production build fotocorp-jobs
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs smoke:sharp
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs publish:dry-run
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production up -d fotocorp-jobs
```

Operator-focused steps (Ubuntu, `/opt/fotocorp/app`, SSH-only firewall) live in [`docs/db-revamp/jobs-direct-vps-deployment-runbook.md`](../../docs/db-revamp/jobs-direct-vps-deployment-runbook.md).

**CapRover / DNS** are not required for this deployment path; they can be added later if you want a platform domain in front of other services. The jobs worker stays **off the public internet**.

## Layout

- `src/index.ts` — CLI entry (no Worker `fetch` export).
- `src/config/env.ts` — typed env loader; dry-run tolerates missing service env vars with warnings; parses `IMAGE_PUBLISH_PROCESSING_ENABLED`.
- `src/db/client.ts` — Node-native `pg.Pool` singleton and `withJobsTransaction` helper.
- `src/services/imagePublishJobService.ts` — DB-backed publish-job service (`countPendingJobs`, `listPendingJobs`, `claimNextPendingJob`, `getJobItems`, `markJobFailed`, `markItemFailed`, `markRemainingItemsFailedForJob`).
- `src/workers/imagePublishWorker.ts` — one-iteration orchestration with the safety flag gate.
- `src/services/imageProcessor.ts`, `src/services/storageService.ts` — Sharp / R2 placeholders for the follow-up PR.

## Environment

See `apps/jobs/.env.production.example` and `src/config/env.ts`. R2 staging uses **`R2_CONTRIBUTOR_STAGING_BUCKET`** (contributor upload staging bucket name). PR-16F adds **`IMAGE_PUBLISH_PROCESSING_ENABLED`** (default `false`).
