# PR-15.1 — Photographer Publish Pipeline with Fotokey + Staging Bucket

## Goal

Replace the "approve = instant public" shortcut shipped in PR-15 with a
real publish pipeline that:

1. Keeps photographer pre-approval objects in a separate **staging** R2
   bucket (`fotocorp-2026-contributor-uploads`).
2. Allocates a **Fotokey** only when an admin approves an upload, in the
   admin-selected order.
3. Promotes the canonical original from the staging bucket to the
   canonical originals bucket (`fotocorp-2026-megafinal`) named after the
   Fotokey.
4. Queues a **publish job** that generates required watermarked
   derivatives in the previews bucket (`fotocorp-2026-previews`) before
   the asset becomes `ACTIVE + PUBLIC`.

Fotokey is the spine of the catalog. Once assigned, it is permanent and
the asset must not be hard-deleted.

## Bucket model

| Role | Bucket name | Worker binding | Env var (S3 API) |
|---|---|---|---|
| Photographer staging | `fotocorp-2026-contributor-uploads` | `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET` | `CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET` |
| Canonical originals  | `fotocorp-2026-megafinal`            | `MEDIA_ORIGINALS_BUCKET`             | `CLOUDFLARE_R2_ORIGINALS_BUCKET`             |
| Previews/derivatives | `fotocorp-2026-previews`             | `MEDIA_PREVIEWS_BUCKET`              | `CLOUDFLARE_R2_PREVIEWS_BUCKET`              |

Staging keys (opaque):

```
staging/<photographer_id>/<event_id>/<batch_id>/<upload_item_id>.<ext>
```

Canonical originals keys (Fotokey-based, root of bucket):

```
FCddmmyyNNN.jpg
FCddmmyyNNN.png
FCddmmyyNNN.webp
```

Preview/derivatives keys (matches existing convention):

```
previews/watermarked/thumb/FCddmmyyNNN.webp
previews/watermarked/card/FCddmmyyNNN.webp
previews/watermarked/detail/FCddmmyyNNN.webp
```

The browser must never see any of these keys, bucket names, or signed
storage URLs. Pre-approval objects must never be written to the canonical
originals bucket. Canonical originals must never be hard-deleted after
Fotokey assignment.

## Fotokey model

- **Format**: `FC` + `DD` + `MM` + `YY` + sequence
  (e.g. `FC010126001`, `FC010126999`, `FC0101261000`).
- **Sequence**: minimum 3 digits, may grow beyond 999.
- **Sequence basis**: global per business date (no per-photographer or
  per-event scope).
- **Business date**: `Asia/Kolkata` of admin approval time.
- **Assignment trigger**: admin approval of a SUBMITTED upload only.
- **Approval order**: the order of `imageAssetIds` in the approve request
  body decides the Fotokey sequence (admin intent is canonical).

### Schema

`image_assets` (added in PR-15.1):

| Column | Type | Notes |
|---|---|---|
| `fotokey` | `text` | nullable; unique partial index where not null |
| `fotokey_date` | `date` | business date the Fotokey was assigned |
| `fotokey_sequence` | `bigint` | reserved per-day sequence |
| `fotokey_assigned_at` | `timestamptz` | wall clock at assignment |

`image_assets.status` check constraint widened to include `'APPROVED'`:

```
status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'ARCHIVED', 'DELETED', 'MISSING_ORIGINAL', 'UNKNOWN')
```

Indexes:

```sql
create unique index image_assets_fotokey_uidx
  on image_assets (fotokey)
  where fotokey is not null;

create index image_assets_fotokey_date_sequence_idx
  on image_assets (fotokey_date, fotokey_sequence)
  where fotokey is not null;
```

`fotokey_daily_counters`:

