# Photographer Normalization Report

## What Was Wrong

Legacy photographer identity was duplicated and hidden inside JSON payloads:

- `photographer_profiles` contained 1592 rows for 786 numeric legacy photographers.
- `photographer_profiles.legacy_photographer_id` existed but was empty.
- `assets.photographer_profile_id` existed but was empty.
- The reliable relationship lived in `assets.legacy_payload->>'photographid'` and `photographer_profiles.legacy_payload->>'srno'`.

Photographer names are not reliable identifiers. Names can be duplicated, formatted inconsistently, abbreviated, misspelled, or changed over time. This normalization uses numeric legacy IDs only.

## What Changed

- Added a clean `photographers` table with one row per numeric legacy photographer.
- Added typed `assets.legacy_photographer_id`.
- Backfilled `assets.legacy_photographer_id` from `assets.legacy_payload->>'photographid'`.
- Backfilled current `assets.photographer_profile_id` to the canonical legacy `photographer_profiles.id`.
- Added a validation script for repeatable proof of counts, duplicates, coverage, and orphan checks.
- Left legacy tables in place. No legacy tables were deleted or renamed.

## Canonical Mapping Rule

Canonical photographer selection uses one numeric `legacy_payload.srno` per photographer. For duplicate profile rows, the canonical row is selected by:

1. valid-looking email
2. active legacy status (`Yes`, `yes`, `1`)
3. richer profile data
4. earliest `created_at`
5. lowest `id::text`

The numeric legacy ID expression is:

```sql
case
  when nullif(legacy_payload->>'srno', 'NULL') ~ '^[0-9]+$'
  then (legacy_payload->>'srno')::bigint
  else null
end
```

## Status Normalization

Legacy `pstatus` values are normalized as:

| Legacy value | Normalized status |
| --- | --- |
| `Yes`, `yes`, `1` | `ACTIVE` |
| `No`, `no` | `INACTIVE` |
| `Deleted` | `DELETED` |
| `NULL`, blank | `UNKNOWN` |
| anything else | `UNKNOWN` |

## Why `photographer_profiles.legacy_photographer_id` Is Not Backfilled

The existing `photographer_profiles.legacy_photographer_id` column has a unique constraint, while the current table has duplicate profile rows for every numeric legacy photographer ID. Updating that column directly would violate the constraint.

This PR therefore keeps the legacy profile table unchanged and writes canonical identity into the new `photographers` table. Current `assets.photographer_profile_id` is backfilled to the canonical `photographer_profiles.id` only because the current app still references that legacy table.

## Why `tempphotographer` Is Not Used

`tempphotographer` conflicts with the numeric photographer ID relationship and is not a primary mapping source. This PR uses only `photographid` and `srno` numeric legacy IDs.

## Known Legacy Data Quality Issues

- duplicate photographer profile rows
- placeholder emails like `contact@fotocorp.com`
- invalid or truncated emails
- dirty legacy statuses
- `tempphotographer` conflicts with numeric photographer ID

## Validation Command

```bash
pnpm --dir apps/api db:validate:photographers
```

## Expected Validation Output

The exact status distribution may vary if legacy data changes, but the critical checks must pass:

```txt
total_photographers: 786
distinct_legacy_photographer_ids: 786
missing_legacy_photographer_id: 0
duplicate_legacy_photographer_ids: 0
legacy_assets_with_legacy_photographer_id: equals legacy_assets
legacy_assets_with_photographer_profile_id: equals legacy_assets
orphan_legacy_photographer_ids: 0
orphan_current_profile_links: 0
PASS photographer normalization validation passed.
```
