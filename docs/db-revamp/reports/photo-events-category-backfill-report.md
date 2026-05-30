# photo_events.category_id Backfill Report

Date: 2026-05-30  
Environment: Neon **Development** branch (via `apps/api/.dev.vars` `DATABASE_URL`)  
Script: `apps/api/scripts/db/backfill-photo-events-category-id.ts`  
Command: `pnpm --dir apps/api db:backfill:photo-events-category-id`

---

## 1. Why the backfill was needed

Investigation (`docs/db-revamp/reports/homepage-category-source-investigation.md`) showed:

- Homepage category browse filters through `photo_events.category_id → asset_categories.name`.
- Only **1 / 50,001** events had `category_id` set before backfill (contributor event “Song launch of film Cocktail 2”).
- Legacy import populated category on **`image_assets.category_id`**, not on `photo_events`.
- Category tabs (News, Sports, Entertainment, Retro) returned empty because the event-level join had no data.

This backfill copies the **dominant public asset category** onto each event so the existing browse SQL can filter truthfully without schema or endpoint changes.

---

## 2. Dry-run counts

Run: `pnpm --dir apps/api db:backfill:photo-events-category-id -- --dry-run`

| Metric | Count |
|--------|------:|
| Total `photo_events` | 50,001 |
| Events with `category_id IS NULL` | 50,000 |
| Events eligible for backfill (≥1 qualifying public asset category) | 49,107 |
| Events that would be updated | 49,106 |
| Events with multiple candidate categories | 10,713 |
| Existing non-null categories preserved | 1 |

**894 events** remain without `category_id` after backfill (no qualifying public `image_assets` with a category).

---

## 3. SQL / script used

Policy:

1. Consider `image_assets` where `event_id`, `category_id`, `status = 'ACTIVE'`, `visibility = 'PUBLIC'`.
2. Group by `(event_id, category_id)`.
3. Rank by asset count DESC, then `asset_categories.legacy_category_code` ASC.
4. Update `photo_events.category_id` for rank = 1 only where `photo_events.category_id IS NULL`.
5. Set `photo_events.updated_at = now()`.

Core update (also embedded in script):

```sql
WITH ranked AS (
  SELECT
    ia.event_id,
    ia.category_id,
    COUNT(*)::int AS asset_count,
    ROW_NUMBER() OVER (
      PARTITION BY ia.event_id
      ORDER BY COUNT(*) DESC, MIN(ac.legacy_category_code) ASC NULLS LAST
    ) AS rn
  FROM image_assets ia
  JOIN asset_categories ac ON ac.id = ia.category_id
  WHERE ia.event_id IS NOT NULL
    AND ia.category_id IS NOT NULL
    AND ia.status = 'ACTIVE'
    AND ia.visibility = 'PUBLIC'
  GROUP BY ia.event_id, ia.category_id
)
UPDATE photo_events pe
SET
  category_id = ranked.category_id,
  updated_at = now()
FROM ranked
WHERE ranked.event_id = pe.id
  AND ranked.rn = 1
  AND pe.category_id IS NULL;
```

---

## 4. Mixed-category events

| Metric | Value |
|--------|------:|
| Events with assets in **more than one** category (eligible assets) | 10,713 |

Dominant-category policy applied; backfill was **not blocked**.

### Sample mixed events (20)

