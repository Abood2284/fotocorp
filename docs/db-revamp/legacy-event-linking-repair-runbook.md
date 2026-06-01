# Legacy event linking repair runbook

Repairs the **missing event links** and **admin/public metadata mismatch** discovered during FC05032575 investigation (Development Neon, 2026-06-01).

## Problem summary

| Symptom | Root cause |
| --- | --- |
| Public asset shows no event (`Event: —`) | `image_assets.event_id` is NULL |
| Admin catalog shows event name under **Who is in picture?** | Staff UI reads `headline` (legacy `eventhead`) before `who_is_in_picture` |
| Event grouping/search broken for recent content | **4,959 events** failed import with `Connection terminated unexpectedly`; assets still reference those `legacy_event_id` values |

### Canonical legacy field mapping (correct — do not swap columns)

| Legacy export column | Legacy `assets` column | Clean `image_assets` column | Meaning |
| --- | --- | --- | --- |
| `title` | `title` | `who_is_in_picture` | Person / subject |
| `eventhead` | `headline` | `headline` | Per-image event editorial line (often ≈ event name) |
| `caption` | `caption` | `caption` | Full caption |
| `eventid` | `legacy_event_id` + FK lookup → `event_id` | same via sync | Event grouping |

FC05032575 (Development) after investigation:

```text
who_is_in_picture = Nita Ambani          ← legacy title
headline          = Premiere of show…     ← legacy eventhead
legacy_event_id   = 85370
event_id          = NULL                  ← event 85370 never landed in asset_events
```

Event **85370 exists** in `data/legacy/eventtb.csv` but not in `asset_events` because the 2026-04-28 events import dropped the DB connection after ~50,000 successful rows.

### Scale (Development baseline — re-run pre-flight before executing)

| Metric | Approx. value |
| --- | ---: |
| Active legacy assets | 724,544 |
| Missing `event_id` | 66,292 (~9.1%) |
| Distinct missing legacy events | 4,796 |
| Failed event import rows | 4,959 |
| `asset_events` rows before fix | 50,000 (max `legacy_event_id` 50414) |
| `eventtb.csv` rows | 54,959 (max `legacy_event_id` 85418) |
| Assets with `legacy_event_id = 0` (no real event) | 143 |

---

## Scope

**In scope (this runbook)**

1. Re-import missing `eventtb` rows into `asset_events`
2. Backfill `assets.event_id` from `legacy_event_id`
3. Run `legacy:sync-clean-schema` → `photo_events` + `image_assets`
4. Validate with SQL + `db:validate:clean-sync`
5. Reindex affected public search documents in Typesense

**Out of scope (separate PR — do not block data repair)**

- Staff catalog UI: stop using `headline` for the **Who is in picture?** field; save `whoIsInPicture` instead of `headline`
- Changing legacy column semantics or renaming DB columns

---

## Prerequisites

1. **Neon branch:** run on **Development** first; use a dedicated repair branch if you want isolation.
2. **`DATABASE_URL`** in `apps/api/.dev.vars` points at the intended branch (pooler URL is fine).
3. **Legacy export present:** `data/legacy/eventtb.csv` (~54,959 data rows + header).
4. **No concurrent** `legacy:import` / `legacy:sync-clean-schema` jobs on the same branch.
5. **Time budget:** events re-import ~2–5 min; backfill ~1–3 min; full sync ~5–15 min; Typesense partial/full reindex varies (see Phase 5).

### Optional: repair branch

```bash
# Example — adjust project/branch names to your Neon setup
npx neonctl@latest branches create --name legacy-event-repair --parent development
# Point apps/api/.dev.vars DATABASE_URL at the new branch endpoint
```

---

## Phase 0 — Baseline (record before changing anything)

Run on the target branch and save output.

