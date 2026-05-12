# PR-15 / PR-15.1 — Admin Submitted Photographer Upload Review Queue + Publish Pipeline

> **Update (PR-15.1):** Approval no longer transitions assets directly to
> `ACTIVE + PUBLIC`. It allocates a Fotokey, copies the original from the
> staging bucket to the canonical originals bucket as `FCddmmyyNNN.<ext>`,
> sets the asset to `APPROVED + PRIVATE`, and queues a publish job. Assets
> only become `ACTIVE + PUBLIC` after the publish processor finishes
> generating required derivatives. See
> `./fotokey-publish-pipeline-report.md` for full lifecycle.

## Goal

Build the admin review foundation for photographer-submitted uploads
introduced in PR-13/PR-14/PR-14.1, and (PR-15.1) wire it into the canonical
Fotokey publish pipeline. Admins must be able to:

- list submitted photographer uploads (with new `APPROVED` filter),
- view originals through a protected admin tunnel,
- approve selected images: assign Fotokey, promote to canonical originals
  bucket, and queue derivative generation,

without exposing R2 credentials, R2 storage keys, signed URLs, or internal
API secrets to the browser.

This PR does **not**:

- delete, reject, or archive uploads,
- introduce a new advanced metadata editor,
- change the photographer upload flow,
- add a `photographer_event_submissions` table,
- write `PHOTOGRAPHER_UPLOAD` to `image_assets.source` (it is `FOTOCORP`).

## Asset Model Used

| Concept | Source of truth |
|---|---|
| Catalog ownership | `image_assets.source = 'FOTOCORP'` |
| Submission state | `image_assets.status = 'SUBMITTED'`, `visibility = 'PRIVATE'`, `fotokey is null` |
| Approved (post PR-15.1) | `image_assets.status = 'APPROVED'`, `visibility = 'PRIVATE'`, `fotokey = 'FCddmmyyNNN'` |
| Live (post derivatives) | `image_assets.status = 'ACTIVE'`, `visibility = 'PUBLIC'`, all of `THUMB`/`CARD`/`DETAIL` `READY` |
| Upload origin / provenance | `photographer_upload_batches`, `photographer_upload_items` |

The admin queue selects upload-linked rows by joining
`photographer_upload_items` to `image_assets`, **not** by reading
`image_assets.source`.

## API

### List submitted photographer uploads

`GET /api/v1/internal/admin/photographer-uploads`

Query parameters (validated with zod):

| Name | Type | Default |
|---|---|---|
| `status` | `SUBMITTED` \| `ACTIVE` \| `all` | `SUBMITTED` |
| `eventId` | UUID | — |
| `photographerId` | UUID | — |
| `batchId` | UUID | — |
| `q` | search string | — |
| `from` | `yyyy-mm-dd` | — |
| `to` | `yyyy-mm-dd` (exclusive day window: `< to + 1 day`) | — |
| `limit` | int 1-100 | 24 |
| `offset` | int ≥ 0 | 0 |

Response:

```json
{
  "ok": true,
  "uploads": [
    {
      "imageAssetId": "...",
      "uploadItemId": "...",
      "batchId": "...",
      "originalFileName": "IMG_001.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 1234567,

      "status": "SUBMITTED",
      "visibility": "PRIVATE",
      "source": "FOTOCORP",

      "photographer": {
        "id": "...",
        "legacyPhotographerId": 123,
        "displayName": "..."
      },
      "event": {
        "id": "...",
        "name": "...",
        "eventDate": "...",
        "city": "...",
        "location": "..."
      },
      "batch": { "id": "...", "status": "SUBMITTED", "submittedAt": "..." },
      "createdAt": "...",
      "updatedAt": "...",
      "canApprove": true
    }
  ],
  "pagination": { "limit": 24, "offset": 0, "total": 0 }
}
```

The response never includes `original_storage_key`, R2 URLs, signed URLs,
or bucket names.

### Protected original viewer

`GET /api/v1/internal/admin/photographer-uploads/:imageAssetId/original`

