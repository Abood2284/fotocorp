# PR-16H — Public asset detail: Fotokey + category diagnostic

**Date:** 2026-05-13  
**Scope:** Read-only audit (Neon SQL + code inspection). No migrations, no production data changes, no behavioral fixes in this document.

## 1. Summary of issue

Published contributor assets show **Fotokey** as a staging-style value (`PHUPLOAD-*`) on the public marketing asset detail page, while jobs logs show final **`FC…`** Fotokeys. **Category** shows **Unavailable** in the sidebar metadata even though the linked event has a category in the database.

Evidence on **Neon project `Fotocorp`**, branch **`Development`** (`br-steep-sun-ao0nw2cc`) shows:

- `image_assets.fotokey` is already the final **`FC130526031`** (etc.).
- `PHUPLOAD-6456E300E6D7` lives only in **`legacy_image_code`**, not in `fotokey`.
- The public catalog API maps the JSON field `fotokey` from **`legacy_image_code`**, not from `image_assets.fotokey` → UI displays the wrong column under the label “Fotokey”.
- `image_assets.category_id` is **null** for the affected rows; **`photo_events.category_id`** is set (**Art & Culture**). The public detail query joins category **only** via `a.category_id`, so the API returns `category: null` → UI shows “Unavailable”.

**Root cause classification**

| Symptom | Classification |
|--------|----------------|
| Wrong Fotokey on public page | **API mapping bug** (DTO uses `legacy_image_code` as `fotokey`). Not a failed publish write. |
| Category unavailable | **Missing asset `category_id` + no event-category fallback in public API** (data gap on asset; event has category). |

The publish pipeline and job `a1ffa40c-924e-48b9-bf6c-f8765fe79b13` are **consistent**: job items and `image_assets.fotokey` match `FC…`.

---

## 2. Neon environment

| Item | Value |
|------|--------|
| Project | `tiny-thunder-19900347` (Fotocorp) |
| Branch | **Development** — `br-steep-sun-ao0nw2cc` |
| MCP | Read-only SQL (no writes) |

Production branch (`br-orange-waterfall-aoebaozo`) was **not** queried for this report unless you repeat the same SQL there for parity.

---

## 3. SQL executed (exact)

### Step 1a — Columns for named tables

```sql
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'image_assets',
    'image_publish_jobs',
    'image_publish_job_items',
    'image_derivatives',
    'photo_events',
    'categories',
    'asset_categories',
    'contributors',
    'contributor_upload_batches',
    'contributor_upload_items'
  )
order by table_name, ordinal_position;
```

**Note:** There is no `public.categories` table in this schema; editorial categories are **`asset_categories`**.

### Step 1b — Category-related columns

```sql
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and (
    table_name ilike '%categor%'
    or column_name ilike '%category%'
  )
order by table_name, ordinal_position;
```

### Step 2 — Locate asset by visible bad token (adjusted column name)

Requested query used `original_filename`; actual column is **`original_file_name`**.

```sql
select
  id,
  fotokey,
  legacy_image_code,
  title,
  headline,
  caption,
  status,
  visibility,
  source,
  media_type,
  event_id,
  category_id,
  contributor_id,
  original_storage_key,
  original_file_name,
  created_at,
  updated_at
from image_assets
where
  fotokey = 'PHUPLOAD-6456E300E6D7'
  or legacy_image_code = 'PHUPLOAD-6456E300E6D7'
  or original_storage_key ilike '%6456E300E6D7%'
  or original_file_name ilike '%6456E300E6D7%'
order by updated_at desc;
```

### Step 3a — Count `PHUPLOAD-*` in canonical `fotokey`

```sql
select count(*)::int as phupload_fotokey_count
from image_assets
where fotokey ilike 'PHUPLOAD-%';
```

### Step 3b — Sample rows where `fotokey` looks like PHUPLOAD

```sql
select
  id,
  fotokey,
  legacy_image_code,
  title,
  status,
  visibility,
  source,
  media_type,
  event_id,
  category_id,
  contributor_id,
  original_storage_key,
  original_file_name,
  created_at,
  updated_at
from image_assets
where fotokey ilike 'PHUPLOAD-%'
order by updated_at desc
limit 20;
```

### Step 3c — Count rows retaining PHUPLOAD in `legacy_image_code`

```sql
select count(*)::int as cnt
from image_assets
where legacy_image_code ilike 'PHUPLOAD-%';
```

### Step 4 — Completed publish job + assets

