# PR-16F — Wire real publish-job polling in `apps/jobs`

PR-16F replaces the `listPendingJobs` stub in `apps/jobs` with a real Neon-backed publish-job service, gated by a new safety flag so the worker can run safely against production data without performing image processing.

## 1. Files changed

- `apps/jobs/package.json` — added `pg` (`^8.20.0`) and `@types/pg` (`^8.20.0`) dependencies.
- `apps/jobs/src/index.ts` — passes the new `processingEnabled` / `skipDbAccess` options into the worker, instantiates `ImagePublishJobService` only when `DATABASE_URL` is present, and closes the shared pool in `finally` / on unhandled error.
- `apps/jobs/src/config/env.ts` — added `imagePublishProcessingEnabled` (parsed from `IMAGE_PUBLISH_PROCESSING_ENABLED`, default `false`); renamed `r2PhotographerStagingBucket` field to `r2ContributorStagingBucket` so the typed field matches the env name and PR-15.1 contributor terminology.
- `apps/jobs/src/services/imagePublishJobService.ts` — replaced the placeholder with a full DB-backed implementation (see §4).
- `apps/jobs/src/workers/imagePublishWorker.ts` — replaced the throw-on-pending stub with the dry-run / disabled / placeholder lifecycle described in §5.
- `apps/jobs/.env.production.example` — added `IMAGE_PUBLISH_PROCESSING_ENABLED=false` block with operator notes.
- `apps/jobs/.env.production` (gitignored) — same flag appended to the operator's local copy.
- `docker-compose.jobs.yml` — added `IMAGE_PUBLISH_PROCESSING_ENABLED: "false"` to the `fotocorp-jobs` `environment:` block.
- `apps/jobs/README.md` — rewrote the polling, safety-flag, and concurrency sections.
- `docs/db-revamp/jobs-direct-vps-deployment-runbook.md` — updated "Model", "Dry-run inside the container", and "Known limitation" sections; added a "PR-16F safety flag" section.
- `docs/db-revamp/fotokey-publish-pipeline.md` — clarified that `apps/jobs` now polls Neon, the safety flag, and that real image processing still belongs to the API CLI.
- `context/architecture.md` — updated the Jobs CLI stack row and the `apps/jobs` boundary paragraph.
- `context/progress-tracker.md` — added PR-16F entry under "Completed".

## 2. Files added

- `apps/jobs/src/db/client.ts` — Node-native `pg.Pool` singleton (`getJobsPool`, `closeJobsPool`) plus a `withJobsTransaction` helper used for `FOR UPDATE SKIP LOCKED` claims.
- `docs/db-revamp/reports/pr-16f-real-publish-job-polling-report.md` — this report.

## 3. DB / schema changes

**None.** PR-16F reads and writes the existing `image_publish_jobs` and `image_publish_job_items` tables created by PR-15.1 (`apps/api/drizzle/0021_complex_ikaris.sql`). No new migration, no new columns. The schema enums are unchanged:

- `image_publish_jobs.status ∈ {QUEUED, RUNNING, COMPLETED, FAILED, PARTIAL_FAILED}`
- `image_publish_job_items.status ∈ {QUEUED, RUNNING, COMPLETED, FAILED}`

The PR-16F brief's generic "PENDING / PROCESSING" terms map onto these existing enum values (`QUEUED` and `RUNNING` respectively); no incompatible status string is introduced.

## 4. Service methods added

`apps/jobs/src/services/imagePublishJobService.ts` now exports:

| Method | Behavior |
| --- | --- |
| `countPendingJobs(): Promise<number>` | Read-only count of rows with `status = 'QUEUED'`. |
| `listPendingJobs(limit = 25): Promise<PublishJobRow[]>` | Read-only page of queued jobs (FIFO by `created_at`, clamped to 1..200). |
| `claimNextPendingJob(): Promise<ClaimedPublishJob \| null>` | Inside a transaction: `SELECT … WHERE status = 'QUEUED' ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`, then `UPDATE … SET status = 'RUNNING', started_at = COALESCE(started_at, now())`. Returns the claimed job and its items, or `null` if nothing claimable. |
| `getJobItems(jobId): Promise<PublishJobItemRow[]>` | Read-only items for a job (any status). |
| `markItemFailed(itemId, {failureCode, failureMessage})` | Sets `image_publish_job_items.status = 'FAILED'`, writes `failure_code` / `failure_message` (truncated to 500 chars), `completed_at = COALESCE(…)`. |
| `markRemainingItemsFailedForJob(jobId, …)` | Same as above for every item in the job that is still `QUEUED` or `RUNNING`; returns the affected row count. Used by the placeholder lifecycle. |
| `markJobFailed(jobId, {failureCode, failureMessage})` | Reconciles `total_items` / `failed_items` from `image_publish_job_items` and sets the job to `status = 'FAILED'`, `completed_at = COALESCE(…)`. Does **not** touch `image_assets`. |

