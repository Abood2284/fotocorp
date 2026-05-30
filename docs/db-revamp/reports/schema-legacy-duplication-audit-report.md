# Schema Legacy Duplication Audit Report

Date: 2026-05-30  
Environment audited: Neon **Development** branch `br-steep-sun-ao0nw2cc` (project `Fotocorp` / `tiny-thunder-19900347`)  
Method: Read-only `SELECT` queries via Neon MCP + full codebase grep for runtime table/column usage  
Scope: Legacy vs clean catalog tables, `headline` duplication, access/download log pairs, and phased deprecation plan

---

## 1. Executive summary

Fotocorp currently operates a **dual-layer database model** created during the DB revamp:

| Layer | Role | Used by runtime API? |
| --- | --- | --- |
| **Legacy import layer** | Landing zone for old Fotocorp export + historical audit | **No** (scripts/validation only) |
| **Clean runtime layer** | Production catalog, media, logs, contributor flows | **Yes** |

On Development, legacy catalog tables (`assets`, `asset_events`, `photographer_profiles`, `asset_media_derivatives`) still exist alongside clean tables (`image_assets`, `photo_events`, `contributors`, `image_derivatives`) with **~733k shared UUIDs** and **zero column drift** on overlapping rows.

### Key findings

1. **`assets` vs `image_assets`:** `assets` is legacy import staging (~2 GB). Runtime never queries it. Safe to archive/drop **after** legacy re-import pipeline is retired.
2. **`headline` on `image_assets`:** **89.7%** of non-empty values exactly match `photo_events.name`; **91.7%** are redundant with event name **or** caption. **~60k rows** carry distinct shorthand text. Column is **not** the same as event name in the schema (legacy `eventhead` per image).
3. **Access logs:** There is **no** `asset_access_logs` table. Legacy table is **`asset_media_access_logs`**. Runtime writes **`image_access_logs`** only (`secureMedia.ts`). Same pattern for downloads: **`image_download_logs`** is live; **`asset_download_logs`** is empty.
4. **`description` on `image_assets`:** **0 populated rows** — immediate drop candidate.
5. **`asset_categories`:** **Not legacy-only** — still canonical for category names across public catalog, events, and staff UI.
6. **Schema debt:** `asset_fotobox_items.asset_id` FK references `assets.id` while runtime joins `image_assets`.

### Recommended direction

Phased deprecation — **do not drop legacy tables in one PR**. Sequence: stop writing unused columns → migrate unique headline data → re-point FKs → archive legacy tables → drop columns/tables with validation gates.

---

## 2. Investigation method

### 2.1 Database

All counts below were captured with read-only SQL on Neon Development unless noted.

