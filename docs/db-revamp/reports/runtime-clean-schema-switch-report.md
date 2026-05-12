# Runtime Clean Schema Switch Report

DB Revamp PR-05 switches current runtime routes and services from legacy-compatible image tables to the clean image schema created in PR-01 through PR-04.

## What Changed

Runtime reads now use clean tables for public catalog/search/detail, public media preview delivery, subscriber downloads, account download history, and Fotobox image joins:

- `image_assets` instead of `assets`
- `photo_events` instead of `asset_events`
- `photographers` instead of `photographer_profiles`
- `image_derivatives` instead of `asset_media_derivatives`
- `image_access_logs` instead of `asset_media_access_logs`
- `image_download_logs` instead of `asset_download_logs`

The public/API response shape and route URLs are unchanged. Existing IDs are preserved, so URLs and saved references continue to use the same UUIDs.

## Runtime Routes Switched

- Public catalog/search/detail routes now query `image_assets`, `photo_events`, `photographers`, and `image_derivatives`.
- Public media preview routes now resolve derivatives from `image_derivatives` and write access audit rows to `image_access_logs`.
- Internal subscriber download routes now resolve original image metadata from `image_assets` and write runtime download logs to `image_download_logs`.
- Internal account download history now reads `image_download_logs` and joins clean image/derivative metadata.
- Internal Fotobox item listing and saveability checks now join `image_assets`, `photo_events`, and `image_derivatives`.

## Legacy Paths Retained

Old tables remain because legacy import, compatibility, admin mutation, and rollback comparison still need them:

- Legacy fixture routes may still use old handlers and old table naming.
- Legacy import scripts continue to target old/import tables for now.
- Admin catalog mutation handlers remain transitional because switching publish/original/preview mutations cleanly requires a dedicated sync or write-path PR.

Old tables were not deleted or renamed.

## Variant Normalization

Clean derivative variants are uppercase:

- `THUMB`
- `CARD`
- `DETAIL`

Public route query parameters may still pass lowercase variants. The media service normalizes the accepted route variant at the service boundary before looking up `image_derivatives` or writing `image_access_logs`.

## Why Old UUIDs Matter

The clean tables preserve old UUIDs:

- `image_assets.id = assets.id`
- `photo_events.id = asset_events.id`
- `image_derivatives.id = asset_media_derivatives.id`
- `image_access_logs.id = asset_media_access_logs.id`
- `image_download_logs.id = asset_download_logs.id`

That keeps public URLs, Fotobox entries, derivative lookups, download history, and audit comparisons direct without a permanent mapping table.

## Validation

Run:

```bash
pnpm --dir apps/api smoke:clean-runtime-routes
pnpm --dir apps/api db:validate:image-logs
pnpm --dir apps/api db:validate:image-derivatives
pnpm --dir apps/api db:validate:image-assets
pnpm --dir apps/api db:validate:photographers
```

Expected clean runtime smoke output:

```txt
clean_image_assets = 9993
total = 9993
with_photographer = 9993
with_event = 9993
CARD = 9616
DETAIL = 9616
THUMB = 9616
```

Missing derivative coverage is informational until derivative generation has full coverage for all imported assets.

## Manual Smoke Checklist

Search/catalog:

- Search page loads.
- Image grid loads.
- Cards show watermarked previews.
- Photographer, event, date, and location still render.

Detail page:

- Known image detail page opens.
- Photographer name resolves where linked.
- Event/category/date/Fotokey still render.
- Detail preview loads.

Media route:

- Card/thumbnail/detail preview loads.
- `image_access_logs` increases after a new media request.
- `asset_media_access_logs` does not increase from the clean runtime request.

Subscriber download:

- Active subscriber large download still streams the original where entitlement allows.
- `image_download_logs` increases after a new download request.
- `asset_download_logs` does not increase from the clean runtime request.

If subscriber auth/session setup blocks download verification, document the blocked step explicitly.

## Risk Notes

- Clean runtime tables are now the primary runtime read/write targets for catalog, media preview, Fotobox joins, account download history, and subscriber download logs.
- Legacy import scripts may still write old tables, so new bulk imports need a clean-table sync/import refactor before production use.
- Admin catalog write paths remain transitional and should be switched in a dedicated follow-up that handles write synchronization.
- Old log tables are no longer intended runtime write targets after this PR.
- Photographer accounts remain deferred.