```sql
-- A) Event import ceiling
SELECT count(*) AS asset_events_count,
       max(legacy_event_id) AS max_legacy_event_id
FROM asset_events;

-- B) Missing links
SELECT count(*) AS unlinked_active_legacy
FROM image_assets
WHERE source = 'LEGACY_IMPORT'
  AND status = 'ACTIVE'
  AND event_id IS NULL
  AND legacy_event_id IS NOT NULL
  AND legacy_event_id > 0;

-- C) Failed import issues (should be ~4959 on broken envs)
SELECT count(*) AS failed_event_imports
FROM asset_import_issues
WHERE legacy_source = 'eventtb'
  AND issue_type = 'IMPORT_ERROR';

-- D) Canary asset
SELECT fotokey, who_is_in_picture, headline, legacy_event_id, event_id
FROM image_assets
WHERE fotokey = 'FC05032575';
```

**Expected pre-fix (Development):** `asset_events_count ≈ 50000`, `max_legacy_event_id = 50414`, `unlinked_active_legacy ≈ 66149`, canary `event_id` NULL.

---

## Phase 1 — Re-import missing events

The importer upserts on `asset_events.legacy_event_id` — safe to re-run.

### Option A (recommended): full events re-import

Processes all ~54,959 rows; updates existing 50,000 + inserts ~4,959 missing.

```bash
cd /path/to/fotocorp

# Dry run (no writes)
pnpm --dir apps/api legacy:import -- --only events --dry-run

# Apply — use smaller batch size to avoid Neon connection drops
pnpm --dir apps/api legacy:import -- --only events --batch-size 200
```

### Option B (faster): import only the failed tail

First missing event **50415** starts at **CSV line 50002** (line 1 = header). Use `--offset 50001` to skip header + first 50,000 data rows.

```bash
pnpm --dir apps/api legacy:import -- --only events --offset 50001 --batch-size 200
```

### Verify Phase 1

```sql
SELECT count(*) AS asset_events_count,
       max(legacy_event_id) AS max_legacy_event_id
FROM asset_events;
-- Target: count ≈ 54959, max_legacy_event_id ≈ 85418

SELECT id, legacy_event_id, name, event_date
FROM asset_events
WHERE legacy_event_id = 85370;
-- Target: one row — "Premiere of show The Phantom of the Opera at NMACC"

SELECT count(*) AS remaining_failed
FROM asset_import_issues
WHERE legacy_source = 'eventtb'
  AND issue_type = 'IMPORT_ERROR'
  AND raw_payload->>'eventid' NOT IN (
    SELECT legacy_event_id::text FROM asset_events
  );
-- Target: 0 (or re-run import if not)
```

If import still fails with connection errors:

- Lower `--batch-size` to `100` or `50`
- Retry Option B only
- Confirm Neon compute is not cold-suspended mid-job

---

## Phase 2 — Backfill `assets.event_id`

Import-time `resolveRelations()` ran when events were missing, so `assets.event_id` stayed NULL even though `legacy_event_id` was stored. Sync copies `assets.event_id` → `image_assets.event_id`; **backfill legacy tables first**.

### 2a) Preview (dry run)

```sql
SELECT count(*) AS assets_to_backfill
FROM assets a
JOIN asset_events ae ON ae.legacy_event_id = a.legacy_event_id
WHERE a.legacy_event_id IS NOT NULL
  AND a.legacy_event_id > 0
  AND a.event_id IS NULL;
-- Target on Dev: ~66149
```

### 2b) Apply backfill

Run inside a transaction on the target branch:

```sql
BEGIN;

UPDATE assets a
SET
  event_id = ae.id,
  updated_at = now()
FROM asset_events ae
WHERE ae.legacy_event_id = a.legacy_event_id
  AND a.legacy_event_id IS NOT NULL
  AND a.legacy_event_id > 0
  AND a.event_id IS NULL;

-- Sanity: no asset should point at a mismatched legacy id
SELECT count(*) AS bad_links
FROM assets a
JOIN asset_events ae ON ae.id = a.event_id
WHERE a.legacy_event_id IS NOT NULL
  AND a.legacy_event_id > 0
  AND ae.legacy_event_id <> a.legacy_event_id;
-- Must be 0 before COMMIT

COMMIT;
```

### 2c) Verify before sync