All public method types live in the same file (`PublishJobRow`, `PublishJobItemRow`, `ClaimedPublishJob`, `MarkFailureInput`). Raw `pg` rows are mapped to typed objects at the service boundary so the worker never handles raw DB shapes.

## 5. Worker behavior

The `ImagePublishWorker.runOnce(options)` now accepts:

```ts
{ skipDbAccess: boolean; dryRun: boolean; processingEnabled: boolean }
```

| Case | Behavior |
| --- | --- |
| `skipDbAccess === true` (no `DATABASE_URL` in dry-run) | Logs `db access skipped (no DATABASE_URL); pending publish jobs=unknown`. Returns. |
| `dryRun === true` | Logs the real queued count via `countPendingJobs()`. Returns without claiming. |
| `dryRun === false && processingEnabled === false` (production default) | Logs the queued count, then logs `processing disabled (IMAGE_PUBLISH_PROCESSING_ENABLED=false); no jobs claimed`. Returns. |
| `dryRun === false && processingEnabled === true && pendingCount === 0` | Logs `no pending publish jobs; nothing to claim`. Returns. |
| `dryRun === false && processingEnabled === true && pendingCount > 0` | Calls `claimNextPendingJob()`. If it returns `null` (race lost), logs and returns. Otherwise logs `claimed publish job id=… jobType=… status=RUNNING`, logs the item count, calls `markRemainingItemsFailedForJob(jobId, PROCESSING_NOT_IMPLEMENTED, …)`, then `markJobFailed(jobId, PROCESSING_NOT_IMPLEMENTED, …)`. Never touches `image_assets`. |

The CLI entry (`apps/jobs/src/index.ts`):

- `--worker` runs `runOnce` in a `for(;;)` loop with `IMAGE_PUBLISH_POLL_INTERVAL_MS` (default 15 000 ms, clamped to ≥1000 ms). On unhandled iteration error it logs, sets `process.exitCode = 1`, rethrows, and closes the pool in `finally` so Docker `restart: unless-stopped` can restart the container cleanly.
- `--once` runs a single iteration and exits 0 on success.
- `--dry-run` (default) tolerates missing service env vars; warns about any missing required env names; counts queued jobs only if `DATABASE_URL` is set.
- All paths call `closeJobsPool()` in `finally` so Node settles the `pg.Pool` before exit.

## 6. Env vars added / changed

| Variable | Default | Effect |
| --- | --- | --- |
| `IMAGE_PUBLISH_PROCESSING_ENABLED` | `false` | When `false`, the worker counts queued jobs but never claims or mutates them. When `true`, it claims one queued job per iteration and marks job + items `FAILED` with `failure_code = PROCESSING_NOT_IMPLEMENTED`. Accepts `true/1/yes` and `false/0/no` (case-insensitive); other values warn and fall back to `false`. |

No env name was removed or renamed. `R2_CONTRIBUTOR_STAGING_BUCKET` remains the correct staging bucket env name; PR-16F additionally renames the internal TypeScript field in `JobsEnvConfig` from `r2PhotographerStagingBucket` to `r2ContributorStagingBucket` so it matches.

## 7. Dry-run behavior

```bash
pnpm --dir apps/jobs publish:dry-run
```

- Without `DATABASE_URL`: prints `warn: dry-run missing env (required for --once / --worker): DATABASE_URL, R2_*` and `[fotocorp-jobs] db access skipped (no DATABASE_URL); pending publish jobs=unknown`. Returns exit code 0.
- With `DATABASE_URL`: connects, runs `SELECT count(*) FROM image_publish_jobs WHERE status = 'QUEUED'`, prints `[fotocorp-jobs] pending publish jobs=N`. Never mutates rows.

Verified locally with `DATABASE_URL` from `apps/jobs/.env.production`; see §11.

