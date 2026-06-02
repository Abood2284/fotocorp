# One-time DB scripts

Scripts listed here are **run once per environment**, then **removed from the repo**.  
Do not add long-lived business logic here — use Drizzle migrations or permanent `db:validate:*` scripts instead.

**Workflow**

1. Run `--dry-run` on the target Neon branch (Development first, then Production).
2. Run the real command and capture the final log line.
3. Run the listed verification command(s).
4. Delete the script file, remove its `package.json` script, and mark the row **DONE** below (or remove the row).

---

## Active

| Script | npm command | Purpose | Delete after |
| --- | --- | --- | --- |
| `backfill-legacy-fotokeys.ts` | `pnpm --dir apps/api db:backfill:legacy-fotokeys` | Copy `legacy_image_code` → `fotokey` (+ `fotokey_date`, `fotokey_sequence`, `fotokey_assigned_at`) for `FC…` codes; sync `fotokey_daily_counters` | Backfill + `db:validate:fotokey-publish` pass on **every** env you care about |
| `backfill-photo-events-category-id.ts` | `pnpm --dir apps/api db:backfill:photo-events-category-id` | Set `photo_events.category_id` from dominant public `image_assets.category_id` | Backfill verified on **every** env you care about; re-run investigation browse counts |
| `backfill-image-assets-category-gaps.ts` | `pnpm --dir apps/api db:backfill:image-assets-category-gaps` | Copy event category to null asset rows; assign public ACTIVE uncategorized assets to **More** | Backfill verified on **every** env you care about |
| `merge-asset-categories.ts` | `pnpm --dir apps/api db:merge:asset-categories` | Merge ShowBiz → Entertainment, Politics → News; delete source categories | Verified on **every** env; reindex Typesense after |
| `rename-travel-category-to-royalty-free.ts` | `pnpm --dir apps/api db:rename:travel-to-royalty-free` | Rename **Travel** category to **Royalty Free** | Verified on **every** env |

### `backfill-photo-events-category-id.ts` — how to run

**Requires:** `DATABASE_URL` in `apps/api/.dev.vars` pointing at the intended Neon branch.

```bash
# 1) Preview counts (no writes)
pnpm --dir apps/api db:backfill:photo-events-category-id -- --dry-run

# 2) Apply
pnpm --dir apps/api db:backfill:photo-events-category-id
```

**Behavior**

- Considers only `image_assets` with `event_id`, `category_id`, `status = 'ACTIVE'`, `visibility = 'PUBLIC'`.
- Picks dominant category per event by asset count, then lowest `asset_categories.legacy_category_code`.
- Updates only rows where `photo_events.category_id IS NULL`.
- Does not touch `public_event_feed_items`, Latest, browse routes, or schema.

### `backfill-legacy-fotokeys.ts` — how to run

**Requires:** `DATABASE_URL` in `apps/api/.dev.vars` (or exported) pointing at the branch you intend to mutate.

```bash
# 1) Preview counts (no writes)
pnpm --dir apps/api db:backfill:legacy-fotokeys -- --dry-run

# 2) Apply (~678k rows on Development; batch size 500; expect long runtime)
pnpm --dir apps/api db:backfill:legacy-fotokeys

# 3) Verify
pnpm --dir apps/api db:validate:fotokey-publish
```

**Behavior**

- Only rows with `fotokey IS NULL` and parseable `FC` + 8+ digit `legacy_image_code`.
- One winner per duplicate `legacy_image_code` (prefers `ACTIVE` + `PUBLIC`, then oldest `created_at`).
- Skips codes that already exist on another row’s `fotokey`.
- Sets `fotokey_assigned_at` from `uploaded_at` → `image_date` → `created_at`.

**Teardown (after all environments)**

```bash
rm apps/api/scripts/db/backfill-legacy-fotokeys.ts
# Remove "db:backfill:legacy-fotokeys" from apps/api/package.json
# Move the table row below to DONE and remove it, or delete this section
```

**Keep (not one-time):** `src/lib/fotokey/parse-legacy-fotokey-code.ts` — shared parser; do not delete with the script.

---

## Done

| Script | Completed | Notes |
| --- | --- | --- |
| Auth revamp P1–P9 one-time scripts (`apply-*`, `validate-*`, `sync-*`, `seed-*`, etc.) | 2026-06-01 (Development) | Removed from repo after Dev cutover; use Drizzle migrations `0039`–`0044` + [`auth-identity-revamp-migration-spec.md`](../../../docs/db-revamp/auth-identity-revamp-migration-spec.md) for history |
| `apply-contributor-migration-merges.ts` | 2026-06-01 (Development) | P1 manifest merges applied |
