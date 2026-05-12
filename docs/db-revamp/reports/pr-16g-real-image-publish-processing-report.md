# PR-16G — Real IMAGE publish processing in `apps/jobs`

## 1. Files changed

| Area | Paths |
| --- | --- |
| New | `apps/jobs/src/lib/r2Client.ts`, `apps/jobs/src/lib/watermarkProfile.ts`, `apps/jobs/src/media/publishImageDerivatives.ts`, `apps/jobs/src/services/imagePublishProcessor.ts` |
| Updated | `apps/jobs/src/services/imagePublishJobService.ts`, `apps/jobs/src/workers/imagePublishWorker.ts`, `apps/jobs/src/index.ts`, `apps/jobs/src/config/env.ts`, `apps/jobs/README.md`, `apps/jobs/.env.production.example`, `docker-compose.jobs.yml` |
| Removed | `apps/jobs/src/services/imageProcessor.ts`, `apps/jobs/src/services/storageService.ts` (placeholders) |
| Cross-reference | `apps/api/scripts/media/process-image-publish-jobs.ts` (header note: VPS path is `apps/jobs`) |
| Docs / context | `context/architecture.md`, `context/progress-tracker.md`, `docs/db-revamp/fotokey-publish-pipeline.md`, `docs/db-revamp/jobs-direct-vps-deployment-runbook.md` |

## 2. Services added / updated

- **`ImagePublishProcessor`** (`imagePublishProcessor.ts`): loads contributor IMAGE publish context from Neon, resolves original bytes (canonical originals bucket via HEAD/GET; if missing, GET staging + PUT canonical), generates THUMB/CARD/DETAIL watermarked WebPs with Sharp, PUTs previews to R2, then calls `ImagePublishJobService.completeSuccessfulPublishItem`.
- **`ImagePublishJobService`** (extended): `fetchAssetPublishGate`, `markItemRunning`, `completeSuccessfulPublishItem` (transaction: upsert `image_derivatives`, conditional `image_assets` promotion, mark item `COMPLETED`), `reconcilePublishJobAggregate` (job status + counts from items).
- **`ImagePublishWorker`**: when `IMAGE_PUBLISH_PROCESSING_ENABLED=true`, passes typed `jobsEnv` into the processor; on fatal errors marks remaining open items `WORKER_FATAL` and reconciles the job.

## 3. Derivative logic reused or created

- **Reused semantics** from `apps/api/scripts/media/process-image-publish-jobs.ts`: `PREVIEW_VARIANT_PROFILES` (THUMB 220px, CARD 300px + byte budget, DETAIL 520px + byte budget), multi-quality search, SVG tiled “fotocorp” watermark, WebP encode settings, `previews/watermarked/<thumb|card|detail>/<fotokey>.webp` keys, `image_derivatives` upsert SQL shape, `CURRENT_WATERMARK_PROFILE` string (`fotocorp-preview-v4-dense-dark-lowquality`).
- **Implemented in** `apps/jobs/src/media/publishImageDerivatives.ts` (no Worker import of `apps/api` runtime).

## 4. R2 keys / buckets

| Step | Bucket env | Key pattern |
| --- | --- | --- |
| Canonical original (read / optional write) | `R2_ORIGINALS_BUCKET` | `FCddmmyyNNN.<ext>` (from `canonical_original_key` / `image_assets.original_storage_key`) |
| Staging fallback read | `R2_CONTRIBUTOR_STAGING_BUCKET` | `source_storage_key` from `image_publish_job_items` (env bucket used; warn if `source_bucket` differs) |
| Watermarked previews | `R2_PREVIEWS_BUCKET` | `previews/watermarked/{thumb|card|detail}/<fotokey>.webp` |

Signing: AWS Signature V4 (same approach as the API publish script), optional `R2_ENDPOINT` / `R2_REGION`.

## 5. DB status transitions

- **Job:** `QUEUED` → `RUNNING` on claim → terminal `COMPLETED`, `FAILED`, or `PARTIAL_FAILED` after `reconcilePublishJobAggregate` (from item counts).
- **Item:** `QUEUED` → `RUNNING` (`markItemRunning`) → `COMPLETED` (success path inside transaction) or `FAILED` (`markItemFailed` / fatal paths) with `failure_code` / `failure_message`.
- **`image_assets`:** success path only: `APPROVED` + `PRIVATE` → `ACTIVE` + `PUBLIC` in the same transaction as derivative upserts and item completion, guarded by `where status = 'APPROVED' and visibility = 'PRIVATE' and fotokey is not null`.

## 6. How asset privacy is preserved on failure

- Promotion SQL runs **only** after all three preview PUTs succeed and **only** if the asset row still matches `APPROVED`/`PRIVATE`/`fotokey` guard; otherwise the transaction throws and rolls back DB changes (R2 preview objects may exist as orphans; operator can retry or clean manually).
- Any Sharp/R2/network error in `processOneItem` is caught, item marked `FAILED`, asset left unchanged.
- Unsupported / invalid gate (`UNSUPPORTED_MEDIA_TYPE`, `NOT_CONTRIBUTOR_IMAGE`, `INVALID_ASSET_STATE`, etc.) marks the item `FAILED` without touching the asset row.

## 7. Commands run

```bash
pnpm --dir apps/jobs check
pnpm --dir apps/jobs smoke:sharp
pnpm --dir apps/jobs publish:dry-run
pnpm --dir apps/api check
pnpm --dir apps/api run smoke:hono-routes
pnpm --dir apps/web lint
pnpm --dir apps/web build
```

Docker Compose build/config steps from the PR checklist were **not** run here (`docker` binary unavailable in this environment).

## 8. Known limitations

- **Sequential items** per claimed job; `IMAGE_PUBLISH_WORKER_CONCURRENCY` is reserved.
- **No automatic retry** of failed publish items; failed jobs stay failed until manual intervention or API backfill CLI.
- **Multi-item jobs:** `claimNextPendingJob` only selects `image_publish_jobs.status = 'QUEUED'`. If a worker dies after partially completing a multi-item job, the job can remain `RUNNING` with leftover `QUEUED` items that no other worker will pick up; mitigate with single-item approval batches or manual DB intervention until a future “stale RUNNING reclaim” PR.
- **Contributor IMAGE only** in the gate; future `VIDEO` / caricature types would fail items with `UNSUPPORTED_MEDIA_TYPE` (schema today constrains `image_assets.media_type` to `IMAGE` only).
- **API approval already copies** staging → originals; the worker’s staging path is a **resilience** path if the canonical object is missing.

## 9. Deployment steps for VPS

1. Ensure `apps/jobs/.env.production` has valid `DATABASE_URL`, R2 credentials, `R2_CONTRIBUTOR_STAGING_BUCKET`, `R2_ORIGINALS_BUCKET`, `R2_PREVIEWS_BUCKET` (names aligned with Cloudflare buckets used by the API).
2. Deploy updated image: `docker compose -f docker-compose.jobs.yml build fotocorp-jobs` (from repo root).
3. Smoke inside container: `pnpm --dir apps/jobs smoke:sharp`, optional `publish:dry-run` with `DATABASE_URL` set.
4. When ready for live processing, set `IMAGE_PUBLISH_PROCESSING_ENABLED=true` in `apps/jobs/.env.production` (or Compose override) and restart the service.
5. Monitor logs for `[fotocorp-jobs.publish-item-complete]` vs `[fotocorp-jobs.publish-item-failed]`; never expose R2 keys or secrets in log lines (errors redact key material).