```sql
SELECT count(*) AS assets_still_unlinked
FROM assets a
WHERE a.legacy_event_id IS NOT NULL
  AND a.legacy_event_id > 0
  AND a.event_id IS NULL;
-- Target: 0

SELECT a.event_id, ae.name, ia.fotokey
FROM assets a
JOIN image_assets ia ON ia.id = a.id
LEFT JOIN asset_events ae ON ae.id = a.event_id
WHERE ia.fotokey = 'FC05032575';
-- Target: event_id populated, name = Phantom/NMACC event
```

**Do not** update `image_assets.event_id` directly unless emergency — prefer sync in Phase 3.

### Known exception: `legacy_event_id = 0`

**143** active legacy assets use `legacy_event_id = 0` (invalid / placeholder). They will remain unlinked after this repair. Track separately for manual editorial assignment or a follow-up cleanup script.

---

## Phase 3 — Sync clean schema

Propagates `asset_events` → `photo_events` and `assets` → `image_assets` (including `event_id`).

```bash
pnpm --dir apps/api legacy:sync-clean-schema
```

Expect JSON summary with non-zero `photoEventsUpserted` and `imageAssetsUpserted`.

### Verify Phase 3

```sql
SELECT count(*) AS photo_events_count FROM photo_events;
-- Target: match asset_events (~54959)

SELECT ia.fotokey, ia.who_is_in_picture, ia.headline,
       ia.event_id, pe.name AS event_name
FROM image_assets ia
LEFT JOIN photo_events pe ON pe.id = ia.event_id
WHERE ia.fotokey = 'FC05032575';
-- Target: event_id set, event_name populated

SELECT count(*) AS image_assets_still_unlinked
FROM image_assets
WHERE source = 'LEGACY_IMPORT'
  AND status = 'ACTIVE'
  AND legacy_event_id > 0
  AND event_id IS NULL;
-- Target: 0
```

---

## Phase 4 — Automated validation

```bash
pnpm --dir apps/api db:validate:clean-sync
```

**Note:** `db:validate:clean-sync` currently asserts `image_assets_missing_event = 0` for **all** `LEGACY_IMPORT` rows with `event_id IS NULL`. After repair, the only remaining nulls should be the **143** `legacy_event_id = 0` rows — validation may still fail until that check is narrowed (exclude `legacy_event_id = 0`) or those rows are manually assigned. Treat SQL in Phase 4b as the operational gate if the script fails on that one rule.

### Phase 4b — Operational gate queries

```sql
-- Gate 1: event table parity
SELECT (SELECT count(*) FROM asset_events) AS old_events,
       (SELECT count(*) FROM photo_events) AS clean_events;

-- Gate 2: relinkable assets fixed
SELECT count(*) AS unlinked_with_valid_legacy_event
FROM image_assets
WHERE source = 'LEGACY_IMPORT'
  AND status = 'ACTIVE'
  AND legacy_event_id > 0
  AND event_id IS NULL;
-- Target: 0

-- Gate 3: year distribution sanity (2020+ should have links again)
SELECT extract(year FROM coalesce(image_date, uploaded_at, created_at))::int AS yr,
       count(*) FILTER (WHERE event_id IS NOT NULL) AS linked,
       count(*) FILTER (WHERE event_id IS NULL) AS unlinked
FROM image_assets
WHERE source = 'LEGACY_IMPORT' AND status = 'ACTIVE'
  AND coalesce(image_date, uploaded_at, created_at) >= '2020-01-01'
GROUP BY 1
ORDER BY 1;
```

---

## Phase 5 — Typesense reindex

Postgres is source of truth; search/event facets read **`event_id`** and **`event_title`** from the index. After bulk `event_id` backfill, reindex affected documents.

### Option A — Full reindex (safest after bulk repair)

On a machine with DB + Typesense env vars (`apps/api/.dev.vars`):

```bash
# Preview
pnpm --dir apps/api typesense:index-public-assets -- --dry-run

# Apply (long-running; default batch 500)
pnpm --dir apps/api typesense:index-public-assets
```

See [`typesense-cloudflare-access-runbook.md`](./typesense-cloudflare-access-runbook.md) for collection alias swap if you rebuild into a new collection.

### Option B — Targeted reindex (Dev smoke)