- Requires the internal API secret middleware
  (`apps/api/src/middleware/internalAuth.ts`).
- Verifies the image is linked through `photographer_upload_items` (a join
  is required for the row to be returned at all).
- Reads the original from the appropriate private R2 bucket: the
  photographer staging bucket (`MEDIA_CONTRIBUTOR_UPLOADS_BUCKET`) before
  approval, or the canonical originals bucket (`MEDIA_ORIGINALS_BUCKET`)
  once a Fotokey is assigned.
- Streams the bytes back with safe headers:

```
Content-Type: <pui.mime_type or application/octet-stream>
Cache-Control: private, no-store
Content-Disposition: inline; filename="<safe original filename>"
X-Content-Type-Options: nosniff
X-Robots-Tag: noindex, nofollow, noarchive
```

If the asset is not linked to an upload item, the route returns
`404 PHOTOGRAPHER_UPLOAD_NOT_FOUND`. If the original storage key is missing
or R2 returns no body, it returns `404 ORIGINAL_NOT_AVAILABLE`. R2 read
failures map to `502 R2_ERROR`. The route never returns the storage key,
the R2 URL, or any signed URL.

### Approve & Queue Publish (PR-15.1)

`POST /api/v1/internal/admin/photographer-uploads/approve`

Body:

```json
{ "imageAssetIds": ["uuid-1", "uuid-2"] }
```

Rules:

- max 100 ids per request, **input order is the publish order** (admin
  intent decides Fotokey sequence),
- only assets linked through `photographer_upload_items` and currently
  `source = FOTOCORP`, `status = SUBMITTED`, `visibility = PRIVATE`,
  `fotokey is null` are approved,
- the staging R2 object must already exist (verified before Fotokey
  allocation),
- approved rows transition to:

  ```
  fotokey               = FCddmmyyNNN  (FC + DD + MM + YY + sequence ≥ 3 digits)
  fotokey_date          = approval business date (Asia/Kolkata)
  fotokey_sequence      = reserved sequence
  fotokey_assigned_at   = now()
  original_storage_key  = FCddmmyyNNN.<ext>     (canonical bucket)
  original_filename     = FCddmmyyNNN.<ext>
  status                = APPROVED
  visibility            = PRIVATE
  updated_at            = now()
  ```

- the original is **copied** (not moved) from the staging bucket to the
  canonical originals bucket via `apps/api/src/lib/r2-photographer-uploads.ts#copyStagingObjectToOriginals`,
- one `image_publish_jobs` row + one `image_publish_job_items` row per
  approved asset is inserted (`status = QUEUED`),
- unselected uploads stay `SUBMITTED + PRIVATE + fotokey null`,
- **no derivatives are generated here**; the asset stays `PRIVATE` until
  the publish processor runs.

Response:

```json
{
  "ok": true,
  "approvedCount": 3,
  "publishJobId": "...",
  "items": [
    {
      "imageAssetId": "...",
      "fotokey": "FC010126001",
      "status": "APPROVED"
    }
  ],
  "skipped": [
    { "imageAssetId": "...", "reason": "ALREADY_HAS_FOTOKEY" }
  ]
}
```

Skip reasons:

- `NOT_FOUND` — id does not exist in `image_assets`.
- `NOT_LINKED_TO_UPLOAD` — id is not joined through
  `photographer_upload_items`.
- `NOT_FOTOCORP_SOURCE` — `image_assets.source <> 'FOTOCORP'`.
- `NOT_SUBMITTED` — `status` was not `SUBMITTED`.
- `NOT_PRIVATE` — `visibility` was not `PRIVATE`.
- `ALREADY_HAS_FOTOKEY` — Fotokey already assigned (idempotency guard).
- `STAGING_OBJECT_MISSING` — staging object missing or R2 head failed.
- `UNSUPPORTED_EXTENSION` — original extension not in `jpg|jpeg|png|webp`.
- `STAGING_COPY_FAILED` — staging→originals copy failed for that item.
- `RACE_CONDITION` — row state changed between phases (rare).