## 8. Worker behavior with processing disabled

```bash
IMAGE_PUBLISH_PROCESSING_ENABLED=false pnpm --dir apps/jobs publish:worker
```

Per iteration:

```
[fotocorp-jobs] mode=worker processingEnabled=false
[fotocorp-jobs] worker loop pollIntervalMs=15000 concurrency=1 (concurrency reserved for future parallel item processing)
[fotocorp-jobs] pending publish jobs=N
[fotocorp-jobs] processing disabled (IMAGE_PUBLISH_PROCESSING_ENABLED=false); no jobs claimed
[fotocorp-jobs] worker sleeping 15000ms
```

No DB row is mutated. No asset becomes public. Duplicate workers against the same DB still both report the same queued count safely.

## 9. Worker behavior with processing enabled

```bash
IMAGE_PUBLISH_PROCESSING_ENABLED=true pnpm --dir apps/jobs publish:once
```

When at least one job is `QUEUED`:

```
[fotocorp-jobs] mode=once processingEnabled=true
[fotocorp-jobs] pending publish jobs=3
[fotocorp-jobs] claimed publish job id=<uuid> jobType=CONTRIBUTOR_APPROVAL status=RUNNING
[fotocorp-jobs] job items=<N>
[fotocorp-jobs] processing not implemented; marking job FAILED safely (PROCESSING_NOT_IMPLEMENTED)
[fotocorp-jobs] items marked FAILED=<N>
[fotocorp-jobs] job marked FAILED id=<uuid> failureCode=PROCESSING_NOT_IMPLEMENTED reason=PR-16F polling foundation: image processing (Sharp + R2 promotion) is not implemented in apps/jobs yet.
```

DB state after one iteration:

- `image_publish_jobs.status = 'FAILED'`, `completed_at` set, `total_items` / `failed_items` reconciled from items.
- `image_publish_job_items.status = 'FAILED'` for all items that were `QUEUED` or `RUNNING`, `failure_code = 'PROCESSING_NOT_IMPLEMENTED'`, `failure_message` set, `completed_at` set.
- `image_assets` rows are **not** touched. No `status = 'ACTIVE'` and no `visibility = 'PUBLIC'` transition can happen from this PR.

PR-16F intentionally does **not** run this against real staff/contributor jobs. It is a controlled lifecycle proof.

## 10. Commands run

```bash
pnpm install --filter @fotocorp/jobs...
pnpm --dir apps/jobs check
pnpm --dir apps/jobs publish:dry-run                # without DATABASE_URL exported
DATABASE_URL=<neon dev pooled URL> pnpm --dir apps/jobs publish:dry-run
pnpm --dir apps/api check
pnpm --dir apps/web lint
pnpm --dir apps/web build
```

## 11. Command results

| Command | Result |
| --- | --- |
| `pnpm install --filter @fotocorp/jobs...` | Exit 0; added `pg` + `@types/pg` to the workspace. |
| `pnpm --dir apps/jobs check` | Exit 0 (no TypeScript errors). |
| `pnpm --dir apps/jobs publish:dry-run` (no env) | Exit 0; warned about missing service env names; printed `pending publish jobs=unknown`. |
| `DATABASE_URL=… pnpm --dir apps/jobs publish:dry-run` | Exit 0; connected to Neon dev branch; printed `pending publish jobs=N` from the live `image_publish_jobs` table. No row was mutated (verified with a `SELECT count(*) FROM image_publish_jobs WHERE status='QUEUED'` against the same DB before/after). |
| `pnpm --dir apps/api check` | Exit 0. |
| `pnpm --dir apps/web lint` | Exit 0 with the 10 pre-existing warnings tracked from PR-16E (no errors, no new warnings introduced by PR-16F). |
| `pnpm --dir apps/web build` | Exit 0; Next.js production build completed. |

Static checks and the dry-run-with-DB happy-path are covered. Processing-enabled mode was not exercised against the live DB to preserve real staff/contributor queued jobs — see §15.

## 12. Docker commands run

None in the agent environment (no Docker CLI available). The PR-16E runbook commands continue to work:

```bash
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production config
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production build fotocorp-jobs
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs smoke:sharp
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs publish:dry-run
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production up -d fotocorp-jobs
```

## 13. VPS commands

