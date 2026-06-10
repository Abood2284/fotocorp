# Legacy to Clean Schema Map

Maps retired legacy catalog/import tables to the canonical tables used by current runtime and admin.

**Related docs**

- Historical import mechanics and sync: [Import / clean sync runbook](./import-sync-runbook.md)
- Missing event links / `event_id` backfill: [Legacy event linking repair runbook](./legacy-event-linking-repair-runbook.md)
- Legacy table retirement: [Legacy table retirement runbook](./legacy-table-retirement-runbook.md)
- PR history: [reports/](./reports/)

## Lifecycle

```txt
retired legacy CSV/import mirrors → canonical runtime tables already cut over
```

Runtime, public catalog, staff admin, Typesense indexer, and contributor flows read canonical tables only. The legacy mirror tables (`assets`, `asset_events`, `asset_media_derivatives`, legacy log tables, and stale import issue data) have been retired from the production command path.

## Legacy tables

| Legacy table | Clean table | Status | Notes |
| --- | --- | --- | --- |
| `photographer_profiles` | `contributors` | Historical import reference | Clean rows keyed by `legacy_photographer_id`; not part of this retirement. |
| `asset_events` | `photo_events` | Retired mirror | UUIDs/legacy ids were preserved in `photo_events`. |
| `assets` | `image_assets` | Retired mirror | UUIDs were preserved in `image_assets`; runtime catalog uses clean table. |
| — | `image_assets_metadata` | New (schema only) | One-to-one original **technical** metadata per `image_assets.id` (pixels, DPI, format, file size, orientation, quality buckets). Not catalog/search metadata; populated later by Sharp scanner; drives future Medium/Low download generation. |
| `asset_media_derivatives` | `image_derivatives` | Retired mirror | Runtime previews use canonical `image_derivatives`. |
| `asset_media_access_logs` | `image_access_logs` | Retired legacy logs | Runtime writes target clean table. |
| `asset_download_logs` | `image_download_logs` | Retired legacy logs | Runtime writes target clean table; see [download completion report](./reports/download-completion-logging-report.md). |

## Legacy export → column mapping (assets / image_assets)

These mappings come from archived legacy import/sync behavior. **Do not swap** `title` and `eventhead` — a common source of admin/public confusion.

| Legacy export column | Legacy `assets` column | Clean `image_assets` column | Product meaning |
| --- | --- | --- | --- |
| `title` | `title` | `who_is_in_picture` | Person / subject (“Who is in picture?”) |
| `eventhead` (or `headline`) | `headline` | `headline` | Per-image editorial event line; often ≈ event name but **not** the event FK |
| `caption` | `caption` | `caption` | Full caption body |
| `eventid` | `legacy_event_id` + FK → `event_id` | `legacy_event_id` + `event_id` (via sync) | Event grouping; public event title comes from `photo_events.name` |
| `imagecode` | `legacy_imagecode` | `legacy_image_code` | Legacy business code; may map to `fotokey` when assigned |
| `photographid` | `legacy_photographer_id` + FK | `legacy_photographer_id` + `contributor_id` (via sync) | Contributor / photographer identity |

### Product semantics (UI / API)

| UI concept | Canonical clean field | Not this |
| --- | --- | --- |
| Who is in picture | `image_assets.who_is_in_picture` | `headline` (legacy `eventhead`) |
| Event name / grouping | `photo_events.name` via `image_assets.event_id` | `headline` alone |
| Caption | `image_assets.caption` | — |
| Headline | `image_assets.headline` | Legacy per-image line; redundant with event name for many rows; staff catalog no longer edits this as “Who is in picture?” |

## Important legacy fields

| Legacy / source field | Clean field | Notes |
| --- | --- | --- |
| `assets.photographer_profile_id` | `image_assets.contributor_id` → `contributors.id` | Runtime joins use `contributor_id`; stable legacy numeric id on `contributors.legacy_photographer_id`. |
| `assets.event_id` | `image_assets.event_id` → `photo_events.id` | Resolved at import from `asset_events` by `legacy_event_id`. If the event row is missing, `legacy_event_id` is still stored but `event_id` stays NULL until backfill (see event linking runbook). |
| `assets.id` | `image_assets.id` | Same UUID where imported from legacy. |
| Legacy image / Fotokey code | `image_assets.legacy_image_code`; public API `fotokey` when assigned | Business identifier; not the same as internal UUID. |
| `asset_media_derivatives.storage_key` | `image_derivatives.storage_key` | Provider-neutral key string on clean rows. |

## Historical sync behavior (`legacy:sync-clean-schema`)

| Step | What it does |
| --- | --- |
| Contributor upsert | `photographer_profiles` → `contributors` (on `legacy_photographer_id`) |
| Photo events upsert | `asset_events` → `photo_events` (same UUID) |
| Image assets upsert | `assets` → `image_assets` (same UUID; copies `title` → `who_is_in_picture`, `headline`, `event_id`, etc.) |
| Image derivatives upsert | `asset_media_derivatives` → `image_derivatives` |

This behavior is archive-only after legacy table retirement. Do not re-enable or run the old import/sync commands against production without a new schema/import design.

**Historical event linking gap:** Import resolved `assets.event_id` only when the target row already existed in `asset_events`. A partial events import (e.g. connection drop after ~50k rows) left assets with `legacy_event_id` set but `event_id` NULL. Details remain in [event linking repair runbook](./legacy-event-linking-repair-runbook.md) for audit context.

**Post-sync search:** Bulk `event_id` changes require Typesense reindex (`pnpm --dir apps/api typesense:index-public-assets`). No VPS redeploy — only document upserts.

## Naming policy

- The `legacy_` prefix (and columns such as `legacy_photographer_id`, `legacy_event_id`, `legacy_image_code`) is for **raw imported old-system references** and stable cross-world joins. Do not use it for new product-only identifiers.
- Canonical **current** fields and API-facing names should use clean names, including:
  - `fotokey`
  - `who_is_in_picture` / API `whoIsInPicture`
  - `original_storage_key`
  - `original_filename`
  - `contributor_id`
  - `event_id`

## Legacy table retirement status

Legacy mirror table retirement is covered by [Legacy table retirement runbook](./legacy-table-retirement-runbook.md). Before applying on any production branch, operators must complete backup/export, Neon PITR confirmation, production-branch clone testing, validation queries, app smoke checks, and rollback planning.