Reindex only assets that were unlinked before repair (export IDs once, then index in batches):

```sql
-- Export candidate ids to a temp table or CSV (example: recent unlinked cohort)
SELECT id::text
FROM image_assets
WHERE source = 'LEGACY_IMPORT'
  AND status = 'ACTIVE'
  AND visibility = 'PUBLIC'
  AND uploaded_at >= '2019-01-01'
ORDER BY id;
```

Use `--resume-after-id` for chunked runs if the full indexer is too heavy:

```bash
pnpm --dir apps/api typesense:index-public-assets -- --resume-after-id <uuid> --batch-size 500
```

### Verify Phase 5

1. Public asset page for FC05032575 shows linked **Event** (not `—`).
2. `/search?eventId=<uuid>` returns grouped results for the Phantom/NMACC event.
3. Event facet counts increase for 2019–2025 filters.

```bash
pnpm --dir apps/api search:smoke-typesense
```

---

## Phase 6 — Admin UI fix (separate PR)

Data repair alone **does not** fix the staff catalog label bug.

| Location | Current (wrong) | Target |
| --- | --- | --- |
| `staff-catalog-detail-sidebar.tsx` load | `headline \|\| whoIsInPicture` | `whoIsInPicture` only (optionally show `headline` as read-only **Event headline (legacy)** ) |
| save payload | `headline: title` | `whoIsInPicture: title` |
| list row title | `headline \|\| whoIsInPicture` | prefer `whoIsInPicture` for people; use `headline` or event name only as secondary |

Deploy after or in parallel with data repair so operators stop mis-editing `headline`.

---

## Phase 7 — Manual smoke checklist

- [ ] **Public** `/assets/<id>` for FC05032575 — Who is in picture: **Nita Ambani**; Event: **Premiere of show…** (linked, not `—`)
- [ ] **Staff catalog** same asset — after UI fix: Who is in picture shows **Nita Ambani** (until UI fix: expect wrong value — document for QA)
- [ ] Event dropdown lists Phantom/NMACC event and saves correctly
- [ ] Search by event groups photos; event breadcrumb on detail page works
- [ ] Sample 2019 / 2024 / 2025 asset — each has `event_id` when `legacy_event_id > 0`
- [ ] `db:validate:clean-sync` passes (or documented exception for `legacy_event_id = 0`)

---

## Production execution order

1. Snapshot / note Production baseline (Phase 0 queries).
2. Schedule low-traffic window — sync touches wide `image_assets` upsert.
3. Run Phase 1 → 2 → 3 on Production branch.
4. Run Phase 4 validation.
5. Run Typesense reindex (Phase 5) — coordinate with search ops; alias swap if required.
6. Deploy admin UI fix (Phase 6).
7. Spot-check high-traffic events and recent uploads.

**Rollback:** there is no automatic rollback. If sync misbehaves, restore from Neon branch restore / PITR before Phase 3 commit, or re-run sync after fixing `assets`/`asset_events`. Do not delete `asset_events` rows without a restore plan.

---

## Appendix — One-time script (optional)

If you prefer a checked-in script over raw SQL, add a one-time entry to [`apps/api/scripts/db/ONE_TIME_SCRIPTS.md`](../../apps/api/scripts/db/ONE_TIME_SCRIPTS.md):

| Script | npm command | Purpose |
| --- | --- | --- |
| `backfill-assets-event-id-from-legacy.ts` | `pnpm --dir apps/api db:backfill:assets-event-id` | Phase 2 backfill with `--dry-run` |

Implementation should mirror Phase 2 SQL exactly, log updated row counts, and refuse to run if target `asset_events` count `< 54900`.

---

## Related docs

- [Import / clean sync runbook](./import-sync-runbook.md)
- [Schema legacy duplication audit — headline / who_is_in_picture model](./reports/schema-legacy-duplication-audit-report.md)
- [Typesense runbook](./typesense-cloudflare-access-runbook.md)
- Legacy importer: `apps/api/scripts/legacy/import-legacy-fotocorp.ts`
- Sync pipeline: `apps/api/scripts/legacy/sync-clean-schema-after-import.ts`
