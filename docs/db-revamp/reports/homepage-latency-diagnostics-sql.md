# Homepage Latest Events — SQL diagnostics

Run against the production-like database used by the API Worker. Replace `30` / `16` if you are testing other `windowDays` / page sizes.

## 1. Candidate events only

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT
  e.id,
  e.name,
  e.event_date,
  e.created_at
FROM photo_events e
WHERE e.status = 'ACTIVE'
  AND e.created_at >= (current_timestamp - (30::int * interval '1 day'))
ORDER BY e.created_at DESC, e.id DESC
LIMIT 16;
```

## 2. Candidate events with public assets

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT
  e.id,
  e.name,
  e.event_date,
  e.created_at
FROM photo_events e
WHERE e.status = 'ACTIVE'
  AND e.created_at >= (current_timestamp - (30::int * interval '1 day'))
  AND EXISTS (
    SELECT 1
    FROM image_assets a
    JOIN image_derivatives card
      ON card.image_asset_id = a.id
      AND card.variant = 'CARD'
      AND card.generation_status = 'READY'
      AND card.is_watermarked = false
      AND card.watermark_profile = 'fotocorp-card-clean-v1'
    WHERE a.event_id = e.id
      AND a.status = 'ACTIVE'
      AND a.visibility = 'PUBLIC'
      AND a.media_type = 'IMAGE'
      AND a.original_exists_in_storage = true
  )
ORDER BY e.created_at DESC, e.id DESC
LIMIT 16;
```

## 3. Candidate events with ready card derivative (same predicate as feed)

Same as section 2; the EXISTS join is the card-derivative gate used by the API.

## 4. Full current latest-events query

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
WITH candidate_events AS (
  SELECT
    e.id,
    e.name,
    e.event_date,
    e.created_at
  FROM photo_events e
  WHERE e.status = 'ACTIVE'
    AND e.created_at >= (current_timestamp - (30::int * interval '1 day'))
    AND EXISTS (
      SELECT 1
      FROM image_assets a
      JOIN image_derivatives card
        ON card.image_asset_id = a.id
        AND card.variant = 'CARD'
        AND card.generation_status = 'READY'
        AND card.is_watermarked = false
        AND card.watermark_profile = 'fotocorp-card-clean-v1'
      WHERE a.event_id = e.id
        AND a.status = 'ACTIVE'
        AND a.visibility = 'PUBLIC'
        AND a.media_type = 'IMAGE'
        AND a.original_exists_in_storage = true
    )
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 16
),
event_counts AS (
  SELECT
    ce.id AS event_id,
    count(*)::int AS asset_count
  FROM candidate_events ce
  JOIN image_assets a ON a.event_id = ce.id
  JOIN image_derivatives card
    ON card.image_asset_id = a.id
    AND card.variant = 'CARD'
    AND card.generation_status = 'READY'
    AND card.is_watermarked = false
    AND card.watermark_profile = 'card_clean_v1'
  WHERE a.status = 'ACTIVE'
    AND a.visibility = 'PUBLIC'
    AND a.media_type = 'IMAGE'
    AND a.original_exists_in_storage = true
  GROUP BY ce.id
),
event_previews AS (
  SELECT DISTINCT ON (ce.id)
    ce.id AS event_id,
    a.id AS preview_asset_id,
    card.width AS preview_width,
    card.height AS preview_height
  FROM candidate_events ce
  JOIN image_assets a ON a.event_id = ce.id
  JOIN image_derivatives card
    ON card.image_asset_id = a.id
    AND card.variant = 'CARD'
    AND card.generation_status = 'READY'
    AND card.is_watermarked = false
    AND card.watermark_profile = 'card_clean_v1'
  WHERE a.status = 'ACTIVE'
    AND a.visibility = 'PUBLIC'
    AND a.media_type = 'IMAGE'
    AND a.original_exists_in_storage = true
  ORDER BY ce.id, coalesce(a.image_date, a.created_at) DESC, a.id DESC
)
SELECT
  ce.id,
  ce.name,
  ce.event_date,
  ce.created_at,
  ec.asset_count,
  ep.preview_asset_id,
  ep.preview_width,
  ep.preview_height
FROM candidate_events ce
JOIN event_counts ec ON ec.event_id = ce.id
JOIN event_previews ep ON ep.event_id = ce.id
ORDER BY ce.created_at DESC, ce.id DESC;
```

## 5. pg_stat_statements — latest-events callers

Requires `pg_stat_statements` enabled.

```sql
SELECT
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(max_exec_time::numeric, 2) AS max_ms,
  round(total_exec_time::numeric, 2) AS total_ms,
  rows,
  left(query, 200) AS query_prefix
FROM pg_stat_statements
WHERE query ILIKE '%photo_events%'
   OR query ILIKE '%candidate_events%'
   OR query ILIKE '%image_derivatives%card%'
ORDER BY mean_exec_time DESC
LIMIT 25;
```