```sql
select
  j.id as job_id,
  j.status as job_status,
  j.total_items,
  j.completed_items,
  j.failed_items,
  j.started_at,
  j.completed_at,
  ji.id as item_id,
  ji.status as item_status,
  ji.image_asset_id,
  a.fotokey as asset_fotokey,
  a.legacy_image_code,
  a.status as asset_status,
  a.visibility as asset_visibility,
  a.original_storage_key,
  a.original_file_name,
  a.category_id,
  a.event_id,
  a.updated_at,
  ji.fotokey as item_fotokey
from image_publish_jobs j
join image_publish_job_items ji on ji.job_id = j.id
join image_assets a on a.id = ji.image_asset_id
where j.id = 'a1ffa40c-924e-48b9-bf6c-f8765fe79b13'
order by coalesce(a.fotokey, a.legacy_image_code, a.id::text) asc;
```

### Step 7 follow-up — Event category for affected event

```sql
select id, name, category_id, created_by_source
from photo_events
where id = 'd32c4ef7-e0a0-4f96-9229-f4d99947aec4';
```

```sql
select id, name
from asset_categories
where id = 'd4f53ba5-7311-4999-a8cb-2a8b003e3002';
```

---

## 4. Query result summaries

### Step 1 — Schema

- **`image_assets`** includes both **`fotokey`** and **`legacy_image_code`**, plus **`category_id`** FK to **`asset_categories`**.
- **`photo_events`** includes **`category_id`** (FK to `asset_categories`).
- No `public.categories` table.

### Step 2 — Asset matching `PHUPLOAD-6456E300E6D7`

One row (example **id** `e1232392-cb8b-4307-87d3-add4908332f9`):

| Field | Value |
|-------|--------|
| `fotokey` | **`FC130526031`** |
| `legacy_image_code` | **`PHUPLOAD-6456E300E6D7`** |
| `status` / `visibility` | `ACTIVE` / `PUBLIC` |
| `category_id` | **null** |
| `event_id` | `d32c4ef7-e0a0-4f96-9229-f4d99947aec4` |
| `original_storage_key` | `FC130526031.png` |

**Conclusion:** `PHUPLOAD-*` is **not** stored in `image_assets.fotokey` for this row; it remains in **`legacy_image_code`**.

### Step 3

- **`phupload_fotokey_count`:** `0` — no canonical `fotokey` values start with `PHUPLOAD-` on Development.
- **`fotokey ilike 'PHUPLOAD-%'` sample:** empty.
- **`legacy_image_code ilike 'PHUPLOAD-%'`:** **10** rows (staging codes retained after publish).

### Step 4 — Job `a1ffa40c-924e-48b9-bf6c-f8765fe79b13`

- **`job_status`:** `COMPLETED`
- **`total_items` / `completed_items` / `failed_items`:** `10` / `10` / `0`
- Each sampled item: **`item_status`:** `COMPLETED`
- For each row: **`asset_fotokey`** = **`item_fotokey`** = `FC13052603x`, **`asset_status`** `ACTIVE`, **`asset_visibility`** `PUBLIC`
- **`legacy_image_code`** still `PHUPLOAD-…` on those assets
- **`category_id`** on assets: **null** for all shown job rows

### Step 7 — Category

- Event `d32c4ef7-e0a0-4f96-9229-f4d99947aec4`: **`category_id`** = `d4f53ba5-7311-4999-a8cb-2a8b003e3002`, **`created_by_source`** = `CONTRIBUTOR`
- That category: **`Art & Culture`**

---

## 5. Public API and frontend mapping

### Endpoint

- **GET** ` /api/v1/assets/:assetId` — `apps/api/src/routes/public/catalog-routes.ts` → `getPublicAssetDetail` in `apps/api/src/lib/assets/public-assets.ts`.

### Web page

- **`apps/web/src/app/(marketing)/assets/[id]/page.tsx`** loads **`getPublicAsset(id)`** from `apps/web/src/lib/api/fotocorp-api.ts` → same-origin or configured API **`/api/v1/assets/{id}`**.

### DB query (high level)

- `buildDetailSql` uses `selectAssetSql` + `fromAssetSql()` with `publicAssetPredicate("a")` and `a.id = :assetId`.
- Select list includes **`a.legacy_image_code as legacy_imagecode`** but **does not select `a.fotokey`**.
- Category: **`left join asset_categories c on c.id = a.category_id`** only (no join to event’s category).

### DTO mapping (critical)

In `toAssetDto`:

```ts
fotokey: row.legacy_imagecode,
```

So the JSON property **`fotokey`** is **`legacy_image_code`**, not **`image_assets.fotokey`**.

### Frontend

- **Hero Fotokey:** `asset.fotokey` — correct *if* the API sent canonical Fotokey; currently it receives legacy code.
- **Details / Identification:** `getMetadataGroups` only adds Fotokey row when `asset.fotokey` is truthy — so it shows the same wrong value.
- **Sidebar “Category”:** `getActionMetadataRows` → `asset.category?.name ?? "Unavailable"` — matches null API category.