```sql
-- List public tables (excerpt)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Observed tables relevant to this audit (41 total public tables):**

```txt
asset_categories
asset_download_logs
asset_events
asset_fotobox_items
asset_import_batches
asset_import_issues
asset_media_access_logs
asset_media_derivatives
assets
image_access_logs
image_assets
image_assets_duplicate_backup_20260518
image_derivatives
image_download_logs
photo_events
photographer_profiles
contributors
… (+ auth, staff, upload, publish, feed tables)
```

### 2.2 Codebase

Runtime usage was verified with ripgrep across `apps/api/src`:

| Pattern | Result |
| --- | --- |
| `from assets` / `join assets` in `apps/api/src` | **0 matches** |
| `image_assets` in catalog/media routes | **All production reads/writes** |
| `insert into image_access_logs` | `apps/api/src/routes/secureMedia.ts` |
| `insert into image_download_logs` | `apps/api/src/routes/internal/downloads/service.ts` |
| `asset_media_access_logs` writes in `apps/api/src` | **0 matches** |

Legacy `assets` appears only in:

- `apps/api/scripts/legacy/import-legacy-fotocorp.ts`
- `apps/api/scripts/legacy/sync-clean-schema-after-import.ts`
- `apps/api/scripts/db/validate-*.ts`
- Drizzle migrations (`0013_blushing_alice.sql`, etc.)

Canonical mapping doc: [`docs/db-revamp/legacy-to-clean-schema-map.md`](../legacy-to-clean-schema-map.md)

---

## 3. Legacy vs clean table inventory

### 3.1 Row counts and disk (Development)

```sql
SELECT 'assets' AS tbl, count(*)::bigint AS rows FROM assets
UNION ALL SELECT 'image_assets', count(*) FROM image_assets
UNION ALL SELECT 'asset_events', count(*) FROM asset_events
UNION ALL SELECT 'photo_events', count(*) FROM photo_events
UNION ALL SELECT 'photographer_profiles', count(*) FROM photographer_profiles
UNION ALL SELECT 'contributors', count(*) FROM contributors
UNION ALL SELECT 'asset_media_derivatives', count(*) FROM asset_media_derivatives
UNION ALL SELECT 'image_derivatives', count(*) FROM image_derivatives
UNION ALL SELECT 'asset_media_access_logs', count(*) FROM asset_media_access_logs
UNION ALL SELECT 'image_access_logs', count(*) FROM image_access_logs
UNION ALL SELECT 'asset_download_logs', count(*) FROM asset_download_logs
UNION ALL SELECT 'image_download_logs', count(*) FROM image_download_logs
ORDER BY tbl;
```

**Output:**

| Table | Rows |
| --- | ---: |
| `asset_download_logs` | 0 |
| `asset_events` | 50,000 |
| `asset_media_access_logs` | 9,920 |
| `asset_media_derivatives` | 29,427 |
| `assets` | 735,227 |
| `contributors` | 786 |
| `image_access_logs` | 6,018 |
| `image_assets` | 733,067 |
| `image_derivatives` | 763,737 |
| `image_download_logs` | 4 |
| `photo_events` | 50,001 |
| `photographer_profiles` | 1,592 |

```sql
SELECT
  pg_size_pretty(pg_total_relation_size('assets')) AS assets_size,
  pg_size_pretty(pg_total_relation_size('image_assets')) AS image_assets_size,
  pg_size_pretty(pg_total_relation_size('asset_media_access_logs')) AS old_access_size,
  pg_size_pretty(pg_total_relation_size('image_access_logs')) AS new_access_size,
  pg_size_pretty(pg_total_relation_size('asset_media_derivatives')) AS old_deriv_size,
  pg_size_pretty(pg_total_relation_size('image_derivatives')) AS new_deriv_size;
```

**Output:**

| Relation | Approx size |
| --- | --- |
| `assets` | 2062 MB |
| `image_assets` | 2860 MB |
| `asset_media_access_logs` | 4168 kB |
| `image_access_logs` | 4496 kB |
| `asset_media_derivatives` | 14 MB |
| `image_derivatives` | 469 MB |

**Interpretation:**

- `assets` alone is **~2 GB** of duplicated catalog metadata (import archive).
- `image_derivatives` has grown far beyond legacy `asset_media_derivatives` (763k vs 29k) due to regeneration / clean pipeline — legacy derivative table is a **stale subset**.

### 3.2 Architecture diagram

```mermaid
flowchart TB
  subgraph legacy["Legacy layer — import / archive"]
    A[assets]
    AE[asset_events]
    PP[photographer_profiles]
    AMD[asset_media_derivatives]
    AMAL[asset_media_access_logs]
    ADL[asset_download_logs]
    IMP[asset_import_batches]
    ISS[asset_import_issues]
  end

  subgraph clean["Clean layer — runtime"]
    IA[image_assets]
    PE[photo_events]
    C[contributors]
    ID[image_derivatives]
    IAL[image_access_logs]
    IDL[image_download_logs]
    PEF[public_event_feed_items]
  end

  subgraph shared["Shared / canonical"]
    AC[asset_categories]
  end

  IMP --> A
  A -->|legacy:sync-clean-schema| IA
  AE -->|sync UUID-preserving| PE
  PP -.->|import only| C
  AMD -.->|stale subset| ID

  IA --> PE
  IA --> C
  IA --> AC
  PE --> AC

  API[Runtime API / Web BFF] --> IA
  API --> ID
  API --> IAL
  API --> IDL
  API -.x AMAL
  API -.x ADL
  API -.x A
```

### 3.3 Import tooling footprint

```sql
SELECT
  count(*)::bigint AS import_batches,
  (SELECT count(*) FROM asset_import_issues) AS import_issues