## Web

### Same-origin original proxy

`GET /admin/photographer-uploads/[imageAssetId]/original`
(`apps/web/src/app/admin/photographer-uploads/[imageAssetId]/original/route.ts`)

- Requires Better Auth session.
- Requires `appUser.role` ∈ `{ ADMIN, SUPER_ADMIN }`.
- Server-side fetches the protected original through the internal API
  client (`apps/web/src/lib/server/internal-api`), forwarding only safe
  headers.
- Streams the body back to the browser with `Cache-Control: private,
  no-store`, `X-Content-Type-Options: nosniff`, and
  `X-Robots-Tag: noindex, nofollow, noarchive`.
- Never exposes `INTERNAL_API_BASE_URL`, `INTERNAL_API_SECRET`, R2 keys,
  signed URLs, or upstream error bodies.

### Same-origin approve proxy

`POST /api/admin/photographer-uploads/approve`
(`apps/web/src/app/api/admin/photographer-uploads/approve/route.ts`)

- Validates session + admin role.
- Validates the request body shape (`imageAssetIds` array of UUID-like
  strings, length 1-100) before forwarding.
- Returns user-safe error envelopes (no upstream stack traces).

### Admin UI

`/admin/photographer-uploads`
(`apps/web/src/app/admin/photographer-uploads/page.tsx`).

- Server-rendered page that calls the internal list API server-side and
  the existing admin filter API for events/photographers.
- Client component
  (`apps/web/src/components/admin/photographer-uploads/admin-photographer-uploads-client.tsx`)
  shows a table with: select checkbox, original filename + mime/size,
  photographer, event, submitted date, status, visibility, and a
  "Review" action.
- Filters: status, event, photographer, batch ID, search, date range
  (URL-driven; `Apply`/`Reset`).
- Bulk approve selected button (only enables when the selected items have
  `canApprove === true`).
- The "Review" action opens a modal that loads the protected original
  through the same-origin admin route. Only one original loads at a time
  to avoid pulling many full-size originals into the browser.
- Approval refreshes the route. Approved rows leave the default
  submitted queue but appear under `status=ACTIVE` or `status=all`.

## Approval Provenance

`image_assets` does not currently carry `approved_at`,
`approved_by_user_id`, or `published_at` columns. Adding them and a clean
admin user FK is out of scope for this PR. The existing
`asset_admin_audit_logs` table FKs to the legacy `assets` table, so it is
not safe to insert per-photographer-upload audit rows there without
introducing dangling FKs for newly uploaded image assets that do not
exist in `assets`.

**Approval audit/provenance is deferred** to a focused follow-up PR that
introduces a clean admin/audit FK pattern.

## Validation

`pnpm --dir apps/api db:validate:admin-photographer-upload-review`
(script: `apps/api/scripts/db/validate-admin-photographer-upload-review.ts`).

Checks:

1. Upload-linked assets all have `source = 'FOTOCORP'` (count 0).
2. Upload-linked assets only have `status` in `('SUBMITTED', 'ACTIVE')`
   (group rows must be empty).
3. Upload-linked assets use only the `(SUBMITTED, PRIVATE)` and
   `(ACTIVE, PUBLIC)` status/visibility pairs (group rows must be empty).
4. `photographer_upload_items.image_asset_id` orphans (count 0).
5. Distribution of upload-linked assets by status/visibility
   (informational).
6. Submitted/private queue count (informational).
7. Active/public approved count (informational).

## Smoke

`pnpm --dir apps/api smoke:admin-photographer-upload-review`
(script: `apps/api/scripts/smoke/check-admin-photographer-upload-review.ts`).

- DB-only smoke runs whenever `DATABASE_URL` is set:
  - submitted/private upload-linked count
  - active/public upload-linked count
  - upload-linked rows with wrong source
  - upload-linked rows with invalid status/visibility pair
  - sample of recent submitted/private upload-linked rows
