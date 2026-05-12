# Photographer Upload Runbook

End-to-end flow for photographer-created events and bulk uploads. API details: [bulk upload backend report](./reports/photographer-bulk-upload-backend-report.md), UI: [bulk upload UI report](./reports/photographer-bulk-upload-ui-report.md).

## Flow

1. **Create / edit event** — Portal uses `GET/POST/PATCH` photographer events APIs; rows live in `photo_events`.
2. **Bulk upload** — Photographer creates a batch, prepares items, uploads bytes via **presigned PUT** to the **staging** bucket (not canonical originals).
3. **Staging bucket** — Keys under `staging/<photographer_id>/<event_id>/<batch_id>/<upload_item_id>.<ext>`; never exposed to the browser as bare R2 URLs in API JSON.
4. **Submit batch** — Marks batch/items submitted; creates or finalizes `image_assets` as **`SUBMITTED` + `PRIVATE` + `FOTOCORP`** with **`fotokey` null**.
5. **No derivatives at upload stage** — Derivatives are queued **only after admin approval** (publish pipeline).
6. **Admin reviews originals** — Internal admin routes stream from staging before Fotokey; after approval, from canonical originals bucket.

Admin list/approve: [admin photographer upload review report](./reports/admin-photographer-upload-review-report.md).
