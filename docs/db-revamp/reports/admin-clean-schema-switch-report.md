# Admin Clean Schema Switch Report

DB Revamp PR-06 switches the internal admin catalog runtime service from legacy image tables to the clean schema.

## What Changed

Admin catalog reads now use:

- `image_assets`
- `photo_events`
- `photographers`
- `image_derivatives`

Admin catalog writes now update:

- `image_assets`

Old admin catalog runtime sources removed from `apps/api/src/lib/assets/admin-catalog.ts`:

- `assets`
- `asset_events`
- `photographer_profiles`
- `asset_media_derivatives`

Old tables remain in the database for legacy/import compatibility and audit comparison. They were not deleted or renamed.

## Admin Routes And Services Switched

The route URLs still contain `/assets` for API compatibility:

- `GET /api/v1/internal/admin/assets`
- `GET /api/v1/internal/admin/assets/:assetId`
- `PATCH /api/v1/internal/admin/assets/:assetId`
- `POST /api/v1/internal/admin/assets/:assetId/publish-state`
- `GET /api/v1/internal/admin/assets/:assetId/original`
- `GET /api/v1/internal/admin/assets/:assetId/preview`
- `GET /api/v1/internal/admin/catalog/stats`
- `GET /api/v1/internal/admin/filters`

Internally, these routes now operate on clean image tables. Route naming is product/API compatibility; table naming is implementation.

## Mutations Switched

Editorial metadata update:

- Old write: `assets`
- New write: `image_assets`
- Updated fields: caption, headline, description, keywords, category, event, photographer, `updated_at`

Publish-state update:

- Old write: `assets`
- New write: `image_assets`
- Updated fields: status, visibility, `updated_at`

Publish payload compatibility is retained. The admin API still accepts existing payload values and maps them to clean statuses:

- `APPROVED` -> `ACTIVE`
- `REVIEW` -> `DRAFT`
- `REJECTED` -> `ARCHIVED`

Original and preview tunnels are read-only. They now resolve source metadata from `image_assets` and preview derivatives from `image_derivatives`.

## Variant Handling

Admin preview route query params still accept lowercase variants:

- `thumb`
- `card`
- `detail`

The service translates them to clean derivative variants:

- `THUMB`
- `CARD`
- `DETAIL`

No R2 storage keys are changed.

## Validation

Run:

```bash
pnpm --dir apps/api smoke:clean-admin-catalog
pnpm --dir apps/api smoke:clean-runtime-routes
pnpm --dir apps/api db:validate:image-logs
pnpm --dir apps/api db:validate:image-derivatives
pnpm --dir apps/api db:validate:image-assets
pnpm --dir apps/api db:validate:photographers
```

Expected admin smoke output:

```txt
total = 9993
with_photographer = 9993
with_event = 9993
with_card = 9616
with_detail = 9616
with_thumb = 9616
derivative_orphans = 0
old_admin_runtime_references = 0
```

Derivative coverage is informational because 377 imported images do not currently have generated clean derivatives.

## Manual Smoke Checklist

Admin catalog:

- Catalog/list page loads.
- Rows show title, Fotokey, clean status, visibility, photographer, event, and preview where available.

Admin detail/edit:

- Known image detail opens.
- Metadata/status/visibility render from `image_assets`.
- Editorial metadata save updates `image_assets.updated_at`.
- Publish-state action updates `image_assets.status`, `image_assets.visibility`, and `image_assets.updated_at`.
- Old `assets.updated_at` does not change from these admin runtime actions.

Admin preview/original:

- Preview/card/detail tunnels resolve from `image_derivatives`.
- Original tunnel resolves from `image_assets.original_storage_key`.

## Deferred Work

- Legacy import scripts still write old/import tables.
- Bulk import should not continue without a clean-table sync/import refactor, or clean runtime tables can become stale.
- Legacy fixture routes still exist.
- Photographer portal accounts remain deferred.