- HTTP smoke against the in-process Hono app runs only when
  `INTERNAL_API_SECRET` is set:
  - GET `/api/v1/internal/admin/photographer-uploads` (default
    `SUBMITTED`)
  - GET without the internal secret (must return `401`)
  - GET original route status for the first listed upload (200/404/500
    accepted in smoke environments without R2 binding)
- HTTP smoke does **not** mutate approval state by default. To approve a
  single submitted upload, set
  `ADMIN_PHOTOGRAPHER_UPLOAD_REVIEW_SMOKE_APPROVE=1`.
- HTTP smoke is skipped honestly if `INTERNAL_API_SECRET` is missing.

## Manual Smoke Checklist

Use admin/super-admin web auth (Better Auth), not photographer portal
auth.

1. Ensure at least one photographer upload exists with
   `image_assets.source = FOTOCORP`, `status = SUBMITTED`,
   `visibility = PRIVATE`, linked via `photographer_upload_items`.
2. Open `/admin/photographer-uploads`.
3. Confirm the submitted upload appears in the default queue.
4. Click "Review" on the row to open the modal.
5. Confirm the original image loads through
   `/admin/photographer-uploads/{imageAssetId}/original`.
6. Confirm no R2 key, R2 URL, signed URL, or bucket name appears in the
   page source, network panel response bodies, or any visible UI.
7. Select one image with the table checkbox.
8. Click "Approve selected".
9. Confirm the success message and that the image becomes
   `status = ACTIVE`, `visibility = PUBLIC` in DB.
10. Confirm the image disappears from the default `SUBMITTED` queue and
    reappears under `status=ACTIVE` or `status=all`.
11. Confirm unselected uploads remain `SUBMITTED + PRIVATE`.
12. From a photographer-only or anonymous browser session, confirm
    `/admin/photographer-uploads` and
    `/admin/photographer-uploads/.../original` deny access (401/403),
    not 200.

## Files Added

- `apps/api/src/routes/internal/admin-photographer-uploads/route.ts`
- `apps/api/src/routes/internal/admin-photographer-uploads/service.ts`
- `apps/api/src/routes/internal/admin-photographer-uploads/validators.ts`
- `apps/api/scripts/db/validate-admin-photographer-upload-review.ts`
- `apps/api/scripts/smoke/check-admin-photographer-upload-review.ts`
- `apps/web/src/app/admin/photographer-uploads/page.tsx`
- `apps/web/src/app/admin/photographer-uploads/[imageAssetId]/original/route.ts`
- `apps/web/src/app/api/admin/photographer-uploads/approve/route.ts`
- `apps/web/src/components/admin/photographer-uploads/admin-photographer-uploads-client.tsx`
- `apps/web/src/lib/api/admin-photographer-uploads-api.ts`
- `./admin-photographer-upload-review-report.md` (this file)

## Files Modified

- `apps/api/src/honoApp.ts` — mounts the new admin route group.
- `apps/api/package.json` — adds `db:validate:admin-photographer-upload-review`
  and `smoke:admin-photographer-upload-review` scripts.
- `apps/web/src/lib/server/internal-api/routes.ts` — adds the new admin
  internal routes to the centralized route builder.
- `apps/web/src/components/admin/admin-shell.tsx` — adds the
  "Photographer uploads" sidebar link.
- `context/architecture.md`, `context/progress-tracker.md`,
  `apps/api/docs/api-routing-audit.md` — admin review queue routes,
  invariants, and progress notes.

## Risk Notes

- Derivative generation (`THUMB`, `CARD`, `DETAIL`) is deferred to
  PR-16. Approved (`ACTIVE` + `PUBLIC`) images may not yet have ready
  watermarked derivatives, so public catalog routes that already require
  ready derivatives will gate them naturally; PR-16 must close that gap.
- No reject/delete/archive flow yet — operators that need to remove a
  bad upload must use a separate admin/data path until that PR ships.
- No advanced metadata editor in this PR.
- Approval audit/provenance is deferred until a clean
  admin-user/audit FK pattern exists.
- Protected original viewing may load large files; the UI loads one
  original at a time via the modal viewer to avoid full-page pre-loads.