| Event | Selected category | Other categories (asset counts) |
|-------|-------------------|----------------------------------|
| BJP leaders addresses pr | News (8) | Politics (2) |
| Deenanath Mangeshkar award 2014 | ShowBiz & LifeStyle (14) | Entertainment (2) |
| Divya Khosla Kumar hosts special screening… | Entertainment (24) | People (4) |
| Gavin Miguel at BPFT 2013 | Fashion (20) | ShowBiz & LifeStyle (4) |
| Inauguration of Aadirang Mahotsav 2016 | Art & Culture (48) | News (6), People (2), Politics (1), ShowBiz (1) |
| Inauguration of Festival of Gold | ShowBiz & LifeStyle (3) | News (1) |
| Jyoti Basu passes away | News (7) | Politics (2) |
| Launch of Stealing Gods | ShowBiz & LifeStyle (3) | People (2) |
| Mayawati Public Rally in NSE Ground | Politics (7) | News (2) |
| Mudra Lifestyle Ltd. ann | Business (2) | People (2) |
| Narendra Kumar at LFW Winter/Festive 2010 | Fashion (11) | Entertainment (4) |
| Pond’s launches Special | Other (5) | Entertainment (4) |
| Prince Andrew visits Dhirubhai Ambani… | News (15) | People (1) |
| Promotion of the film “D | Entertainment (5) | ShowBiz & LifeStyle (4) |
| Sonakshi Sinha, Arbaaz Khan spotted at Juhu | ShowBiz & LifeStyle (7) | Entertainment (2) |
| Special screening of Doc | Entertainment (16) | Politics (2) |
| Titagarh Wagons listed o | Business (3) | People (1) |
| Unveiling of Women & Weight Loss Tamasha | Entertainment (9) | Art & Culture (1) |
| Winter Session at Parliament | News (27) | Politics (5) |
| Wrap up party of film Baar Baar Dekho | Entertainment (50) | Eating Out (1) |

Full JSON samples are emitted by the script under `mixed_category_samples`.

---

## 5. Rows updated

| | Count |
|---|------:|
| **Applied** | **49,106** |
| Preserved pre-existing `category_id` | 1 |
| Total with `category_id` after backfill | 49,107 |

Verified: “Song launch of film Cocktail 2” retained **Entertainment** (`source = Fotocorp`, contributor-created).

---

## 6. Post-backfill category distribution

```sql
SELECT c.name, c.legacy_category_code, COUNT(*) AS event_count
FROM photo_events e
JOIN asset_categories c ON c.id = e.category_id
GROUP BY c.name, c.legacy_category_code
ORDER BY event_count DESC;
```

| Category | Legacy code | Event count |
|----------|------------:|------------:|
| News | 1 | 13,012 |
| Entertainment | 5 | 10,655 |
| ShowBiz & LifeStyle | 7 | 7,911 |
| Business | 3 | 4,603 |
| Fashion | 6 | 3,417 |
| Politics | 2 | 2,380 |
| Sports | 4 | 2,228 |
| Art & Culture | 9 | 1,285 |
| Festival & Religion | 11 | 1,209 |
| Other | 31 | 1,166 |
| Retro | 37 | 548 |
| Eating Out | 34 | 312 |
| People | 8 | 199 |
| Still Life | 32 | 52 |
| Travel | 10 | 47 |
| South Actors | 36 | 42 |
| gallery | 35 | 36 |
| More | 33 | 5 |

---

## 7. Homepage section counts (post-backfill)

```sql
SELECT lower(c.name) AS section, COUNT(*) AS event_count
FROM photo_events e
JOIN asset_categories c ON c.id = e.category_id
WHERE lower(c.name) IN ('news', 'sports', 'entertainment', 'retro')
GROUP BY lower(c.name)
ORDER BY section;
```

| Section | Event count |
|---------|------------:|
| entertainment | 10,655 |
| news | 13,012 |
| retro | 548 |
| sports | 2,228 |

Note: browse still reads **`public_event_feed_items`**, which retains only ~30 days of public events. Category data is now populated on `photo_events`, but tab results remain feed-limited until projection backfill/reconcile is run separately.

---

## 8. Confirmations

| Constraint | Status |
|------------|--------|
| No schema changes | Confirmed |
| No new tables | Confirmed |
| Latest untouched | Confirmed |
| Homepage hero untouched | Confirmed |
| `/api/v1/assets` untouched | Confirmed |
| Category browse endpoint untouched | Confirmed |
| `public_event_feed_items` untouched | Confirmed |
| Existing non-null `photo_events.category_id` preserved | Confirmed (1 row) |

---

## 9. Next steps

1. Run the same script on **Production** Neon branch when ready (`--dry-run` first).
2. Run `public_event_feed_items` reconcile/backfill so category browse has events to return beyond the single current feed row on Development.
3. Re-verify `GET /api/v1/public/events/browse?section=news|sports|entertainment|retro` after feed projection is populated.
4. Delete `backfill-photo-events-category-id.ts` and npm script after all environments are done (see `scripts/db/ONE_TIME_SCRIPTS.md`).