FROM asset_import_batches;
```

**Output:**

| import_batches | import_issues |
| ---: | ---: |
| 111 | 849,137 |

These tables support legacy CSV/chunk import diagnostics. Not used by runtime catalog routes.

---

## 4. Question 1: `assets` vs `image_assets`

### 4.1 What each table is

| | `assets` | `image_assets` |
| --- | --- | --- |
| **Schema file** | `apps/api/src/db/schema/legacy.ts` | `apps/api/src/db/schema/image-assets.ts` |
| **Purpose** | Legacy export landing table | Clean production catalog |
| **Status enum** | `DRAFT`, `REVIEW`, `APPROVED`, `READY`, `PUBLISHED`, … | `DRAFT`, `SUBMITTED`, `APPROVED`, `ACTIVE`, `ARCHIVED`, … |
| **People field** | `title` | `who_is_in_picture` (renamed via `0034_image_assets_who_is_in_picture.sql`) |
| **Storage key** | `r2_original_key` | `original_storage_key` |
| **Photographer FK** | `photographer_profile_id` → `photographer_profiles` | `contributor_id` → `contributors` |
| **Event FK** | `event_id` → `asset_events` | `event_id` → `photo_events` |

### 4.2 ID overlap (Development)

```sql
SELECT
  (SELECT count(*) FROM assets a
   WHERE NOT EXISTS (SELECT 1 FROM image_assets ia WHERE ia.id = a.id)) AS assets_only,
  (SELECT count(*) FROM image_assets ia
   WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = ia.id)) AS image_assets_only,
  (SELECT count(*) FROM assets a
   INNER JOIN image_assets ia ON ia.id = a.id) AS shared_ids;
```

**Output:**

| assets_only | image_assets_only | shared_ids |
| ---: | ---: | ---: |
| 2,200 | 40 | 733,027 |

**`image_assets_only` (40 rows):** contributor uploads with `source = 'FOTOCORP'` — created directly in clean schema, never written to `assets`.

**`assets_only` (2,200 rows):** matches manual backup table:

```sql
SELECT count(*)::bigint AS rows FROM image_assets_duplicate_backup_20260518;
-- Output: 2200
```

### 4.3 Column drift on shared IDs

```sql
SELECT count(*)::bigint AS drift_rows
FROM assets a
JOIN image_assets ia ON ia.id = a.id
WHERE coalesce(btrim(a.headline), '') <> coalesce(btrim(ia.headline), '')
   OR coalesce(btrim(a.caption), '') <> coalesce(btrim(ia.caption), '')
   OR coalesce(btrim(a.title), '') <> coalesce(btrim(ia.who_is_in_picture), '');
```

**Output:**

| drift_rows |
| ---: |
| 0 |

Sync pipeline keeps overlapping rows aligned.

### 4.4 Legacy import column mapping

From `apps/api/scripts/legacy/import-legacy-fotocorp.ts`:

```txt
legacy export "title"        → assets.title        → sync → image_assets.who_is_in_picture
legacy export "caption"      → assets.caption      → sync → image_assets.caption
legacy export "eventhead"    → assets.headline     → sync → image_assets.headline
legacy export "headline"     → assets.headline     → sync → image_assets.headline
```

Sync SQL: `apps/api/scripts/legacy/sync-clean-schema-after-import.ts` (`IMAGE_ASSETS_UPSERT`).

### 4.5 `image_assets` source breakdown (Development)

```sql
SELECT ia.source, ia.status, count(*)::bigint AS rows
FROM image_assets ia
GROUP BY ia.source, ia.status
ORDER BY rows DESC
LIMIT 15;
```

**Output:**

| source | status | rows |
| --- | --- | ---: |
| LEGACY_IMPORT | ACTIVE | 724,544 |
| LEGACY_IMPORT | DRAFT | 6,587 |
| LEGACY_IMPORT | ARCHIVED | 1,896 |
| FOTOCORP | ACTIVE | 40 |

### 4.6 Recommendation: `assets`

| Phase | Action |
| --- | --- |
| **Now** | Treat `assets` as **import-only archive**. Document that runtime must never query it. |
| **Before drop** | Confirm no operator still runs `legacy:import` + `legacy:sync-clean-schema` on schedule. |
| **Drop gate** | `db:validate:image-assets` passes; row count parity no longer required for ops. |
| **Savings** | ~2 GB on Development; similar on production if mirrored. |

---

## 5. Question 2: `headline` duplication on `image_assets`

### 5.1 Canonical field model (product intent)

After recent marketing UI fixes, public surfaces use:

| UI concept | Canonical DB field |
| --- | --- |
| **Event title** (detail H1, grid hover) | `photo_events.name` via `image_assets.event_id` |
| **Who is in picture** | `image_assets.who_is_in_picture` |
| **Caption** | `image_assets.caption` |
| **Headline** | `image_assets.headline` — **legacy per-image editorial line; not event title in schema** |

Contributor upload wizard **never sets** `headline` (only `whoIsInPicture`, `caption`, `keywords`).

### 5.2 Population counts

```sql
SELECT
  count(*)::bigint AS total,
  count(*) FILTER (WHERE headline IS NOT NULL AND btrim(headline) <> '') AS has_headline,
  count(*) FILTER (WHERE caption IS NOT NULL AND btrim(caption) <> '') AS has_caption,
  count(*) FILTER (WHERE who_is_in_picture IS NOT NULL AND btrim(who_is_in_picture) <> '') AS has_who,
  count(*) FILTER (
    WHERE headline IS NOT NULL AND btrim(headline) <> ''
      AND caption IS NOT NULL AND btrim(caption) <> ''
      AND btrim(headline) = btrim(caption)
  ) AS headline_eq_caption,
  count(*) FILTER (
    WHERE headline IS NOT NULL AND btrim(headline) <> ''
      AND event_id IS NOT NULL
  ) AS headline_with_event
