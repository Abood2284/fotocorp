# Photographer bulk upload — portal UI (PR-14)

## Summary

Photographers can create upload batches, pick an **active** event, optionally set shared metadata, add JPG/PNG/WebP files (drag-drop or file picker), upload bytes **directly to R2** using presigned PUT URLs from the API, finalize each file via the `complete` endpoint, then **submit** the batch for Fotocorp review. No admin approval UI, no derivative generation, and no public publishing from this flow.

## Web routes

| Route | Purpose |
| --- | --- |
| `/photographer/uploads` | List batches with status filters (All / Open / Submitted / Completed / Failed) |
| `/photographer/uploads/new` | New batch: event, metadata, files, upload + submit |
| `/photographer/uploads/[batchId]` | Batch + event summary and per-file status (no storage keys or signed URLs) |

Navigation: **Uploads** added to the photographer shell next to Dashboard, Images, Events.

## API client (`apps/web/src/lib/api/photographer-api.ts`)

All calls use same-origin `/api/photographer/...` (BFF → API `/api/v1/photographer/...`).

- `getPhotographerUploadBatches` — list with optional `status`, `eventId`, pagination
- `getPhotographerUploadBatch` — detail + items
- `createPhotographerUploadBatch`
- `preparePhotographerUploadFiles`
- `completePhotographerUploadFile`
- `submitPhotographerUploadBatch`
- `putPhotographerFileToSignedUrl` — **browser-only** `fetch(PUT)` to R2; URL is not stored and is not shown in UI
- `getPhotographerEvents` — reused for `scope=available` event list

## Upload flow (new page)

1. **Event:** dropdown from `GET .../events?scope=available`; link to create event if none.
2. **Metadata:** optional common title, caption, keywords (applied to all assets in batch; admin can refine later).
3. **Files:** drop zone + file input; client validates extension and **50 MB** max per file; up to **100 files per `prepare` request** (automatic chunking).
4. **Start upload:** creates batch on first run (POST `/upload-batches`), then for new files calls prepare (POST `.../files`), then for each instruction with `SIGNED_PUT` runs PUT then complete. **`NOT_CONFIGURED` stops the flow** with an admin-contact message.
5. **Submit batch:** separate button — POST `.../submit` when at least one file is finalized (`ASSET_CREATED`), then redirect to batch detail.

Signed URLs exist only in memory for the duration of the PUT. They are not logged in UI, not stored in `localStorage` / `sessionStorage`, and not passed to React state beyond the closure executing `fetch`.

## Dashboard

Card **Upload images** with copy: *Upload all images from a shoot. Fotocorp will review and publish selected images.* Links to new batch and batch list.

## R2 CORS

Browser PUT requires the R2 originals bucket CORS policy documented in `photographer-bulk-upload-backend-report.md`. If CORS blocks the request, the UI shows a failed upload status (HTTP status on PUT); do not treat as success.

## Product / data guarantees

- New assets remain **SUBMITTED** + **PRIVATE** with **`image_assets.source = FOTOCORP`** until a future admin workflow. Upload provenance stays in `photographer_upload_*` tables, not in `source`.
- No photographer-facing publish or public original URLs.
- Admin approval queue and derivative pipelines are **out of scope**.

## Manual web smoke checklist

Use one generated photographer credential (never commit or paste passwords).

1. Configure R2 CORS for your local origin (e.g. `http://localhost:3000`): methods **PUT**, **HEAD**; header **Content-Type**.
2. Login at `/photographer/login`.
3. Open `/photographer/uploads` — list loads (may be empty).
4. Open `/photographer/uploads/new`.
5. Select an available event (or create one under Events first).
6. Optionally fill common metadata.
7. Add one small JPEG (drag or picker).
8. **Start upload** — rows move through preparing → uploading → finalizing → finalized.
9. **Submit batch** — redirect to `/photographer/uploads/[batchId]`.
10. Detail shows batch **SUBMITTED** and file **ASSET_CREATED** with asset id snippet.
11. In DB, confirm `image_assets` row is **SUBMITTED**, **PRIVATE**, **FOTOCORP** (`source` is ownership, not “upload method”).
12. Confirm image does not appear on public catalog as live.
13. Logout.

If presign returns `NOT_CONFIGURED`, expect the blocking message and no PUT.

## Related docs

- `./photographer-bulk-upload-backend-report.md` — API, storage, CORS, smoke
- `context/architecture.md` — portal + upload summary
