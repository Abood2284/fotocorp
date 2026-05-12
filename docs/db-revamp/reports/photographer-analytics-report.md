# Photographer analytics (PR-11)

## Endpoint

- `GET /api/v1/photographer/analytics/summary`
- Requires an active photographer session (`fc_ph_session`).
- All metrics and lists are scoped with `image_assets.photographer_id = current session photographer id`.

## Response (conceptual)

- `summary`: numeric aggregates for uploads, submission-style counts, live counts, and download totals.
- `topDownloadedImages`: up to five rows for images that have at least one `image_download_logs` row with `download_status = 'COMPLETED'`, ordered by completed download count descending.
- `recentUploads`: up to five most recent images by `image_assets.created_at` for the current photographer.

Field casing matches existing photographer JSON APIs (`camelCase`). No R2 keys, no original URLs, no subscriber or downloader identity.

## Metric definitions

| Field | Definition |
| --- | --- |
| `totalUploads` | `count(*)` from `image_assets` for the current photographer. |
| `uploadsThisMonth` | Same filter, where `created_at >= date_trunc('month', current_timestamp)` (database session timezone). |
| `submittedImages` | Images that are not treated as live: `visibility = 'PRIVATE'` **or** `status in ('DRAFT', 'UNKNOWN')`. |
| `approvedImages` | `status = 'ACTIVE'` and `visibility = 'PUBLIC'`. |
| `downloadsToday` | Count of `image_download_logs` rows with `download_status = 'COMPLETED'` and `created_at >= date_trunc('day', current_timestamp)`, joined to the photographer’s images. |
| `downloadsThisMonth` | Same as above with `date_trunc('month', ...)`. |
| `downloadsAllTime` | All `COMPLETED` download logs for the photographer’s images. |

## Download analytics caveat

Counts include only **`COMPLETED`** rows in `image_download_logs`. The subscriber attachment route (PR-11.1) transitions successful downloads from `STARTED` to **`COMPLETED`** when the authorized attachment response is ready; see `./download-completion-logging-report.md`. **`COMPLETED` is server-side response readiness, not proof the browser saved the file.**

## Dashboard UI

- Stat cards: total uploads, uploads this month, submitted, approved/live, downloads today / month / all time.
- Sections: top downloaded images (empty copy: “No downloads yet.”), recent uploads (“No recent uploads yet.”).
- No charts or date-range filters in this PR.

## Validation and smoke

- `pnpm --dir apps/api db:validate:photographer-analytics` — FK health for images and download logs plus informational breakdowns.
- `pnpm --dir apps/api smoke:photographer-analytics` — DB snippet always; HTTP smoke runs only when `PHOTOGRAPHER_SMOKE_USERNAME` and `PHOTOGRAPHER_SMOKE_PASSWORD` are set (otherwise prints skip, exits 0).

## Deferred

- Photographer bulk upload and event CRUD.
- Admin approval queue.
- Optional `range=today|month|all` query support and charting.