FROM image_assets;
```

**Output:**

| total | has_headline | has_caption | has_who | headline_eq_caption | headline_with_event |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 733,067 | 726,720 | 729,625 | 614,620 | 95,455 | 660,487 |

```sql
SELECT count(*)::bigint AS has_description
FROM image_assets
WHERE description IS NOT NULL AND btrim(description) <> '';
```

**Output:** `0`

### 5.3 Headline vs event name

```sql
SELECT count(*)::bigint AS headline_matches_event_name
FROM image_assets ia
JOIN photo_events pe ON pe.id = ia.event_id
WHERE ia.headline IS NOT NULL AND btrim(ia.headline) <> ''
  AND btrim(ia.headline) = btrim(pe.name);
```

**Output:**

| headline_matches_event_name |
| ---: |
| 652,007 |

### 5.4 Redundancy summary

```sql
SELECT
  round(100.0 * 652007 / NULLIF(726720, 0), 2) AS pct_headline_eq_event,
  round(100.0 * 666249 / NULLIF(726720, 0), 2) AS pct_headline_redundant,
  round(100.0 * 60471 / NULLIF(726720, 0), 2) AS pct_headline_unique,
  round(100.0 * 95455 / NULLIF(726720, 0), 2) AS pct_headline_eq_caption;
```

Where redundant = equals event name **OR** equals caption:

```sql
SELECT count(*)::bigint AS headline_redundant
FROM image_assets ia
LEFT JOIN photo_events pe ON pe.id = ia.event_id
WHERE ia.headline IS NOT NULL AND btrim(ia.headline) <> ''
  AND (
    btrim(ia.headline) = btrim(coalesce(pe.name, ''))
    OR (ia.caption IS NOT NULL AND btrim(ia.headline) = btrim(ia.caption))
  );
-- Output: 666,249

SELECT count(*)::bigint AS headline_unique_content
FROM image_assets ia
LEFT JOIN photo_events pe ON pe.id = ia.event_id
WHERE ia.headline IS NOT NULL AND btrim(ia.headline) <> ''
  AND btrim(ia.headline) <> btrim(coalesce(pe.name, ''))
  AND (ia.caption IS NULL OR btrim(ia.headline) <> btrim(ia.caption));
-- Output: 60,471
```

**Output percentages:**

| Metric | Value |
| --- | ---: |
| `headline` = `photo_events.name` (exact) | **89.72%** of rows with headline |
| Redundant (= event name OR caption) | **91.68%** |
| Unique content (≠ event name AND ≠ caption) | **8.32%** (~60,471 rows) |
| `headline` = `caption` (exact) | **13.14%** |

### 5.5 Sample “unique” headlines

```sql
SELECT
  left(btrim(ia.headline), 120) AS headline_sample,
  left(btrim(pe.name), 80) AS event_name,
  left(btrim(ia.caption), 80) AS caption
