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

- **Derivative generation** runs in Node with Sharp. **Primary VPS path (PR-16G):** `apps/jobs` with `IMAGE_PUBLISH_PROCESSING_ENABLED=true` claims `image_publish_jobs`, reads originals (canonical bucket first, contributor staging fallback), writes watermarked WebP previews, upserts `image_derivatives`, then promotes `image_assets` to `ACTIVE + PUBLIC` only after all required derivatives succeed.
- **Backfill / operator CLI:** `pnpm --dir apps/api media:process-image-publish-jobs` (same R2 keys and DB semantics as PR-15.1; see [fotokey-publish-pipeline-report.md](./reports/fotokey-publish-pipeline-report.md)).
- **`apps/jobs`** is a **Node CLI** (PR-16A skeleton, PR-16E Dockerized for private VPS, PR-16F Neon polling + claim, PR-16G real processing). It is **not** a Cloudflare Worker. Native Sharp belongs here, not in the Worker bundle.
- Safety flag: **`IMAGE_PUBLISH_PROCESSING_ENABLED`** (default **`false`**). With the default, `apps/jobs` only logs queued counts; it does not claim jobs. With `true` on the VPS, the worker performs real publish processing; keep `false` until R2 + Neon env on the worker is verified.
- Retries / DLQ / queues remain future work.
