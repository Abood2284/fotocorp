# Legacy to Clean Schema Map

Maps legacy catalog tables used by import scripts to the **clean** tables used by current runtime and admin.

**Related docs**

- Import mechanics and sync: [Import / clean sync runbook](./import-sync-runbook.md)
- Missing event links / `event_id` backfill: [Legacy event linking repair runbook](./legacy-event-linking-repair-runbook.md)
- Legacy table drop plan (later): [schema legacy duplication audit — §8 phased deprecation](./reports/schema-legacy-duplication-audit-report.md#8-phased-deprecation-plan)
- PR history: [reports/](./reports/)

## Lifecycle

```txt
legacy CSV → legacy:import (writes old tables) → legacy:sync-clean-schema → clean runtime tables
```

Runtime, public catalog, staff admin, Typesense indexer, and contributor flows read **clean** tables only. Legacy tables remain for import compatibility until explicitly retired (see deprecation plan above — **do not drop yet**).

## Legacy tables

| Legacy table | Clean table | Status | Notes |
| --- | --- | --- | --- |
| `photographer_profiles` | `contributors` | Import + sync | Clean rows keyed by `legacy_photographer_id`; legacy table retained for import compatibility. |
| `asset_events` | `photo_events` | Import + sync | UUIDs preserved from legacy `asset_events.id`. |
| `assets` | `image_assets` | Import + sync | UUIDs preserved from legacy `assets.id`; runtime catalog uses clean table. |
| `asset_media_derivatives` | `image_derivatives` | Import + sync | UUIDs preserved; variants normalized to `THUMB` / `CARD` / `DETAIL`. |
| (legacy access logs) | `image_access_logs` | Migrated | Runtime writes target clean table. |
| (legacy download logs) | `image_download_logs` | Migrated | Runtime writes target clean table; see [download completion report](./reports/download-completion-logging-report.md). |

## Legacy export → column mapping (assets / image_assets)

These mappings come from `apps/api/scripts/legacy/import-legacy-fotocorp.ts` and `legacy:sync-clean-schema`. **Do not swap** `title` and `eventhead` — a common source of admin/public confusion.

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

## Sync behavior (`legacy:sync-clean-schema`)

| Step | What it does |
| --- | --- |
| Contributor upsert | `photographer_profiles` → `contributors` (on `legacy_photographer_id`) |
| Photo events upsert | `asset_events` → `photo_events` (same UUID) |
| Image assets upsert | `assets` → `image_assets` (same UUID; copies `title` → `who_is_in_picture`, `headline`, `event_id`, etc.) |
| Image derivatives upsert | `asset_media_derivatives` → `image_derivatives` |

**Event linking gap:** Import resolves `assets.event_id` only when the target row already exists in `asset_events`. A partial events import (e.g. connection drop after ~50k rows) leaves ~66k assets with `legacy_event_id` set but `event_id` NULL. Fix: re-import missing `eventtb` rows, `UPDATE assets SET event_id … FROM asset_events`, then re-run sync. Details: [event linking repair runbook](./legacy-event-linking-repair-runbook.md).

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

## When legacy tables can be dropped

Not until all of the following (see [schema audit §8](./reports/schema-legacy-duplication-audit-report.md#8-phased-deprecation-plan)):

- Legacy import pipeline retired or run-only on demand with a restore path
- Production event linking repair applied (if the 2026-04-28 partial import occurred there)
- `db:validate:*` gates pass on the target branch
- FKs repointed off legacy tables (e.g. fotobox items still reference `assets.id` today)