FROM image_assets ia
JOIN photo_events pe ON pe.id = ia.event_id
WHERE ia.headline IS NOT NULL AND btrim(ia.headline) <> ''
  AND btrim(ia.headline) <> btrim(pe.name)
  AND (ia.caption IS NULL OR btrim(ia.headline) <> btrim(ia.caption))
LIMIT 8;
```

**Sample output:**

| headline_sample | event_name | caption |
| --- | --- | --- |
| Film Kedarnath starcast at Olive Bandra | Cast of film Kedarnath spotted at Olive restaurant | Abhishek Kapoor, Prerna Arora, Sara Ali Khan, Sushant Singh Rajput |
| Dabboo Ratnanis Calendar launch 2018 | Amitabh Bachchan launches Dabboo Ratnani's Calendar 2018 | Dabboo Ratnani's Calendar launch 2018 |
| Jaynati Reddy at LFW WF 2017 | Jayanati Reddy at LFW WF 2017 | Bollywood actor Aditi Rao Hydari walks the ramp… |
| Arpita Khan Ganpati visarjan | Arpita Khan's Ganesh Immersion 2018 | Arpita khan Ganpati visarjan |
| WTI launches Gai Yatra 2017 | WTI launches Gaj Yatra 2017 | Launch of Gaj Yatra Awareness Campaign… |
| Celebs arrive at Anil Kapoor's home post Sridevi's demise | Celebs arrive at Anil Kapoor's home post Sridevi's demise -Day 2 | Celebs arrive at Anil Kapoor's home over Sridevi's demise |
| Prayer meet of Vikram Phadnis’s mother | Prayer meet of Vikram Phadnis's mother | Bollywood actors Karisma, Kareena Kapoor… |
| Premier of film Bhikari | Premier of Marathi film Bhikari | Marathi actor Siddharth Chandekar poses… |

**Interpretation:** “Unique” headlines are usually **shorter event shorthand**, not captions. Public UI should continue using **`photo_events.name`** as primary title; unique headline text is low-value for display if event name is authoritative.

### 5.6 Headline without linked event

```sql
SELECT
  count(*)::bigint AS ia_missing_event,
  count(*) FILTER (WHERE headline IS NOT NULL AND btrim(headline) <> '') AS those_with_headline
FROM image_assets ia
WHERE ia.event_id IS NULL;
```

**Output:**

| ia_missing_event | those_with_headline |
| ---: | ---: |
| 66,608 | 66,233 |

For assets missing `event_id`, `headline` often acted as a free-text label in legacy data — another reason to migrate event linkage rather than keep `headline`.

### 5.7 Code still referencing `headline`

| Area | Files | Runtime impact |
| --- | --- | --- |
| Staff catalog edit/display | `staff/(workspace)/catalog/[id]/page.tsx`, `staff-catalog-client.tsx`, `staff-catalog-detail-sidebar.tsx` | Writable |
| Staff captions queue/editor | `staff-captions-editor.tsx`, `staff-captions-queue.tsx`, `captions/actions.ts` | Writable — field labeled “Title (Headline)” |
| Public marketing H1 / hover | `assets/[id]/page.tsx`, `public-asset-card.tsx` | **No longer used for title** (event name only); still in `alt` fallback chain |
| Public API DTO | `public-assets.ts`, `features/assets/types.ts` | Returned in JSON |
| Typesense | `typesense-public-asset-sync.ts` | Stored, **not indexed** in v2 `query_by` |
| Contributor upload | — | **Never set** |
| Account fotobox / downloads | `fotobox-grid.tsx`, `download-history-list.tsx` | Fallback title chain |

### 5.8 Recommendation: `headline`

| Step | Action | Risk |
| --- | --- | --- |
| 1 | Drop `image_assets.description` (0 rows) | None |
| 2 | Remove `headline` from staff captions UI; use event name + who-is-in-picture + caption | Low |
| 3 | Remove `headline` from public API DTO and Typesense stored fields | Medium — verify no external consumers |
| 4 | Optional data migration: copy unique headline into `caption` **only where caption IS NULL** | Low |
| 5 | `ALTER TABLE image_assets DROP COLUMN headline` | Requires steps 2–4 + prod audit |

**Production gate query pack** (run on production branch before drop):

```sql
-- Re-run sections 5.2–5.4 on production
-- Confirm FOTOCORP uploads still have headline IS NULL
SELECT count(*) FROM image_assets WHERE source = 'FOTOCORP' AND headline IS NOT NULL AND btrim(headline) <> '';
```

---

## 6. Question 3: Access and download logs

### 6.1 Naming clarification

| User term | Actual table name |
| --- | --- |
| “asset_access_logs” | **`asset_media_access_logs`** |
| Clean replacement | **`image_access_logs`** |
| Legacy download logs | **`asset_download_logs`** |
| Clean download logs | **`image_download_logs`** |

Design doc: [`docs/db-revamp/reports/image-log-normalization-report.md`](./image-log-normalization-report.md)

### 6.2 Row counts

See section 3.1. Summary:

| Table | Rows | FK targets |
| --- | ---: | --- |
| `asset_media_access_logs` | 9,920 | `assets.id`, `asset_media_derivatives.id` |
| `image_access_logs` | 6,018 | `image_assets.id`, `image_derivatives.id` |
| `asset_download_logs` | 0 | `assets.id` |
| `image_download_logs` | 4 | `image_assets.id` |

### 6.3 `image_access_logs` source (Development)

```sql
SELECT source, count(*)::bigint AS rows,
       min(created_at) AS min_at, max(created_at) AS max_at
