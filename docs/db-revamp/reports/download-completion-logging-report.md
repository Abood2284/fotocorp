# Subscriber download completion logging (PR-11.1)

## Problem

Photographer analytics (`GET /api/v1/photographer/analytics/summary`) counts only `image_download_logs.download_status = 'COMPLETED'`. The subscriber attachment route previously inserted **`STARTED`** and never transitioned successful downloads to **`COMPLETED`**, so download metrics and top-downloaded lists stayed empty.

## Runtime behavior (APPLICATION source)

1. **`POST /api/v1/internal/assets/:assetId/download`** (after auth, quota increment, and R2 body resolution):
   - Inserts a row with `download_status = 'STARTED'`, `source = 'APPLICATION'`, quota before/after, `bytes_served` / `content_type` when known, `user_agent`, `ip_hash`, and profile ids.
   - Immediately updates that row to **`COMPLETED`** when the Worker is about to return the authorized attachment response (status 200, stream body).

2. **Meaning of `COMPLETED`**

   **`COMPLETED` means the server successfully authorized the download and returned (or is returning) the downloadable response.** It does **not** mean the browser finished writing the file to disk or that the user completed the transfer.

3. **Failures**

   Failed paths continue to insert **`FAILED`** with a safe `failure_code`. No writes go to legacy `asset_download_logs`.

## Account download history

Subscriber download history lists rows where `download_status in ('STARTED', 'COMPLETED')` so:

- Successful downloads after this change appear as **`COMPLETED`**.
- Any legacy or stuck **`STARTED`** rows still appear until cleaned up separately.

## Photographer-facing analytics

- Dashboard and API expose **aggregate counts and image-level download totals only**.
- **No** subscriber identity, email, or auth user id is exposed to photographers.

## Validation

- `pnpm --dir apps/api db:validate:photographer-analytics` includes a hard check that **`COMPLETED`** rows always resolve to an `image_assets` row (no orphan completed logs).

## Manual verification query

After a real subscriber download in a target environment:

```sql
select
  l.id,
  l.image_asset_id,
  ia.legacy_image_code,
  ia.photographer_id,
  l.download_size,
  l.download_status,
  l.bytes_served,
  l.content_type,
  l.created_at
from image_download_logs l
join image_assets ia on ia.id = l.image_asset_id
order by l.created_at desc
limit 10;
```

Expect the latest successful run to show **`download_status = 'COMPLETED'`** for that request.

## Deferred

- Client-side transfer completion / partial download tracking.
- Photographer upload, event CRUD, and admin approval flows.
