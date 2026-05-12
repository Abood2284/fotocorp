# Photographer bulk upload — backend foundation (PR-13)

## Summary

Backend support for photographer bulk uploads: batch and per-file tracking, session-scoped APIs, private R2 originals under a dedicated key namespace, optional presigned PUT uploads, and `image_assets` rows created as **SUBMITTED** + **PRIVATE** with **source = FOTOCORP** (catalog/business ownership). **Photographer upload origin** is tracked via `photographer_upload_batches`, `photographer_upload_items`, and `image_assets.photographer_id` — not via `image_assets.source`. The value **`PHOTOGRAPHER_UPLOAD` must not be written** to `image_assets.source` going forward; it may remain in the DB check constraint as **deprecated** until a later cleanup migration. Portal drag-drop UI and admin approval/live selection are **out of scope** for this PR.

## Migrations (PR-14.1)

- **`0020_absurd_dracula`**: widens `image_assets_source_check` to allow **`FOTOCORP`**, backfills existing **`PHOTOGRAPHER_UPLOAD`** rows to **`FOTOCORP`**, and re-adds the constraint. Between PR-13 and PR-14.1, only photographer finalize wrote `PHOTOGRAPHER_UPLOAD` on `image_assets`, so the backfill is safe for that window.

## Data model

### `photographer_upload_batches`

- Scoped to `photographer_id`, `photographer_account_id`, and `event_id` (FKs to `photographers`, `photographer_accounts`, `photo_events`).
- **Status**: `OPEN` | `SUBMITTED` | `COMPLETED` | `FAILED` | `CANCELLED` (this PR uses `OPEN` → `SUBMITTED` on photographer submit).
- Optional shared metadata: `common_title`, `common_caption`, `common_keywords`.
- Counters: `total_files`, `uploaded_files`, `failed_files` (refreshed on submit from item rows).
- `submitted_at` set when the photographer calls submit (means “finished uploading this batch”, not admin approval).

### `photographer_upload_items`

- One row per prepared file; `storage_key` is **unique** (namespace separate from legacy import keys).
- **upload_status**: `PENDING` → (`UPLOADED` intermediate optional) → `ASSET_CREATED` | `FAILED`.
- Links to `image_assets` via `image_asset_id` after a successful complete.

### `image_assets` (photographer uploads)

- **status**: `SUBMITTED`
- **visibility**: `PRIVATE`
- **source**: `FOTOCORP`
- **legacy_image_code**: `PHUPLOAD-<compact-id>` derived from the upload item id (Fotokey-style code for portal/admin; not a storage key).
- Admin setting an image **ACTIVE** + **PUBLIC** is a **future** admin workflow; this PR does not expose publish controls to photographers.

## Storage key convention

PR-15.1 moved photographer pre-approval objects to a dedicated **staging R2 bucket**. The canonical originals bucket holds Fotokey-named originals only.

```
fotocorp-2026-contributor-uploads (staging bucket; binding MEDIA_CONTRIBUTOR_UPLOADS_BUCKET)
└─ staging/<photographer_id>/<event_id>/<batch_id>/<item_id>.<ext>
```

- Extensions allowed: `jpg`, `jpeg`, `png`, `webp`.
- Staging keys are opaque. The original filename is metadata only (`original_file_name` / `original_file_extension`); it is never embedded in the canonical key.
- Pre-approval uploads must never be written to `fotocorp-2026-megafinal`. Admin approval (PR-15.1) copies the original from the staging bucket into the canonical originals bucket as `FCddmmyyNNN.<jpg|png|webp>` (`jpeg → jpg`).

## API routes (all require `fc_ph_session`)

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/photographer/upload-batches` | Create batch for an **ACTIVE** `photo_events` row |
| `GET` | `/api/v1/photographer/upload-batches` | List batches (filters: `status`, `eventId`, `limit`, `offset`) |
| `GET` | `/api/v1/photographer/upload-batches/:batchId` | Batch detail, event summary, items + linked asset status |
| `POST` | `/api/v1/photographer/upload-batches/:batchId/files` | Register files, return upload instructions |
| `POST` | `/api/v1/photographer/upload-batches/:batchId/files/:itemId/complete` | Verify object in R2, create/link `image_assets` |
| `POST` | `/api/v1/photographer/upload-batches/:batchId/submit` | Mark batch `SUBMITTED`, refresh counts (requires ≥1 `ASSET_CREATED` item) |

Ownership: batches and items are always constrained to the current session’s photographer; photographers cannot set or change `photographer_id` on assets via these routes.

## Upload method

- **Presigned PUT (staging bucket)**: When `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, and `CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET` are set on the Worker, `POST .../files` returns `uploadMethod: "SIGNED_PUT"` and a time-limited `uploadUrl` plus `headers["content-type"]`. The presigned URL targets the **staging bucket** (`fotocorp-2026-contributor-uploads`). R2 **access keys are never** returned to clients.
- **Fallback**: If those variables are missing, `uploadMethod: "NOT_CONFIGURED"` and `uploadUrl: null` — DB rows are still created for later manual/server-side ingestion.
- **Storage keys** are omitted from API responses when possible.

## R2 verification

- **Worker / deployed API:** `complete` uses **`MEDIA_CONTRIBUTOR_UPLOADS_BUCKET.head(storageKey)`** when the staging R2 binding is present.
- **Local / Node smoke (`honoApp.fetch` without R2 bindings):** if the staging binding is absent but **`CLOUDFLARE_R2_*`** S3 API credentials and **`CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET`** are set, the same code path verifies the object with **S3 `HeadObject`** against the staging bucket. This must be the **same** bucket as `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET` in production.
- If neither binding nor S3 config is available, `complete` returns `503 UPLOAD_STORAGE_NOT_CONFIGURED`.

