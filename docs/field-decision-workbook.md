# Fotocorp Field Decision Workbook

Purpose: capture the decisions still needed to move from legacy/source metadata into a final Fotocorp schema without blocking current product work.

This document is intentionally provisional. It is a planning artifact for client and internal review, not a schema spec.

## Current Implementation Boundaries

- Frontend integration should target provisional DTOs, not legacy field names.
- Backend runtime currently uses repository abstractions and fixture-backed data, which gives us room to change storage later without changing app-facing contracts immediately.
- Final database schema, legacy-field retention, and persistence rules remain pending client confirmation.

Relevant current boundaries:

- API DTO layer: `apps/api/src/lib/dtos.ts`
- API repository abstraction: `apps/api/src/services/repositories/catalogRepository.ts`
- API fixture repository: `apps/api/src/services/repositories/fixtureCatalogRepository.ts`
- Shared ingestion run contract: `packages/shared/src/ingestion.ts`

## Proposed Contract Separation

Working rule: separate app-facing concepts from legacy/source fields.

App-facing contract layer should continue to use stable product concepts such as:

- `id`
- `title`
- `description`
- `filename`
- `previewUrl`
- `mediaAccess`
- `tags`
- `collection`
- `location`
- `visibility`
- `ingestionStatus`
- `ingestionRunId`

Legacy/source fields should be treated as input candidates only until approved. They may end up:

- kept directly
- renamed
- dropped
- derived into app-facing fields
- retained as admin-only raw metadata

Recommendation: keep the app-facing DTO contract intentionally narrower than any eventual raw metadata table.

## Legacy Field Inventory Template

Use one row per source field or source-system concept.

| Legacy field | Source system | Example value | Used today? | Proposed app-facing field | Classification | Notes / open question |
| --- | --- | --- | --- | --- | --- | --- |
| `legacy_field_name` | `source_name` | `example` | Yes / No / Unknown | `title` | Keep / Rename / Drop / Derive / Net-new | Why this exists and what decision is needed |
| `capture_dt` | `legacy_db` | `2024-07-18T09:31:00Z` | Unknown | `capturedAt` | Rename | Confirm source of truth and timezone rules |
| `usage_code` | `legacy_db` | `RM-EDITORIAL` | Unknown | `licenseTier` or admin-only | Derive | Needs client licensing rules |

## Classification Guide

### Keep

Use when the source field maps cleanly to a stable product concept and the name is already acceptable.

### Rename

Use when the source field should survive but the app/domain name should be clearer than the legacy name.

### Drop

Use when the field has no product value, is duplicative, or is obsolete.

### Derive

Use when the app-facing field should be computed from one or more legacy/source fields.

### Net-new

Use when the product clearly needs a field that legacy systems do not provide directly.

## Sample Mapping Examples

These are examples only. They are not schema decisions.

| Legacy/source input | Provisional app-facing field | Classification | Example mapping note |
| --- | --- | --- | --- |
| `asset_filename` | `filename` | Rename | Preserve stored filename as a stable file label |
| `headline`, `caption`, or manual title field | `title` | Derive | Choose priority order if multiple text sources exist |
| EXIF capture date or archive event date | `capturedAt` | Derive | Need fallback rule when EXIF is missing |
| folder path / import batch | `collection` | Derive | May become explicit collection entity later |
| raw geo fields | `location` | Derive | Decide whether this is human-readable, structured, or both |
| usage restrictions / rights codes | `mediaAccess` or future license fields | Derive | Requires client business rule confirmation |
| source checksum | `checksumSha256` | Keep or admin-only | Likely admin/storage only, not user-visible |
| source filename | `sourceFilename` | Keep or admin-only | Useful for ingest/admin traceability |
| freeform tags from source | `tags` | Keep / Derive | Need normalization and search inclusion rules |

## Decision Checklist

### Search Fields

- Which text fields should be indexed for keyword search?
- Should search include filename?
- Should search include raw source metadata, or only normalized fields?
- Should tags and collection names be searchable?
- Should admin search include internal-only metadata not visible to end users?

### Visible Metadata Fields

- Which fields should appear on public/user-facing asset detail pages?
- Is `location` user-visible, admin-visible, both, or conditional?
- Is `capturedAt` required, optional, or hidden when low confidence?
- Should `collection` be a plain label for now or a future relational concept?

### Admin-Only Metadata

- Which source fields are needed for tracing/debugging imports?
- Which raw values must stay visible to operators even if not normalized yet?
- Do we need both normalized values and raw source values in admin views?
- Which import diagnostics should be preserved per asset?

### Licensing-Related Fields

- What client-approved concepts actually drive preview vs original access?
- Are licensing restrictions asset-level, contributor-level, collection-level, or customer-level?
- Do expiry dates, territory limits, embargo dates, or channel restrictions matter?
- Which fields are contractual truth versus derived convenience fields?

### Contributor / Category Flags

- Do contributor records exist as a real domain object, or only as labels?
- Are categories curated, imported, or both?
- Which flags affect browse/search/filtering versus internal reporting only?
- Do contributor/category flags change licensing or visibility logic?

## Unresolved Decisions

The following should stay explicitly open until the client confirms them:

- Source-of-truth fields for title, caption, and description
- Final searchable field set
- Which fields are public versus admin-only
- How rights/licensing concepts map to download eligibility
- Whether collections, contributors, and categories are first-class entities
- Whether location is freeform text, structured geography, or both
- Which ingest diagnostics must be stored long-term versus transiently
- Whether raw source metadata is preserved in full, partially, or not at all

## Business Rules Still Needed From Client

Ask the client to confirm:

1. Which metadata fields are contractually important versus merely convenient.
2. Which fields must be visible to end users.
3. Which fields must remain internal/admin-only.
4. What exact conditions allow original delivery versus preview-only access.
5. Which licensing restrictions need to be represented explicitly.
6. Which legacy fields are still actively maintained and trustworthy.
7. Which derived values are acceptable if source data is inconsistent or missing.

## Recommended Working Process

1. Fill the inventory template with real legacy/source fields.
2. Classify each field as Keep / Rename / Drop / Derive / Net-new.
3. Confirm the app-facing contract first.
4. Confirm admin-only and licensing fields second.
5. Finalize DB schema only after those decisions are agreed.

## Practical Rule For This Phase

Until the workbook is resolved:

- frontend should continue using provisional DTOs
- backend should continue using repository abstractions
- legacy/source names should not leak into app contracts by default
- final DB schema should remain pending client confirmation