FROM image_access_logs
GROUP BY source
ORDER BY rows DESC;
```

**Output:**

| source | rows | min_at | max_at |
| --- | ---: | --- | --- |
| APPLICATION | 6,018 | 2026-05-13T18:37:30Z | 2026-05-19T09:11:34Z |

All Development clean access logs are **application-written** (post cutover).

### 6.4 Legacy access log outcomes

```sql
SELECT outcome, count(*)::bigint AS rows
FROM asset_media_access_logs
GROUP BY outcome
ORDER BY rows DESC;
```

**Output:**

| outcome | rows |
| --- | ---: |
| SERVED | 9,514 |
| R2_ERROR | 225 |
| INVALID_TOKEN | 167 |
| PREVIEW_NOT_READY | 14 |

### 6.5 ID preservation check (Development)

Migration design intended `image_access_logs.id = asset_media_access_logs.id`.

```sql
SELECT
  count(*)::bigint AS old_logs,
  count(*) FILTER (
    WHERE EXISTS (SELECT 1 FROM image_access_logs n WHERE n.id = o.id)
  ) AS also_in_new
FROM asset_media_access_logs o;
```

**Development output:**

| old_logs | also_in_new |
| ---: | ---: |
| 9,920 | 0 |

**Interpretation:** Development branch does **not** currently have UUID-aligned log copies. Possible causes:

- Logs truncated/rebuilt after migration during dev testing
- Only new APPLICATION preview traffic wrote to `image_access_logs`
- Production may differ — **must run same query on production before dropping legacy logs**

### 6.6 Runtime write paths (code)

| Operation | Table | File |
| --- | --- | --- |
| Preview / secure media access | `image_access_logs` | `apps/api/src/routes/secureMedia.ts` |
| Subscriber download start/complete/fail | `image_download_logs` | `apps/api/src/routes/internal/downloads/service.ts` |
| Event purge cleanup | deletes from clean log tables | `apps/api/src/lib/events/admin-events.ts` |
| Legacy log insert | **None in `apps/api/src`** | — |

Smoke test documents expected behavior:

```txt
apps/api/scripts/smoke/check-clean-runtime-routes.ts
- Only image_access_logs should increase on preview
- Only image_download_logs should increase on download
```

### 6.7 Download logs (Development)

```sql
SELECT source, download_status, count(*)::bigint AS rows
FROM image_download_logs
GROUP BY source, download_status;
```

**Output:**

| source | download_status | rows |
| --- | --- | ---: |
| APPLICATION | COMPLETED | 4 |

### 6.8 Recommendation: logs

| Table | Verdict |
| --- | --- |
| `image_access_logs` | **Keep** — sole runtime write target for preview audit |
| `image_download_logs` | **Keep** — sole runtime write target for download audit |
| `asset_media_access_logs` | **Archive → drop** after production UUID audit + export |
| `asset_download_logs` | **Drop** — empty on Development; superseded |

---

## 7. Other duplication and schema debt

### 7.1 Events: `asset_events` vs `photo_events`

```sql
SELECT count(*)::bigint AS asset_events_only
FROM asset_events ae
WHERE NOT EXISTS (SELECT 1 FROM photo_events pe WHERE pe.id = ae.id)
UNION ALL
SELECT count(*)
FROM photo_events pe
WHERE NOT EXISTS (SELECT 1 FROM asset_events ae WHERE ae.id = pe.id);
```

**Output:**

| count | meaning |
| ---: | --- |
| 0 | Every `asset_events` row has matching `photo_events` UUID |
| 1 | One contributor-created event in `photo_events` only |

Runtime uses **`photo_events` exclusively**.

### 7.2 Photographers: `photographer_profiles` vs `contributors`

```sql
SELECT
  count(*)::bigint AS pp_total,
  count(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM contributors c
      WHERE c.legacy_photographer_id = pp.legacy_photographer_id
    )
  ) AS mapped_to_contributors