## Environment variables (operator checklist)

| Variable | Role |
| --- | --- |
| `DATABASE_URL` | Postgres (batches, items, `image_assets`). |
| `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET` | Worker R2 binding for the **staging** bucket (`wrangler.jsonc`); used for `head` in production. |
| `MEDIA_ORIGINALS_BUCKET` | Worker R2 binding for the **canonical originals** bucket; used by admin approval to copy approved originals as Fotokey-named files. |
| `CLOUDFLARE_R2_ACCOUNT_ID` | R2 S3 API endpoint account segment. |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API token (server-only); used for presigned PUT, S3 `HeadObject` fallback, and admin staging→originals copy. |
| `CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET` | Bucket **name** matching the staging binding’s `bucket_name` (`fotocorp-2026-contributor-uploads`). |
| `CLOUDFLARE_R2_ORIGINALS_BUCKET` | Bucket **name** matching the canonical originals binding’s `bucket_name` (`fotocorp-2026-megafinal`). |
| `PHOTOGRAPHER_SMOKE_USERNAME` / `PHOTOGRAPHER_SMOKE_PASSWORD` | Optional; enables HTTP upload smoke (`pnpm --dir apps/api smoke:photographer-uploads`). |
| `PHOTOGRAPHER_UPLOAD_SMOKE_REAL_R2` | Set to `1` with smoke credentials + full `CLOUDFLARE_R2_*` to run PUT → complete → submit + DB assertions. |

Do not put secrets in git; use `.dev.vars` or Wrangler secrets.

## R2 CORS (required before browser direct PUT)

Presigned URLs point at `https://<accountid>.r2.cloudflarestorage.com/...`. Browsers will **preflight** cross-origin `PUT` with `Content-Type`. The **R2 staging bucket** must allow your web origins.

**This repository does not apply CORS via IaC**; configure in the Cloudflare dashboard (or API) for the **staging** bucket (`fotocorp-2026-contributor-uploads`) used by `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET`. The canonical originals bucket only receives server-side S3 copies during admin approval and does not need browser CORS rules.

Recommended policy (adjust origins to your environments):

- **Allowed origins:** e.g. `http://localhost:3000` (local Next.js), and your production site origin(s) such as `https://www.example.com`.
- **Allowed methods:** `PUT`, `HEAD` (and `GET` only if you later need it for the same bucket).
- **Allowed headers:** `Content-Type` (add others only if clients send them).
- **Expose headers:** usually empty for uploads.
- **Max age:** e.g. `3600` seconds.

**Dashboard steps (summary):** Cloudflare dashboard → R2 → select the **staging** bucket (same name as `CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET` / staging Worker binding) → Settings → **CORS policy** → add rules matching the above → save. After changes, wait briefly and re-test browser uploads.

Without CORS, the drag-drop UI (PR-14) will fail in the browser even when presigned PUT works from `curl` or Node `fetch`.

## Smoke testing (PR-13.1)

- **Prepare-only (default):** with `PHOTOGRAPHER_SMOKE_USERNAME` + `PHOTOGRAPHER_SMOKE_PASSWORD` and `DATABASE_URL`, the script logs in, creates a batch, prepares one file, asserts `uploadMethod` / URL shape, logs out. No R2 PUT.
- **Full pipeline:** set `PHOTOGRAPHER_UPLOAD_SMOKE_REAL_R2=1` and all `CLOUDFLARE_R2_*` vars in the environment loading `.dev.vars`. The script PUTs a minimal JPEG to the presigned URL, calls `complete`, asserts `image_assets` **SUBMITTED** + **PRIVATE** + **FOTOCORP**, submits the batch, prints a recent-rows table, and asserts the smoke item row.

**Manual smoke in this PR:** run the commands locally with one row from `photographer-credentials-*.csv` (password must not be committed or pasted into docs). If R2 env is incomplete, expect `NOT_CONFIGURED` or skipped real-R2 path; report that honestly.

## Derivative generation

Derivatives are generated **only after admin approval**, by `apps/api/scripts/media/process-image-publish-jobs.ts` (PR-15.1). Photographer upload + submit do **not** enqueue or generate `image_derivatives`. Approved assets remain `APPROVED + PRIVATE` until the publish processor writes `THUMB`, `CARD`, and `DETAIL` watermarked WebPs into `previews/watermarked/<variant>/<fotokey>.webp` and upserts `image_derivatives` rows as `READY`. See `./fotokey-publish-pipeline-report.md`.

## Validation and smoke

- DB validation: `pnpm --dir apps/api db:validate:photographer-uploads`
- HTTP smoke: `pnpm --dir apps/api smoke:photographer-uploads`
  - With credentials only: prepare path + instruction assertions.
  - Add `PHOTOGRAPHER_UPLOAD_SMOKE_REAL_R2=1` + full `CLOUDFLARE_R2_*`: real PUT, complete, submit, DB row assertions.

## Related docs

- `context/architecture.md` — route inventory and storage boundaries
- `apps/api/docs/api-routing-audit.md` — exact route table
- `context/progress-tracker.md` — PR-13 completion note

## Product mapping (portal)

- **Submitted**: `image_assets.status = SUBMITTED` or `visibility = PRIVATE` (analytics updated to treat `SUBMITTED` explicitly).
- **Approved / Live**: `status = ACTIVE` and `visibility = PUBLIC` (admin-only, future).