```sql
create table fotokey_daily_counters (
  code_date date primary key,
  last_sequence bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Allocator

`apps/api/src/lib/fotokey/allocator.ts`

```ts
allocateFotokeysForApproval(db, count, approvalDate)
```

1. `insert ... on conflict do nothing` to ensure a row exists for the
   business date.
2. `select ... for update` to lock the counter row.
3. `update last_sequence = last_sequence + count` to reserve a contiguous
   block.
4. Return ordered sequences `[start+1, start+2, ..., start+count]`.

The caller assigns these in the **admin-selected order** of
`imageAssetIds`.

`formatFotokey(date, sequence)` formats `FC + DD + MM + YY + sequence`
with `sequence.toString().padStart(3, '0')`.

## Publish job tables (PR-15.1)

`image_publish_jobs`:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `job_type` | `text` | default `'PHOTOGRAPHER_APPROVAL'` |
| `status` | `text` | `QUEUED \| RUNNING \| COMPLETED \| FAILED \| PARTIAL_FAILED` |
| `requested_by_admin_user_id` | `text` | from `x-admin-auth-user-id` header |
| `total_items` / `completed_items` / `failed_items` | `integer` | reconciled by processor |
| `created_at` / `started_at` / `completed_at` / `updated_at` | `timestamptz` | |

`image_publish_job_items`:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `job_id` | `uuid` | FK → `image_publish_jobs.id`, `on delete cascade` |
| `image_asset_id` | `uuid` | FK → `image_assets.id`, `on delete restrict` |
| `status` | `text` | `QUEUED \| RUNNING \| COMPLETED \| FAILED` |
| `fotokey` | `text` | not null; copied from the asset at queue time |
| `canonical_original_key` | `text` | e.g. `FC010126001.jpg` |
| `source_bucket` / `source_storage_key` | `text` | for forensics |
| `failure_code` / `failure_message` | `text` | nullable |
| `created_at` / `started_at` / `completed_at` / `updated_at` | `timestamptz` | |

Indexes include a partial unique index on
`image_publish_job_items(image_asset_id) where status in ('QUEUED','RUNNING')`
to prevent duplicate active items per asset.

## Approval flow (PR-15.1)

`POST /api/v1/internal/admin/photographer-uploads/approve`

Phases:

1. **Pre-flight (read-only)** — for each requested `imageAssetId`, verify
   it is upload-linked, FOTOCORP, SUBMITTED+PRIVATE, has no Fotokey, has
   a supported extension, and the staging object exists. Anything else is
   appended to `skipped` with a safe reason.
2. **Allocate Fotokeys** — open a Drizzle/Neon transaction, insert/lock
   the `fotokey_daily_counters` row, reserve a sequence range matching
   the verified count, return ordered sequences.
3. **Promote originals** — for each verified item, build the canonical
   key (`FC + ddmmyy + sequence + .ext`, with `jpeg → jpg`) and copy the
   staging object to the canonical originals bucket via S3
   `CopyObject` + `HeadObject` (`copyStagingObjectToOriginals`). Failures
   here become `STAGING_COPY_FAILED` skips. Fotokey sequence numbers are
   spent even when the copy fails (rare; canonical bucket gap is
   documented to keep monotonic sequences).
4. **DB update + queue publish** — in a second Drizzle transaction:
   - revalidate the row precondition (race protection),
   - update `image_assets`:
     ```
     fotokey, fotokey_date, fotokey_sequence, fotokey_assigned_at,
     original_storage_key, original_filename,
     status = APPROVED, visibility = PRIVATE, updated_at = now()
     ```
   - insert `image_publish_jobs` (`requested_by_admin_user_id` from
     `x-admin-auth-user-id` header),
   - insert one `image_publish_job_items` per successfully approved
     asset.

Response:

```json
{
  "ok": true,
  "approvedCount": 3,
  "publishJobId": "...",
  "items": [
    { "imageAssetId": "...", "fotokey": "FC010126001", "status": "APPROVED" }
  ],
  "skipped": [
    { "imageAssetId": "...", "reason": "ALREADY_HAS_FOTOKEY" }
  ]
}
```

The asset is `APPROVED + PRIVATE` after this call. **Approval does not
make the asset live.** It only assigns identity and queues derivatives.

## Publish processor (PR-15.1)

CLI: `apps/api/scripts/media/process-image-publish-jobs.ts`

```bash
pnpm --dir apps/api media:process-image-publish-jobs -- --limit 25
pnpm --dir apps/api media:process-image-publish-jobs -- --job-id <uuid>
pnpm --dir apps/api media:process-image-publish-jobs -- --image-asset-id <uuid>
pnpm --dir apps/api media:process-image-publish-jobs -- --dry-run --limit 5
```

Per item:

1. Mark the item `RUNNING`; mark its job `RUNNING` if still `QUEUED`.
2. Fetch the canonical original from the originals bucket using
   `image_assets.original_storage_key` (the Fotokey-named key).
3. Generate watermarked WebP derivatives at the same dimensions/quality
   as `apps/api/scripts/media/generate-watermarked-derivatives.ts`:

   | Variant | Width | Quality candidates | Size budget |
   |---|---|---|---|
   | `THUMB`  | 220 | `26, 22` | (none) |
   | `CARD`   | 300 | `14` | ≤ 22 KB |
   | `DETAIL` | 520 | `20, 16, 12` | ≤ 120 KB |

4. PUT each derivative to the previews bucket under
   `previews/watermarked/<variant>/<fotokey>.webp`.
5. Upsert the `image_derivatives` row (`generation_status = READY`,
   `is_watermarked = true`, `watermark_profile = CURRENT_WATERMARK_PROFILE`,
   `source = GENERATED`).
6. Only after all required derivatives upserted READY:
   ```sql
   update image_assets
   set status = 'ACTIVE',
       visibility = 'PUBLIC',
       original_exists_in_storage = true,
       original_storage_checked_at = now(),
       updated_at = now()
   where id = $1::uuid
     and status = 'APPROVED'
     and visibility = 'PRIVATE'
     and fotokey is not null;
   ```
7. Mark the item `COMPLETED`.

On any error: the item is marked `FAILED` with `failure_code` /
`failure_message`. The asset stays `APPROVED + PRIVATE`. **Failed items
are never made public.**

After processing a batch, the script reconciles each touched job:

- still queued/running items → `RUNNING`
- all completed → `COMPLETED`
- mixed completed/failed → `PARTIAL_FAILED`
- only failed → `FAILED`

Heavy image processing must not run in the request path; this is a CLI
script triggered by an operator/cron.

## Status lifecycle

```
Photographer upload
  source = FOTOCORP
  status = SUBMITTED
  visibility = PRIVATE
  fotokey = NULL
  object: photographer staging bucket

