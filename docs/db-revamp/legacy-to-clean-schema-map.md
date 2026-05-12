# Legacy to Clean Schema Map

Maps legacy catalog tables used by import scripts to the **clean** tables used by current runtime and admin. For import mechanics and sync behavior, see [Import / clean sync runbook](./import-sync-runbook.md). Deeper PR history: [reports/](./reports/).

## Legacy tables

| Legacy table | Clean table | Status | Notes |
| --- | --- | --- | --- |
| `photographer_profiles` | `photographers` | Import + sync | Clean rows keyed by `legacy_photographer_id`; legacy table retained for import compatibility. |
| `asset_events` | `photo_events` | Import + sync | UUIDs preserved from legacy `asset_events`. |
| `assets` | `image_assets` | Import + sync | UUIDs preserved; runtime catalog uses clean table. |
| `asset_media_derivatives` | `image_derivatives` | Import + sync | UUIDs preserved; variants normalized to uppercase. |
| (legacy access logs) | `image_access_logs` | Migrated | Runtime writes target clean table. |
| (legacy download logs) | `image_download_logs` | Migrated | Runtime writes target clean table; see [download completion report](./reports/download-completion-logging-report.md). |

## Important legacy fields

| Legacy / source field | Clean field | Notes |
| --- | --- | --- |
| `assets.photographer_profile_id` | `image_assets.photographer_id` → `photographers.id` | Runtime joins use numeric legacy id on `photographers`. |
| `assets.id` | `image_assets.id` | Same UUID where imported from legacy. |
| Legacy image / Fotokey code | `image_assets.legacy_image_code`, API `fotokey` where mapped | Business identifier; not the same as internal UUID. |
| `asset_media_derivatives.storage_key` (legacy shapes) | `image_derivatives.storage_key` | Provider-neutral key string on clean rows. |

## Naming policy

- The `legacy_` prefix (and legacy-prefixed columns such as `legacy_photographer_id`, `legacy_image_code`) is for **raw imported old-system references** and stable cross-world joins. Do not use it for new product-only identifiers.
- Canonical **current** fields and API-facing names should use clean names, including:
  - `fotokey`
  - `original_storage_key`
  - `original_filename`
  - `photographer_id`
  - `event_id`