FROM photographer_profiles pp;
```

**Development output:**

| pp_total | mapped_to_contributors |
| ---: | ---: |
| 1,592 | 0 |

```sql
SELECT count(*)::bigint FROM contributors WHERE legacy_photographer_id IS NOT NULL;
-- Output: 786
```

Legacy `photographer_profiles` is **orphaned from runtime joins** on Development (clean `contributors` table is authoritative with 786 rows).

### 7.3 Derivatives: stale legacy subset

```sql
SELECT variant, generation_status, count(*)::bigint AS rows
FROM image_derivatives
GROUP BY variant, generation_status
ORDER BY variant, generation_status;
```

**Output (excerpt):**

| variant | generation_status | rows |
| --- | --- | ---: |
| CARD | READY | 732,754 |
| DETAIL | READY | 732,754 |
| THUMB | READY | 732,754 |
| CARD/DETAIL/THUMB | FAILED | 188 each |

`asset_media_derivatives` has only **29,427** rows vs **763,737** on `image_derivatives` — legacy table is not kept in sync with regeneration.

```sql
SELECT
  count(*)::bigint AS old_derivs,
  count(*) FILTER (
    WHERE EXISTS (SELECT 1 FROM image_derivatives d WHERE d.id = amd.id)
  ) AS id_preserved
FROM asset_media_derivatives amd;
-- Output: old_derivs=29427, id_preserved=29394
```

### 7.4 `asset_categories` — NOT deprecated

Despite the `asset_` prefix, **`asset_categories` is canonical** for category names. Used by:

- `public-assets.ts`, `photo_events.category_id`, contributor event creation, Typesense facets, staff catalog

**Do not drop** without a rename/migration plan (`categories`).

### 7.5 Fotobox FK debt

Schema: `apps/api/src/db/schema/fotobox.ts`

```typescript
assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" })
```

Runtime query in `fotobox/service.ts` joins **`image_assets`**. Works because UUIDs match; FK still points at legacy table.

**Fix:** migration to re-point FK → `image_assets.id`.

### 7.6 Manual backup table

| Table | Rows | Recommendation |
| --- | ---: | --- |
| `image_assets_duplicate_backup_20260518` | 2,200 | Drop after confirming one-off backup no longer needed |

---

## 8. Phased deprecation plan

### Phase 0 — Documentation and product alignment (no DDL)

- [ ] Adopt canonical field glossary in `context/architecture.md`:
  - Event title → `photo_events.name`
  - People → `who_is_in_picture`
  - Editorial body → `caption`
  - Deprecate `headline` in product language
- [ ] Remove `headline` from staff captions editor label (“Title (Headline)” → align with who-is-in-picture / caption)
- [ ] Remove `headline` from public API responses (or mark deprecated in OpenAPI/internal docs)

### Phase 1 — Low-risk column drops

| DDL | Validation |
| --- | --- |
| `ALTER TABLE image_assets DROP COLUMN description` | `SELECT count(*) … WHERE description IS NOT NULL` → 0 |
| Stop emitting `headline` in Typesense documents | Reindex smoke test |

**Migration file:** `apps/api/drizzle/00xx_drop_image_assets_description.sql`

### Phase 2 — Headline retirement

1. Run section 5 query pack on **production** branch.
2. Optional merge:

```sql
-- Preview only: copy headline into empty captions
SELECT count(*) FROM image_assets
WHERE caption IS NULL AND headline IS NOT NULL AND btrim(headline) <> '';