Admin approval (this PR)
  Fotokey assigned
  original copied: staging → canonical originals bucket as FC...ext
  status = APPROVED
  visibility = PRIVATE
  publish job + items queued

Publish job success
  derivatives generated in previews bucket (THUMB, CARD, DETAIL READY)
  status = ACTIVE
  visibility = PUBLIC

Publish job failure
  status = APPROVED
  visibility = PRIVATE
  job item FAILED with failure_code/failure_message
```

## Hard-delete guard

- Hard-delete of `image_assets` is blocked at the code level once a
  Fotokey is assigned. The choke point is
  `apps/api/src/lib/assets/asset-delete-guard.ts#assertAssetCanBeHardDeleted`,
  which throws `AppError(409, "ASSET_HAS_FOTOKEY", ...)`.
- No hard-delete endpoint exists in this PR. Any future delete route
  must call this guard before issuing a `DELETE`.
- Documented invariant: after Fotokey assignment, assets must only be
  hidden, archived, or replaced. Replace/version flow is deferred.

## Validation

`apps/api/scripts/db/validate-fotokey-publish-pipeline.ts`
(`pnpm --dir apps/api db:validate:fotokey-publish`):

1. Duplicate Fotokeys → 0.
2. Fotokey format `^FC[0-9]{6}[0-9]{3,}$` → 0 bad rows.
3. Fotokey date/sequence/assigned_at consistency → 0 bad rows.
4. Active + public + photographer-uploaded assets without all of
   `THUMB/CARD/DETAIL` `READY` → 0 (scoped to upload-linked assets to
   avoid legacy gaps).
5. Upload-linked APPROVED/ACTIVE assets without a Fotokey → 0.
6. Upload-linked ACTIVE assets not PUBLIC → 0.
7. Upload-linked APPROVED assets not PRIVATE → 0.
8. `image_publish_job_items` orphans (`job_id`, `image_asset_id`) → 0.
9. Upload-linked assets with `source <> 'FOTOCORP'` → 0.
10. `fotokey_daily_counters.last_sequence` ≥ max assigned sequence per
    day.
11/12. Informational distributions.

PR-15 validators were extended to allow the new `APPROVED + PRIVATE` pair
on upload-linked assets.

## Smoke

`apps/api/scripts/smoke/check-fotokey-publish-pipeline.ts`
(`pnpm --dir apps/api smoke:fotokey-publish`):

- DB-level (always):
  - assets with Fotokey,
  - duplicate Fotokeys,
  - queued / running publish jobs,
  - APPROVED+PRIVATE upload-linked count,
  - ACTIVE+PUBLIC upload-linked count,
  - ACTIVE+PUBLIC upload-linked count missing derivatives.
