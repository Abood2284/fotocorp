# PR-16E — `apps/jobs` Docker + direct Raff VPS deployment

> **Post-merge addendum (May 2026):** PR-16F/16G added real Neon polling and `ImagePublishProcessor`. A temporary regression imported `apps/api` source from `imagePublishProcessor.ts`, which broke Docker (`ERR_MODULE_NOT_FOUND`). **Fixed:** `apps/jobs/src/lib/public-event-feed-projection.ts` (native `pg`, aligned with API logic) + `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` in the Dockerfile/Compose. Rebuild the image after pulling: `docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production up -d --build fotocorp-jobs`.

## 1. Files added

- `apps/jobs/Dockerfile` — Node 22 bookworm-slim, Corepack pnpm, `libvips42`, workspace-filtered install, non-root `node` user, default `publish:worker`.
- `docker-compose.jobs.yml` — service **`fotocorp-jobs`**, no `ports`, log rotation, production safety env defaults.
- `apps/jobs/.env.production.example` — documents env names aligned with `apps/jobs/src/config/env.ts` (including `R2_CONTRIBUTOR_STAGING_BUCKET`).
- `docs/db-revamp/jobs-direct-vps-deployment-runbook.md` — VPS operator steps under `/opt/fotocorp/app` (referenced from `apps/jobs/README.md` and `context/architecture.md`; recreate or follow README if missing in a given checkout).
- `.dockerignore` — trims build context (excludes `apps/jobs/.env.production` so secrets are not baked into images accidentally).

## 2. Files changed

- `apps/jobs/package.json` — added **`publish:worker`** script.
- `apps/jobs/src/index.ts` — added **`--worker`** poll loop with `IMAGE_PUBLISH_POLL_INTERVAL_MS` / `IMAGE_PUBLISH_WORKER_CONCURRENCY` logging; clearer failure logging on iteration errors.
- `apps/jobs/src/config/env.ts` — batch missing-env detection for production modes; dry-run warns when service vars are absent.
- `apps/jobs/README.md` — Docker + VPS notes, script table updates.
- `.gitignore` — ignore **`apps/jobs/.env.production`**.
- `context/architecture.md` — private Docker worker on VPS; boundary vs web/API.
- `context/progress-tracker.md` — PR-16E completion entry.

**Later (not part of original PR-16E diff, but affects Docker today):**

- PR-16F — `ImagePublishJobService` + `claimNextPendingJob` (`FOR UPDATE SKIP LOCKED`); `IMAGE_PUBLISH_PROCESSING_ENABLED` gate. Report: [`pr-16f-real-publish-job-polling-report.md`](./pr-16f-real-publish-job-polling-report.md).
- PR-16G — `ImagePublishProcessor`, R2 + Sharp publish path. Report: [`pr-16g-real-image-publish-processing-report.md`](./pr-16g-real-image-publish-processing-report.md).
- Public event feed projection — `imagePublishProcessor.ts` imports `schedulePublicEventFeedSyncForAsset` and `createHttpDb` from `apps/api` source. Report: [`pr-public-event-feed-projection-report.md`](./pr-public-event-feed-projection-report.md).

## 3. Dockerfile summary

- **Base:** `node:22-bookworm-slim`
- **OS packages:** `ca-certificates`, `libvips42` (Sharp-friendly runtime on Debian).
- **Package manager:** Corepack **`pnpm@10.33.1`** (matches root `package.json` `packageManager`). Image build runs `corepack prepare pnpm@10.33.1 --activate`; one-off `docker compose run` may still prompt to download pnpm unless `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` is set.
- **Install:** `pnpm install --frozen-lockfile --filter @fotocorp/jobs...` from monorepo root context.
- **Copy scope:** **`apps/jobs` only** (not `apps/api`). This was intentional at PR-16E so the worker image stayed small and did not bundle the API Worker runtime.
- **User:** `node` (non-root).
- **Port:** none exposed.
- **Default `CMD`:** `pnpm --dir apps/jobs run publish:worker`.

## 4. Compose summary

- **Service / container name:** `fotocorp-jobs`
- **Build:** context `.`, dockerfile `apps/jobs/Dockerfile`
- **Restart:** `unless-stopped`
- **Env:** `env_file: apps/jobs/.env.production` plus inline defaults for `NODE_ENV`, allocator/threadpool tuning, worker poll/concurrency.
- **Logging:** `json-file` with `max-size: 10m`, `max-file: 3`
- **Ports:** none

## 5. Env vars required (non-dry-run)

From `apps/jobs/src/config/env.ts`:

| Variable | Role |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `R2_ACCOUNT_ID` | Cloudflare account id for S3 API |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_CONTRIBUTOR_STAGING_BUCKET` | Staging bucket name |
| `R2_ORIGINALS_BUCKET` | Canonical originals bucket |
| `R2_PREVIEWS_BUCKET` | Previews bucket |

**Worker tuning (optional; Compose sets defaults):**

- `IMAGE_PUBLISH_POLL_INTERVAL_MS` — ms between poll iterations (minimum clamped to 1000ms in code).
- `IMAGE_PUBLISH_WORKER_CONCURRENCY` — logged and reserved for future parallel item processing.

**Safety flag (PR-16F+, Compose default `false`):**

- `IMAGE_PUBLISH_PROCESSING_ENABLED` — when `false`, worker counts queued jobs but does not claim; when `true`, claims and runs `ImagePublishProcessor`.

**Process tuning (recommended):**

- `MALLOC_ARENA_MAX`, `UV_THREADPOOL_SIZE` — set in Compose for stable memory/thread behavior under Sharp.

## 6. Deployment commands (operator)

Primary operator doc: **`apps/jobs/README.md`** (Docker section) and, when present, **`docs/db-revamp/jobs-direct-vps-deployment-runbook.md`**.

### Host monorepo (full tree — recommended for `publish:dry-run` until Docker image includes API deps)

```bash
cp apps/jobs/.env.production.example apps/jobs/.env.production
# set DATABASE_URL etc. in apps/jobs/.env.production or export in shell
pnpm --dir apps/jobs smoke:sharp
pnpm --dir apps/jobs publish:dry-run
```

### Docker (VPS)

```bash
cd /opt/fotocorp/app   # or repo root
cp apps/jobs/.env.production.example apps/jobs/.env.production
nano apps/jobs/.env.production
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0   # optional: avoid interactive Corepack prompt on `compose run`
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production config
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production build fotocorp-jobs
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs smoke:sharp
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs publish:dry-run
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production up -d fotocorp-jobs
docker logs -f fotocorp-jobs
```

After merging jobs code, **rebuild** the image (`docker compose ... up -d --build fotocorp-jobs`); `docker compose restart` does not pick up new `COPY` layers.

## 7. Local commands run (original PR-16E verification)

- `pnpm --dir apps/jobs smoke:sharp`
- `pnpm --dir apps/jobs check`
- `pnpm --dir apps/api check`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build`

## 8. Docker commands run

**At PR-16E merge (agent):**

- `docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production config` — **not executed** (Docker CLI not available in the agent environment).
- `docker compose -f docker-compose.jobs.yml build fotocorp-jobs` — **not executed** (same).

**Operator (May 2026):**

- `docker compose ... run --rm fotocorp-jobs pnpm --dir apps/jobs publish:dry-run` — **failed** (see §9).

## 9. Command results

| Command | Result |
| --- | --- |
| `pnpm --dir apps/jobs smoke:sharp` (host) | Exit `0`; JSON `{"ok":true,"runtime":"node","sharpLoaded":true,"outputBytes":68}`. |
| `pnpm --dir apps/jobs check` (host) | Exit `0` at PR-16E; jobs `tsc` only includes `apps/jobs/**` and does not prove Docker resolution of `../../../api/...` imports. |
| `pnpm --dir apps/api check` | Exit `0`. |
| `pnpm --dir apps/web lint` | Exit `0` with **10 pre-existing warnings** (no errors). |
| `pnpm --dir apps/web build` | Exit `0`; Next.js 16.2.3 production build completed. |
| `docker compose ... run ... smoke:sharp` | Expected **pass** (Sharp + `apps/jobs` only). |
| `docker compose ... run ... publish:dry-run` | **Failed** before feed-sync decoupling (missing `apps/api` in image). **Should pass** after rebuild with `apps/jobs/src/lib/public-event-feed-projection.ts`. |

## 10. Docker build tested locally?

**At PR-16E merge: no** (agent sandbox had no Docker).

**Operator: yes** (image builds; pre-fix worker crashed on `apps/api` import; rebuild after feed-sync lives in `apps/jobs` only).

## 11. VPS deployment tested?

**No** end-to-end publish worker on production VPS documented in this report. Operator dry-run in Docker confirmed the **module layout gap**; production worker would hit the same error on boot until fixed.

## 12. Known limitations

### Original PR-16E scope (historical)

- Docker image intentionally contained **`@fotocorp/jobs` only** — no `apps/api` package in the image.
- Agent did not run `docker build` during the original PR.

### Current behavior (after PR-16F / PR-16G / public feed projection)

| Area | Status |
| --- | --- |
| Host `pnpm --dir apps/jobs publish:dry-run` | Works when full monorepo is present; optional `DATABASE_URL` for queued-job count. |
| Docker `publish:dry-run` / `publish:worker` / `publish:once` | **Fixed** — feed projection sync is `apps/jobs/src/lib/public-event-feed-projection.ts` (no `apps/api` in image). Rebuild required. |
| Docker `smoke:sharp` | Should still work (no `apps/api` import). |
| Real publish processing | Implemented in PR-16G when `IMAGE_PUBLISH_PROCESSING_ENABLED=true` and env complete — **on host monorepo**; not in current Docker image until §13 fix. |
| `IMAGE_PUBLISH_WORKER_CONCURRENCY` | Logged only; items processed sequentially per claimed job. |
| Corepack on `compose run` | May prompt `Do you want to continue? [Y/n]` if pnpm not prepared in that invocation; set `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` or rely on image build layer that runs `corepack prepare`. |

## 13. Follow-up PRs

1. Optional: extract shared feed-projection SQL into `packages/*` if API and jobs must stay byte-identical (today jobs module is documented as aligned with API).
2. Re-verify on VPS after each jobs deploy: `smoke:sharp` → `publish:dry-run` → `up -d` with `IMAGE_PUBLISH_PROCESSING_ENABLED=false`, then enable processing in a controlled window.
3. Harden worker backoff / DLQ semantics as real failure volume appears.
4. Optional CapRover or systemd unit if the team standardizes away from raw Compose.

## 14. Related reports

- [`pr-16f-real-publish-job-polling-report.md`](./pr-16f-real-publish-job-polling-report.md) — Neon claim + safety flag.
- [`pr-16g-real-image-publish-processing-report.md`](./pr-16g-real-image-publish-processing-report.md) — Sharp + R2 processor.
- [`pr-public-event-feed-projection-report.md`](./pr-public-event-feed-projection-report.md) — why jobs imports API projection helpers.