-- If approved:
-- UPDATE image_assets SET caption = headline, updated_at = now()
-- WHERE caption IS NULL AND headline IS NOT NULL AND btrim(headline) <> '';
```

3. Remove `headline` from admin PATCH validators and staff UI.
4. Drop column + remove from Drizzle schema.

### Phase 3 — FK fixes (no legacy table drop yet)

- [ ] `asset_fotobox_items.asset_id` → FK `image_assets(id)`
- [ ] Audit other FKs referencing `assets` / `asset_events` / `photographer_profiles`

### Phase 4 — Legacy table archive and drop

**Prerequisites:**

- Legacy import pipeline retired or run-only on demand with documented restore path
- `pnpm --dir apps/api db:validate:image-assets` passes
- Production log UUID audit completed

| Drop order (suggested) | Depends on |
| --- | --- |
| `image_assets_duplicate_backup_20260518` | Operator sign-off |
| `asset_download_logs` | Empty + no FKs from runtime |
| `asset_media_access_logs` | Export + prod UUID check |
| `asset_media_derivatives` | `image_derivatives` complete |
| `assets` | Import retired |
| `asset_events` | `photo_events` complete |
| `photographer_profiles` | `contributors` complete |
| `asset_import_issues`, `asset_import_batches` | Import retired |

**Estimated storage recovery (Development-scale):** ~2 GB from `assets` alone.

### Phase 5 — Naming cleanup (optional)

| Current | Proposed |
| --- | --- |
| `asset_categories` | `categories` |
| `asset_fotobox_items` | `image_fotobox_items` |

---

## 9. Validation commands (existing)

After any schema change, run:

```bash
pnpm --dir apps/api db:validate:image-assets
pnpm --dir apps/api db:validate:image-derivatives
pnpm --dir apps/api db:validate:image-logs
pnpm --dir apps/api db:validate:photographers
pnpm --dir apps/api db:validate:clean-schema-sync
```

See [`docs/db-revamp/validation-runbook.md`](../validation-runbook.md).

---

## 10. Production follow-up checklist

Before executing drops on production:

- [ ] Re-run all SQL in sections 3.1, 4.2, 5.2–5.4, 6.3, 6.5 on branch `br-orange-waterfall-aoebaozo` (production)
- [ ] Compare `asset_media_access_logs` vs `image_access_logs` ID overlap on production
- [ ] Confirm no cron/job still calls `legacy:sync-clean-schema`
- [ ] Export `asset_media_access_logs` to cold storage if audit retention required
- [ ] Schedule Typesense reindex if `headline` field removed from documents

---

## 11. Related documents

| Document | Relevance |
| --- | --- |
| [`legacy-to-clean-schema-map.md`](../legacy-to-clean-schema-map.md) | Official table mapping |
| [`image-log-normalization-report.md`](./image-log-normalization-report.md) | Log migration PR-04 |
| [`image-asset-normalization-report.md`](./image-asset-normalization-report.md) | PR-02 clean assets |
| [`runtime-clean-schema-switch-report.md`](./runtime-clean-schema-switch-report.md) | PR-05 runtime cutover |
| [`clean-schema-import-sync-report.md`](./clean-schema-import-sync-report.md) | Sync pipeline |

---

## 12. Summary table

| Item | Status today | Recommendation |
| --- | --- | --- |
| `assets` | Import-only; ~735k rows; ~2 GB | Archive → drop after import retired |
| `image_assets` | Production catalog | **Keep** |
| `asset_events` | Legacy mirror of events | Drop after `photo_events` confirmed |
| `photo_events` | Production events | **Keep** |
| `photographer_profiles` | Legacy; 1,592 rows | Drop after `contributors` confirmed |
| `contributors` | Production photographers | **Keep** |
| `asset_media_derivatives` | Stale subset (29k) | Drop |
| `image_derivatives` | Production previews | **Keep** |
| `asset_media_access_logs` | Frozen legacy logs | Export → drop |
| `image_access_logs` | Runtime preview audit | **Keep** |
| `asset_download_logs` | Empty | Drop |
| `image_download_logs` | Runtime download audit | **Keep** |
| `image_assets.headline` | 91.7% redundant | Deprecate → drop |
| `image_assets.description` | 0 rows | **Drop now** |
| `asset_categories` | Canonical categories | **Keep** (consider rename) |
| `asset_fotobox_items` FK | Points to `assets` | Re-point to `image_assets` |

---

*Report generated from Development branch SQL audit + codebase scan. Production branch must be audited separately before any destructive migration.*
