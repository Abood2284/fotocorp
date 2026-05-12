# PR-16E — `apps/jobs` Docker + direct Raff VPS deployment

## 1. Files added

- `apps/jobs/Dockerfile` — Node 22 bookworm-slim, Corepack pnpm, `libvips42`, workspace-filtered install, non-root `node` user, default `publish:worker`.
- `docker-compose.jobs.yml` — service **`fotocorp-jobs`**, no `ports`, log rotation, production safety env defaults.
- `apps/jobs/.env.production.example` — documents env names aligned with `apps/jobs/src/config/env.ts` (including `R2_CONTRIBUTOR_STAGING_BUCKET`).
- `docs/db-revamp/jobs-direct-vps-deployment-runbook.md` — VPS operator steps under `/opt/fotocorp/app`.
- `.dockerignore` — trims build context (excludes `apps/jobs/.env.production` so secrets are not baked into images accidentally).

## 2. Files changed

- `apps/jobs/package.json` — added **`publish:worker`** script.
- `apps/jobs/src/index.ts` — added **`--worker`** poll loop with `IMAGE_PUBLISH_POLL_INTERVAL_MS` / `IMAGE_PUBLISH_WORKER_CONCURRENCY` logging; clearer failure logging on iteration errors.
- `apps/jobs/src/config/env.ts` — batch missing-env detection for production modes; dry-run warns when service vars are absent.
- `apps/jobs/README.md` — Docker + VPS notes, script table updates.
- `.gitignore` — ignore **`apps/jobs/.env.production`**.
- `context/architecture.md` — private Docker worker on VPS; boundary vs web/API.
- `context/progress-tracker.md` — PR-16E completion entry.

## 3. Dockerfile summary

- **Base:** `node:22-bookworm-slim`
- **OS packages:** `ca-certificates`, `libvips42` (Sharp-friendly runtime on Debian).
- **Package manager:** Corepack **`pnpm@10.33.1`** (matches root `package.json` `packageManager`).
- **Install:** `pnpm install --frozen-lockfile --filter @fotocorp/jobs...` from monorepo root context.
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

**Process tuning (recommended):**

- `MALLOC_ARENA_MAX`, `UV_THREADPOOL_SIZE` — set in Compose for stable memory/thread behavior under Sharp.

## 6. Deployment commands (operator)

See **`docs/db-revamp/jobs-direct-vps-deployment-runbook.md`**. Short form:

```bash
cd /opt/fotocorp/app
cp apps/jobs/.env.production.example apps/jobs/.env.production
nano apps/jobs/.env.production
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production config
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production build fotocorp-jobs
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs smoke:sharp
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs publish:dry-run
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production up -d fotocorp-jobs
docker logs -f fotocorp-jobs
```

## 7. Local commands run

- `pnpm --dir apps/jobs smoke:sharp`
- `pnpm --dir apps/jobs check`
- `pnpm --dir apps/api check`
- `pnpm --dir apps/web lint`
- `pnpm --dir apps/web build`

## 8. Docker commands run

- `docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production config` — **not executed** (Docker CLI not available in the agent environment).
- `docker compose -f docker-compose.jobs.yml build fotocorp-jobs` — **not executed** (same).

## 9. Command results

| Command | Result |
| --- | --- |
| `pnpm --dir apps/jobs smoke:sharp` | Exit `0`; JSON `{"ok":true,"runtime":"node","sharpLoaded":true,"outputBytes":68}`. |
| `pnpm --dir apps/jobs check` | Exit `0`. |
| `pnpm --dir apps/api check` | Exit `0`. |
| `pnpm --dir apps/web lint` | Exit `0` with **10 pre-existing warnings** (no errors). |
| `pnpm --dir apps/web build` | Exit `0`; Next.js 16.2.3 production build completed. |

## 10. Docker build tested locally?

**No.** The sandbox did not have `docker` on `PATH`. Operators should run `docker compose ... config` and `build` on the VPS (or any machine with Docker) per the runbook.

## 11. VPS deployment tested?

**No** — expected operator verification on the Raff VPS after merge.

## 12. Known limitations

- **`listPendingJobs`** is still a placeholder (returns `[]`). Real DB polling is a follow-up.
- **`publish:once` / `publish:worker`** **throw** if pending publish jobs exist (`ImagePublishWorker` not implemented for real processing). Use **`publish:dry-run`** on databases that may already have queued jobs.
- **`IMAGE_PUBLISH_WORKER_CONCURRENCY`** is not yet applied to parallel work; it is logged and reserved.

## 13. Follow-up PRs

- Wire `ImagePublishJobService.listPendingJobs` to `image_publish_jobs` / items and migrate processing from `apps/api` scripts where appropriate.
- Harden worker backoff / DLQ semantics once real failures exist.
- Optional CapRover or systemd unit if the team standardizes away from raw Compose.