**Verdict:** Frontend uses **`asset.fotokey`** consistently; the bug is **what the API puts in that field**, not a separate mislabeled field in TSX.

---

## 6. Answers to acceptance checklist

| Question | Answer |
|----------|--------|
| Does `PHUPLOAD-*` exist in `image_assets.fotokey`? | **No** for the investigated row on Development (`fotokey` = `FC…`). |
| Do final `FC…` Fotokeys exist for the completed job? | **Yes**; job items and assets align. |
| Is asset detail using the correct DB column for “Fotokey”? | **No** — API exposes `legacy_image_code` as JSON `fotokey`. |
| Why is category unavailable? | **`image_assets.category_id` is null**; API does not fall back to **`photo_events.category_id`** (which is set → **Art & Culture**). |

---

## 7. Recommended fix plan (not implemented here)

### Fotokey (code, low data risk)

1. In **`public-assets.ts`** `selectAssetSql`, add **`a.fotokey`** (e.g. `a.fotokey as fotokey` or distinct alias).
2. Extend **`AssetRow`** with canonical fotokey.
3. In **`toAssetDto`**, set **`fotokey`** to the **canonical** `image_assets.fotokey` (or `null` when absent).
4. Decide what to expose **`legacy_image_code`** as (if at all): e.g. omit from public DTO, or a separate internal-only/admin field **`legacyImageCode`** — avoid reusing the label “Fotokey” for non-canonical codes.
5. Regression: search/list paths use the same `toAssetDto` — fix once in shared mapping.
6. Optional UX: if canonical `fotokey` is null for a public asset, show **“Pending Fotokey”** vs **“Unavailable”** by status (product decision).

**Data repair:** Not required for this symptom — DB already has correct `fotokey`.

### Category (code and/or ingest)

1. **Display rule (proposed):** resolved category = **asset category** else **event category** else unavailable — requires SQL join, e.g. `left join asset_categories ec on ec.id = e.category_id` and coalesce name/id in DTO, or resolve in application layer.
2. **Data/backfill (optional):** On approve/publish or batch creation, set **`image_assets.category_id`** from event (or from contributor batch metadata) so filters that rely on `a.category_id` stay consistent.

**Data repair:** Optional; event already carries category. Fixing API fallback may be enough for display; backfill improves search/filter consistency.

### Safety

- Changing only **read DTO mapping** is safe if clients treat `fotokey` as canonical (intended).
- If any external consumer relied on JSON `fotokey` == legacy image code, that would be a **breaking semantic change** — grep integrations and mobile clients before release.
- Do not clear `legacy_image_code` without understanding audit/debug needs.

---

## 8. Files inspected

| Path | Role |
|------|------|
| `apps/api/src/lib/assets/public-assets.ts` | Public list/detail SQL + `toAssetDto` (`fotokey` ← `legacy_imagecode`) |
| `apps/api/src/routes/public/catalog-routes.ts` | GET `/api/v1/assets/:assetId` |
| `apps/web/src/lib/api/fotocorp-api.ts` | `getPublicAsset` |
| `apps/web/src/app/(marketing)/assets/[id]/page.tsx` | Fotokey + category display |
| `apps/web/src/features/assets/types.ts` | `PublicAsset` shape |
| `apps/api/src/db/schema/image-assets.ts` | Column definitions (`fotokey`, `legacyImageCode`, …) |
| `apps/jobs/src/services/imagePublishProcessor.ts` | Publish gate checks `image_assets.fotokey` vs job item (pipeline assumes canonical column) |

---

## 9. Whether data repair / code repair is required

| Type | Required? |
|------|-----------|
| **Data repair** (Fotokey) | **No** — canonical `fotokey` already correct. |
| **Code repair** (Fotokey) | **Yes** — public DTO must map canonical `image_assets.fotokey`. |
| **Data repair** (category) | **Optional** — populate `image_assets.category_id` from event/batch for consistency with filters. |
| **Code repair** (category) | **Yes** for expected UX — event category fallback in public SQL/DTO **or** backfill `category_id` on assets. |

---

## 10. Relation to “your bet”

- **Fotokey:** The issue matches **API mapping** (and naming): UI shows **`legacy_image_code`** via the **`fotokey`** JSON field, not a separate wrong TSX property.
- **Publish pipeline:** Ruled out as the cause of wrong **stored** Fotokey; pipeline wrote **`FC…`** correctly.

---

## 11. Next steps (outside this PR)

1. Implement API DTO fix + tests (unit or contract) asserting public `fotokey` === `image_assets.fotokey` for contributor-published fixtures.
2. Implement category resolution (join or backfill) per product preference.
3. Re-run the Step 2–4 SQL on **production** branch if you need environment parity confirmation (read-only).
