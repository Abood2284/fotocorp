# PR-16I — Asset category canonicalization + public Fotokey/detail mapping

## 1. Files changed

| Area | Path |
| --- | --- |
| Public catalog SQL + DTO | `apps/api/src/lib/assets/public-assets.ts` |
| Staff approve transaction | `apps/api/src/routes/internal/admin-contributor-uploads/service.ts` |
| Staff list/batch DTO + SQL | same |
| Publish completion (worker) | `apps/jobs/src/services/imagePublishJobService.ts` |
| Publish completion (API CLI) | `apps/api/scripts/media/process-image-publish-jobs.ts` |
| Staff web types | `apps/web/src/lib/api/staff-contributor-uploads-api.ts` |
| Staff review modal | `apps/web/src/components/staff/contributor-uploads/staff-contributor-batch-client.tsx` |
| Docs | `context/architecture.md`, `docs/db-revamp/README.md`, `docs/db-revamp/fotokey-publish-pipeline.md`, `docs/db-revamp/README.md` (reports table) |
| Tracker | `context/progress-tracker.md` |

## 2. Public Fotokey mapping

- **Before:** JSON `fotokey` was populated from `legacy_image_code` (could show `PHUPLOAD-*`).
- **After:** `selectAssetSql` selects `a.fotokey as fotokey`; `toAssetDto` sets `fotokey: row.fotokey` (canonical `FC…` only). `legacy_image_code` is not selected for public catalog rows.

## 3. Category fallback (public)

- SQL joins: `asset_categories ac` on `a.category_id`, `photo_events e`, `asset_categories ec` on `e.category_id`.
- `resolvePublicCategory(row)`: asset pair wins, else event pair, else `null`.
- **List filter `categoryId`:** matches `a.category_id` **or** `(a.category_id is null and e.category_id = :categoryId)` so search works before asset backfill.
- **Filters + collections:** facet membership uses `coalesce(a.category_id, ev.category_id)` (and lateral preview uses the same rule) so counts/previews align with resolved display.

## 4. Publish-time / approve category assignment

- **Staff approve** (`update image_assets` in transaction):  
  `category_id = coalesce(category_id, (select pe.category_id from photo_events pe where pe.id = image_assets.event_id limit 1))`  
  Never overwrites non-null `image_assets.category_id`.
- **Publish completion** (same expression): `apps/jobs` `completeSuccessfulPublishItem` and API `process-image-publish-jobs.ts` so assets that were approved before this PR still get asset `category_id` when going `ACTIVE`+`PUBLIC` if the event has a category.

## 5. Category / search audit (summary)

- **`rg`** highlights: contributor catalog/events use `asset_categories`; **admin** `admin-catalog.ts` still filters list by `a.category_id` only (staff catalog, not public marketing). No change required for this PR.
- **Public** paths touched: `public-assets.ts` (list, detail, count, filters, collections).

## 6. Commands run

```bash
pnpm --dir apps/api check
pnpm --dir apps/jobs check
pnpm --dir apps/api run smoke:hono-routes
pnpm --dir apps/web lint
pnpm --dir apps/web build
```

All completed successfully (web lint: pre-existing warnings only, exit 0).

## 7. Manual verification notes

- Open `/assets/{uuid}` for a contributor-published asset: **Fotokey** should show `FC…`; **Category** should show event default when asset category was null (or asset category when set).
- Staff batch review modal: **Asset category** and **Event default category** rows (from new list fields).
- **Neon SQL patch** (Development branch backfill for job `a1ffa40c-924e-48b9-bf6c-f8765fe79b13`) was **not** executed from this environment (Neon MCP read-only). Run manually on branch `br-steep-sun-ao0nw2cc` if you still want a one-off data fix; corrected SQL is in **§10** below.

## 8. Known limitations

- **Fotobox / downloads** internal DTOs still reference `legacy_image_code` for some filenames — out of scope for public marketing catalog; follow up if those surfaces should show canonical Fotokey.
- Assets with **no** event or **no** event category remain category-null until staff sets asset category elsewhere.

## 9. Next steps

- Run §10 SQL on Neon **Development** if you want historical rows from the cited job to have `image_assets.category_id` populated without re-publish.
- Optional: align **admin catalog** list filter with `coalesce` if staff search should mirror public behavior.

## 10. Appendix — Neon Development backfill (corrected `UPDATE`)

The original patch sketch used an invalid `UPDATE … FROM` shape. Use:

**Preview**

```sql
select
  a.id as asset_id,
  a.fotokey,
  a.category_id as current_asset_category_id,
  e.category_id as event_category_id,
  c.name as event_category_name
from image_publish_job_items ji
join image_assets a on a.id = ji.image_asset_id
join photo_events e on e.id = a.event_id
left join asset_categories c on c.id = e.category_id
where ji.job_id = 'a1ffa40c-924e-48b9-bf6c-f8765fe79b13'
order by a.fotokey asc;
```

**Update**

```sql
begin;

update image_assets a
set
  category_id = e.category_id,
  updated_at = now()
from image_publish_job_items ji
join photo_events e on e.id = a.event_id
where ji.image_asset_id = a.id
  and ji.job_id = 'a1ffa40c-924e-48b9-bf6c-f8765fe79b13'
  and a.category_id is null
  and e.category_id is not null;

commit;
```

**Sanity**

```sql
select count(*) as public_assets_with_placeholder_fotokey
from image_assets
where status = 'ACTIVE'
  and visibility = 'PUBLIC'
  and fotokey ilike 'PHUPLOAD-%';
```

Expected: `0` (canonical `fotokey` should never hold staging tokens).
