# Fotokey / Publish Pipeline

Operating summary for Fotokey allocation, R2 promotion, and derivative-backed go-live. Full implementation notes: [fotokey-publish-pipeline-report.md](./reports/fotokey-publish-pipeline-report.md).

## Fotokey format

```txt
FC + DD + MM + YY + sequence
```

## Examples

| Example | Meaning |
| --- | --- |
| `FC010126001` | 01 Jan 2026, sequence 1 (min 3-digit padding) |
| `FC010126999` | Same date, sequence 999 |
| `FC0101261000` | Sequences can exceed three digits when volume requires |

## Rules

- Generated **only on admin approval**, never at photographer upload or batch submit.
- **Sequence** follows **admin approval order** (bulk approve request array order) for the business date (`fotokey_daily_counters`, timezone `Asia/Kolkata`).
- Sequence is padded to **minimum 3 digits**; values may grow beyond `999`.
- **No hard delete** after Fotokey exists (guard `ASSET_HAS_FOTOKEY`).
- **Canonical originals** use the Fotokey filename in bucket `fotocorp-2026-megafinal` (binding `MEDIA_ORIGINALS_BUCKET` in Worker config).
- **Photographer staging** uploads use bucket `fotocorp-2026-contributor-uploads` (binding `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET`).
- **Previews** (watermarked derivatives) are written under `previews/watermarked/<variant>/<fotokey>.webp` in `fotocorp-2026-previews` (`MEDIA_PREVIEWS_BUCKET`).
- An image becomes **`ACTIVE` + `PUBLIC`** only after required derivatives (`THUMB`, `CARD`, `DETAIL`) are **`READY`** in `image_derivatives`.
- **Admin approval alone does not go-live an asset.** Approval assigns Fotokey, copies the staging original to the canonical originals bucket, and enqueues publish job rows; visibility flips only after derivative generation completes successfully.

## Runtime: API processor vs Node `apps/jobs`

- **Today's image processor CLI** (reads `image_publish_jobs`, writes derivatives): `pnpm --dir apps/api media:process-image-publish-jobs` (see [fotokey-publish-pipeline-report.md](./reports/fotokey-publish-pipeline-report.md) for flags and idempotency). This is still the only path that actually generates derivatives and promotes assets to `ACTIVE + PUBLIC`.
- **`apps/jobs`** is a **Node CLI** (PR-16A skeleton, PR-16E Dockerized for private VPS, PR-16F real DB polling). As of PR-16F it connects to Neon via `pg`, counts queued publish jobs, and — only when explicitly enabled — can safely claim one via `FOR UPDATE SKIP LOCKED`. It is **not** a Cloudflare Worker. Native Sharp belongs here (or other Node contexts), not in the Worker bundle.
- PR-16F safety flag: **`IMAGE_PUBLISH_PROCESSING_ENABLED`** (default **`false`**). With the default, `apps/jobs` only logs queued counts; it does not claim jobs and does not mutate `image_assets`. With `true`, the worker runs a placeholder lifecycle (items + job → `FAILED` with `failure_code = PROCESSING_NOT_IMPLEMENTED`) for development testing only — no asset goes public.
- Long-term, heavy Sharp publish work is expected to migrate from the API processor CLI into `apps/jobs`, with retries / DLQ / queues added in follow-up PRs.