```bash
cd /opt/fotocorp/app
git pull
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production build fotocorp-jobs
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs smoke:sharp
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs publish:dry-run
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production up -d fotocorp-jobs
docker logs --tail 100 fotocorp-jobs
```

Expected steady-state log (production default):

```
[fotocorp-jobs] mode=worker processingEnabled=false
[fotocorp-jobs] worker loop pollIntervalMs=15000 concurrency=1 ...
[fotocorp-jobs] pending publish jobs=N
[fotocorp-jobs] processing disabled (IMAGE_PUBLISH_PROCESSING_ENABLED=false); no jobs claimed
[fotocorp-jobs] worker sleeping 15000ms
```

If you toggle `IMAGE_PUBLISH_PROCESSING_ENABLED=true` on the VPS, expect the placeholder lifecycle described in §9 to consume queued jobs and mark them `FAILED`. Do not do this against real client data.

## 14. Known limitations

- **No real image processing.** `apps/jobs` does not generate Sharp derivatives or copy R2 objects yet. The API CLI `pnpm --dir apps/api media:process-image-publish-jobs` is still the only path that produces THUMB/CARD/DETAIL derivatives and promotes assets to `ACTIVE + PUBLIC`.
- **Placeholder lifecycle is destructive when enabled.** With `IMAGE_PUBLISH_PROCESSING_ENABLED=true`, a queued job will end the iteration in `FAILED` state with `failure_code = PROCESSING_NOT_IMPLEMENTED`. The asset itself remains `APPROVED + PRIVATE`; it does not regress, but the job row will not retry on its own.
- **No retry / DLQ for the placeholder mode.** A controlled failure is final until the API processor is taught to re-queue or until a follow-up adds retry semantics.
- **Concurrency is still 1.** `IMAGE_PUBLISH_WORKER_CONCURRENCY` is logged and reserved; the loop processes one claimed job per iteration. `FOR UPDATE SKIP LOCKED` does guarantee that running multiple worker containers (or multiple replicas) will not double-claim a job.
- **No HTTP / queue surface.** `apps/jobs` is private and outbound-only. No Cloudflare Queue, no MCP, no public URL.
- **Dotenv not loaded automatically.** Local `pnpm --dir apps/jobs publish:dry-run` reads `process.env` only; export `DATABASE_URL` (or run via Docker Compose `env_file`) to count real queued jobs.

## 15. Follow-up PRs

1. **Move the real image processor into `apps/jobs`.** Port the `apps/api/scripts/media/process-image-publish-jobs.ts` logic into `apps/jobs/src/services/imageProcessor.ts` + `storageService.ts` so the VPS worker can generate derivatives natively. Promote assets to `ACTIVE + PUBLIC` only after all required derivatives are `READY`.
2. **Add retry / backoff / DLQ semantics** for items that fail with non-final reasons (transient R2 errors, etc.).
3. **Decide on Cloudflare Queues vs. direct polling** once real processing is in place.
4. **Optional: dotenv loader for local dev** so `pnpm --dir apps/jobs publish:dry-run` can read `apps/jobs/.env.production` without manual `export`.
5. **Make `IMAGE_PUBLISH_WORKER_CONCURRENCY` real** once parallel processing is safe (per-item locking already exists via `FOR UPDATE SKIP LOCKED`).

## Acceptance criteria checklist

- [x] `apps/jobs` connects to Neon using `DATABASE_URL`.
- [x] Pending publish job count comes from real DB data.
- [x] Dry-run does not mutate DB.
- [x] Worker logs pending job count.
- [x] Worker does not claim jobs when processing is disabled.
- [x] When enabled, worker claims jobs safely using transaction + `FOR UPDATE SKIP LOCKED`.
- [x] Duplicate claiming is prevented by row locking.
- [x] Job items can be loaded.
- [x] No assets become public; `image_assets` is never updated.
- [x] No Sharp/R2 processing is attempted.
- [x] No ports are exposed; worker remains private (`docker-compose.jobs.yml` unchanged on that axis).
- [x] `R2_CONTRIBUTOR_STAGING_BUCKET` remains the env name; old `R2_PHOTOGRAPHER_STAGING_BUCKET` is not reintroduced.
- [x] Docs explain current safe polling behavior.
- [x] `pnpm --dir apps/jobs check`, `pnpm --dir apps/api check`, `pnpm --dir apps/web lint`, `pnpm --dir apps/web build` pass.