- HTTP (only if `INTERNAL_API_SECRET` is set):
  - list `status=SUBMITTED` (limit 1),
  - list `status=APPROVED` (limit 1).
- Optional mutation gated by `FOTOKEY_PUBLISH_SMOKE_APPROVE=1`:
  - approve one SUBMITTED upload,
  - assert publish job + Fotokey,
  - assert DB row is `APPROVED + PRIVATE` with FC-prefixed Fotokey.

The smoke never prints R2 keys or signed URLs.

## Files added/changed (PR-15.1)

Added:

- `apps/api/src/lib/r2-photographer-uploads.ts`
- `apps/api/src/lib/fotokey/allocator.ts`
- `apps/api/src/lib/fotokey/canonical-key.ts`
- `apps/api/src/lib/assets/asset-delete-guard.ts`
- `apps/api/src/db/schema/fotokey-daily-counters.ts`
- `apps/api/src/db/schema/image-publish-jobs.ts`
- `apps/api/src/db/schema/image-publish-job-items.ts`
- `apps/api/drizzle/0021_complex_ikaris.sql`
- `apps/api/drizzle/meta/0021_snapshot.json`
- `apps/api/scripts/media/process-image-publish-jobs.ts`
- `apps/api/scripts/db/validate-fotokey-publish-pipeline.ts`
- `apps/api/scripts/smoke/check-fotokey-publish-pipeline.ts`
- `./fotokey-publish-pipeline-report.md` (this file)

Changed:

- `apps/api/src/db/schema/image-assets.ts` (Fotokey columns + APPROVED status)
- `apps/api/src/db/schema/index.ts` (new schema exports)
- `apps/api/src/lib/r2-presigned-put.ts` (now signs against staging bucket;
  `createOriginalsPresignedPutUrl` is a deprecated alias)
- `apps/api/src/lib/r2-originals-verify.ts` (deprecated shim → staging helpers)
- `apps/api/src/lib/photographer-upload-storage-key.ts` (`staging/` prefix)
- `apps/api/src/routes/photographer/uploads/service.ts` (uses staging helpers)
- `apps/api/src/routes/internal/admin-photographer-uploads/route.ts`
  (passes `requestedByAdminUserId` to the service)
- `apps/api/src/routes/internal/admin-photographer-uploads/service.ts`
  (multi-phase approve, Fotokey + R2 copy + publish job queue, dual-bucket
  original viewer, `APPROVED` filter, Fotokey in DTO)
- `apps/api/src/routes/internal/admin-photographer-uploads/validators.ts`
  (`status=APPROVED` allowed)
- `apps/api/src/appTypes.ts` (staging bucket bindings/env)
- `apps/api/wrangler.jsonc` (staging bucket binding documented)
- `apps/api/.dev.vars.example` (staging bucket env)
- `apps/api/package.json` (`media:process-image-publish-jobs`,
  `db:validate:fotokey-publish`, `smoke:fotokey-publish`)
- `apps/api/scripts/db/validate-photographer-uploads.ts` (allows APPROVED)
- `apps/api/scripts/db/validate-admin-photographer-upload-review.ts`
  (allows APPROVED+PRIVATE)
- `apps/web/src/lib/api/admin-photographer-uploads-api.ts`
  (`fotokey`, `publishJobId`, `items`, APPROVED status filter)
- `apps/web/src/app/admin/photographer-uploads/page.tsx`
  (APPROVED status parsing)
- `apps/web/src/components/admin/photographer-uploads/admin-photographer-uploads-client.tsx`
  ("Approve & Queue Publish", APPROVED filter, Fotokey column,
  derivative-aware messaging)
- `context/architecture.md`
- `context/progress-tracker.md`
- `apps/api/docs/api-routing-audit.md`
- `./photographer-bulk-upload-backend-report.md`
- `./admin-photographer-upload-review-report.md`

## Risk notes

- No image goes live before `THUMB`, `CARD`, and `DETAIL` are `READY`.
- Fotokey is permanent once assigned. Hard delete is blocked.
- Sequence numbers are monotonic per business date; failed copies leave a
  gap in the canonical bucket but never reuse a Fotokey.
- R2 staging→originals copy is `CopyObject + HeadObject`, not a true
  move. Staging cleanup is a future operational task.
- The publish processor must run out of band (cron / operator), not in
  the request path.
- Replace/version flow is still deferred.
- Browser-facing surfaces never expose R2 keys, bucket names, signed
  URLs, or photographer staging paths.
