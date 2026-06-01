-- P0 read-only reports for contributor auth migration (Development / any branch).
-- Spec: docs/db-revamp/auth-identity-revamp-migration-spec.md
-- Run via Neon SQL editor or: psql "$DATABASE_URL" -f docs/db-revamp/manifests/contributor-migration-report.sql

-- 1) Asset-owner scope
SELECT
  COUNT(DISTINCT c.id)::int AS asset_owner_contributors,
  COUNT(ia.id)::bigint AS total_asset_fks
FROM contributors c
INNER JOIN image_assets ia ON ia.contributor_id = c.id;

-- 2) Placeholder email among asset owners (do NOT merge on email alone)
SELECT
  COUNT(*)::int AS asset_owners_with_placeholder_email
FROM contributors c
WHERE EXISTS (SELECT 1 FROM image_assets ia WHERE ia.contributor_id = c.id)
  AND lower(btrim(c.email)) = 'contact@fotocorp.com';

-- 3) Duplicate display names among asset owners
WITH asset_owners AS (
  SELECT DISTINCT contributor_id FROM image_assets WHERE contributor_id IS NOT NULL
),
owners AS (
  SELECT c.id, lower(btrim(c.display_name)) AS dn, c.display_name
  FROM contributors c
  WHERE c.id IN (SELECT contributor_id FROM asset_owners)
)
SELECT dn, COUNT(*)::int AS people, array_agg(display_name ORDER BY display_name) AS names
FROM owners
GROUP BY dn
HAVING COUNT(*) > 1
ORDER BY people DESC;

-- 4) Pre-approved manual merge pairs (verify asset counts)
SELECT
  loser.id AS loser_id,
  loser.legacy_photographer_id AS loser_legacy_id,
  loser.display_name AS loser_name,
  (SELECT COUNT(*) FROM image_assets WHERE contributor_id = loser.id) AS loser_assets,
  winner.id AS winner_id,
  winner.legacy_photographer_id AS winner_legacy_id,
  winner.display_name AS winner_name,
  (SELECT COUNT(*) FROM image_assets WHERE contributor_id = winner.id) AS winner_assets
FROM contributors loser
JOIN contributors winner ON winner.legacy_photographer_id = 36
WHERE loser.legacy_photographer_id = 2214
UNION ALL
SELECT
  loser.id, loser.legacy_photographer_id, loser.display_name,
  (SELECT COUNT(*) FROM image_assets WHERE contributor_id = loser.id),
  winner.id, winner.legacy_photographer_id, winner.display_name,
  (SELECT COUNT(*) FROM image_assets WHERE contributor_id = winner.id)
FROM contributors loser
JOIN contributors winner ON winner.legacy_photographer_id = 642
WHERE loser.legacy_photographer_id = 2218
UNION ALL
SELECT
  loser.id, loser.legacy_photographer_id, loser.display_name,
  (SELECT COUNT(*) FROM image_assets WHERE contributor_id = loser.id),
  winner.id, winner.legacy_photographer_id, winner.display_name,
  (SELECT COUNT(*) FROM image_assets WHERE contributor_id = winner.id)
FROM contributors loser
JOIN contributors winner ON winner.legacy_photographer_id = 773
WHERE loser.legacy_photographer_id = 1072;

-- 5) Full asset-owner export (same base query as manifest generator)
SELECT
  c.id,
  c.legacy_photographer_id,
  c.display_name,
  c.email,
  COUNT(ia.id)::int AS asset_count
FROM contributors c
INNER JOIN image_assets ia ON ia.contributor_id = c.id
GROUP BY c.id, c.legacy_photographer_id, c.display_name, c.email
ORDER BY asset_count DESC;
