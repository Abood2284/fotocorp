CREATE TABLE IF NOT EXISTS "photographers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_photographer_id" bigint,
	"display_name" text NOT NULL,
	"first_name" text,
	"middle_name" text,
	"last_name" text,
	"email" text,
	"mobile_phone" text,
	"landline_phone" text,
	"address" text,
	"city" text,
	"state_region" text,
	"country" text,
	"postal_code" text,
	"status" text DEFAULT 'UNKNOWN' NOT NULL,
	"legacy_status" text,
	"source" text DEFAULT 'LEGACY_IMPORT' NOT NULL,
	"legacy_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photographers_legacy_photographer_id_unique" UNIQUE("legacy_photographer_id"),
	CONSTRAINT "photographers_status_check" CHECK ("status" in ('ACTIVE', 'INACTIVE', 'DELETED', 'UNKNOWN')),
	CONSTRAINT "photographers_source_check" CHECK ("source" in ('LEGACY_IMPORT', 'MANUAL'))
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "legacy_photographer_id" bigint;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "photographers_legacy_photographer_id_unique_idx" ON "photographers" USING btree ("legacy_photographer_id") WHERE "legacy_photographer_id" is not null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photographers_status_idx" ON "photographers" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photographers_display_name_lower_idx" ON "photographers" USING btree (lower("display_name"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photographers_email_lower_idx" ON "photographers" USING btree (lower("email")) WHERE "email" is not null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photographers_source_idx" ON "photographers" USING btree ("source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_legacy_photographer_id_idx" ON "assets" USING btree ("legacy_photographer_id");
--> statement-breakpoint
DO $$
DECLARE
	duplicate_legacy_ids integer;
BEGIN
	WITH numeric_profiles AS (
		SELECT
			CASE
				WHEN NULLIF(legacy_payload->>'srno', 'NULL') ~ '^[0-9]+$'
				THEN (legacy_payload->>'srno')::bigint
				ELSE NULL
			END AS legacy_photographer_id
		FROM photographer_profiles
	)
	SELECT count(*)::integer
	INTO duplicate_legacy_ids
	FROM (
		SELECT legacy_photographer_id
		FROM numeric_profiles
		WHERE legacy_photographer_id IS NOT NULL
		GROUP BY legacy_photographer_id
		HAVING count(*) > 1
	) duplicates;

	IF duplicate_legacy_ids = 0 THEN
		UPDATE photographer_profiles
		SET legacy_photographer_id = NULLIF(legacy_payload->>'srno', 'NULL')::bigint
		WHERE legacy_photographer_id IS NULL
			AND legacy_payload->>'srno' ~ '^[0-9]+$';
	ELSE
		RAISE NOTICE 'Skipping photographer_profiles.legacy_photographer_id backfill because % duplicate numeric legacy photographer IDs would violate the existing unique constraint.', duplicate_legacy_ids;
	END IF;
END $$;
--> statement-breakpoint
WITH normalized_profiles AS (
	SELECT
		pp.id AS profile_id,
		CASE
			WHEN NULLIF(pp.legacy_payload->>'srno', 'NULL') ~ '^[0-9]+$'
			THEN (pp.legacy_payload->>'srno')::bigint
			ELSE NULL
		END AS legacy_photographer_id,
		COALESCE(
			NULLIF(btrim(pp.display_name), ''),
			NULLIF(btrim(concat_ws(' ', pp.legacy_payload->>'pfname', pp.legacy_payload->>'pmname', pp.legacy_payload->>'plname')), ''),
			'Legacy photographer'
		) AS display_name,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pfname'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pfname')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pfname') END AS first_name,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pmname'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pmname')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pmname') END AS middle_name,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'plname'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'plname')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'plname') END AS last_name,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pemail'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pemail')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pemail') END AS email,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pmobile'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pmobile')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pmobile') END AS mobile_phone,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'ptel'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'ptel')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'ptel') END AS landline_phone,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'paddress'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'paddress')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'paddress') END AS address,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pcity'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pcity')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pcity') END AS city,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pstate'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pstate')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pstate') END AS state_region,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pcountry'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pcountry')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pcountry') END AS country,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pzip'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pzip')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pzip') END AS postal_code,
		CASE
			WHEN lower(btrim(coalesce(pp.legacy_payload->>'pstatus', ''))) = 'yes' OR btrim(coalesce(pp.legacy_payload->>'pstatus', '')) = '1' THEN 'ACTIVE'
			WHEN lower(btrim(coalesce(pp.legacy_payload->>'pstatus', ''))) = 'no' THEN 'INACTIVE'
			WHEN btrim(coalesce(pp.legacy_payload->>'pstatus', '')) = 'Deleted' THEN 'DELETED'
			ELSE 'UNKNOWN'
		END AS status,
		CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pstatus'), '') IS NULL OR upper(btrim(pp.legacy_payload->>'pstatus')) = 'NULL' THEN NULL ELSE btrim(pp.legacy_payload->>'pstatus') END AS legacy_status,
		pp.legacy_payload,
		pp.created_at,
		pp.id::text AS profile_id_text,
		CASE WHEN coalesce(NULLIF(btrim(pp.legacy_payload->>'pemail'), ''), NULLIF(btrim(pp.email), '')) ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN 1 ELSE 0 END AS has_valid_email,
		CASE WHEN lower(btrim(coalesce(pp.legacy_payload->>'pstatus', ''))) = 'yes' OR btrim(coalesce(pp.legacy_payload->>'pstatus', '')) = '1' THEN 1 ELSE 0 END AS has_active_status,
		(
			CASE WHEN NULLIF(btrim(pp.display_name), '') IS NOT NULL THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pfname'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pfname')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pmname'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pmname')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'plname'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'plname')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pemail'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pemail')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pmobile'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pmobile')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'ptel'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'ptel')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'paddress'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'paddress')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pcity'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pcity')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pstate'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pstate')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pcountry'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pcountry')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pzip'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pzip')) <> 'NULL' THEN 1 ELSE 0 END
		) AS richness_score
	FROM photographer_profiles pp
),
canonical_photographer_profiles AS (
	SELECT *
	FROM (
		SELECT
			normalized_profiles.*,
			row_number() OVER (
				PARTITION BY legacy_photographer_id
				ORDER BY has_valid_email DESC, has_active_status DESC, richness_score DESC, created_at ASC NULLS LAST, profile_id_text ASC
			) AS canonical_rank
		FROM normalized_profiles
		WHERE legacy_photographer_id IS NOT NULL
	) ranked
	WHERE canonical_rank = 1
)
INSERT INTO photographers (
	legacy_photographer_id,
	display_name,
	first_name,
	middle_name,
	last_name,
	email,
	mobile_phone,
	landline_phone,
	address,
	city,
	state_region,
	country,
	postal_code,
	status,
	legacy_status,
	source,
	legacy_payload,
	updated_at
)
SELECT
	legacy_photographer_id,
	display_name,
	first_name,
	middle_name,
	last_name,
	email,
	mobile_phone,
	landline_phone,
	address,
	city,
	state_region,
	country,
	postal_code,
	status,
	legacy_status,
	'LEGACY_IMPORT',
	legacy_payload,
	now()
FROM canonical_photographer_profiles
ON CONFLICT (legacy_photographer_id) DO UPDATE SET
	display_name = excluded.display_name,
	first_name = excluded.first_name,
	middle_name = excluded.middle_name,
	last_name = excluded.last_name,
	email = excluded.email,
	mobile_phone = excluded.mobile_phone,
	landline_phone = excluded.landline_phone,
	address = excluded.address,
	city = excluded.city,
	state_region = excluded.state_region,
	country = excluded.country,
	postal_code = excluded.postal_code,
	status = excluded.status,
	legacy_status = excluded.legacy_status,
	source = excluded.source,
	legacy_payload = excluded.legacy_payload,
	updated_at = now();
--> statement-breakpoint
UPDATE assets
SET legacy_photographer_id = (legacy_payload->>'photographid')::bigint
WHERE legacy_photographer_id IS NULL
	AND legacy_payload->>'photographid' ~ '^[0-9]+$';
--> statement-breakpoint
WITH normalized_profiles AS (
	SELECT
		pp.id AS profile_id,
		CASE
			WHEN NULLIF(pp.legacy_payload->>'srno', 'NULL') ~ '^[0-9]+$'
			THEN (pp.legacy_payload->>'srno')::bigint
			ELSE NULL
		END AS legacy_photographer_id,
		pp.created_at,
		pp.id::text AS profile_id_text,
		CASE WHEN coalesce(NULLIF(btrim(pp.legacy_payload->>'pemail'), ''), NULLIF(btrim(pp.email), '')) ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN 1 ELSE 0 END AS has_valid_email,
		CASE WHEN lower(btrim(coalesce(pp.legacy_payload->>'pstatus', ''))) = 'yes' OR btrim(coalesce(pp.legacy_payload->>'pstatus', '')) = '1' THEN 1 ELSE 0 END AS has_active_status,
		(
			CASE WHEN NULLIF(btrim(pp.display_name), '') IS NOT NULL THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pfname'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pfname')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pmname'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pmname')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'plname'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'plname')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pemail'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pemail')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pmobile'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pmobile')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'ptel'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'ptel')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'paddress'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'paddress')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pcity'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pcity')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pstate'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pstate')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pcountry'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pcountry')) <> 'NULL' THEN 1 ELSE 0 END +
			CASE WHEN NULLIF(btrim(pp.legacy_payload->>'pzip'), '') IS NOT NULL AND upper(btrim(pp.legacy_payload->>'pzip')) <> 'NULL' THEN 1 ELSE 0 END
		) AS richness_score
	FROM photographer_profiles pp
),
canonical_photographer_profiles AS (
	SELECT profile_id, legacy_photographer_id
	FROM (
		SELECT
			normalized_profiles.*,
			row_number() OVER (
				PARTITION BY legacy_photographer_id
				ORDER BY has_valid_email DESC, has_active_status DESC, richness_score DESC, created_at ASC NULLS LAST, profile_id_text ASC
			) AS canonical_rank
		FROM normalized_profiles
		WHERE legacy_photographer_id IS NOT NULL
	) ranked
	WHERE canonical_rank = 1
)
UPDATE assets a
SET photographer_profile_id = canonical.profile_id
FROM canonical_photographer_profiles canonical
WHERE a.photographer_profile_id IS NULL
	AND a.legacy_photographer_id = canonical.legacy_photographer_id;
--> statement-breakpoint
DO $$
DECLARE
	total_photographers integer;
	distinct_legacy_photographer_ids integer;
	missing_legacy_photographer_id integer;
	duplicate_photographers integer;
	legacy_assets integer;
	legacy_assets_with_legacy_photographer_id integer;
	legacy_assets_with_photographer_profile_id integer;
	orphan_legacy_photographer_ids integer;
	orphan_current_profile_links integer;
BEGIN
	SELECT
		count(*)::integer,
		count(distinct legacy_photographer_id)::integer,
		count(*) filter (where legacy_photographer_id is null)::integer
	INTO total_photographers, distinct_legacy_photographer_ids, missing_legacy_photographer_id
	FROM photographers;

	SELECT count(*)::integer
	INTO duplicate_photographers
	FROM (
		SELECT legacy_photographer_id
		FROM photographers
		GROUP BY legacy_photographer_id
		HAVING count(*) > 1
	) duplicates;

	SELECT
		count(*) filter (where source = 'LEGACY_IMPORT')::integer,
		count(*) filter (where source = 'LEGACY_IMPORT' and legacy_photographer_id is not null)::integer,
		count(*) filter (where source = 'LEGACY_IMPORT' and photographer_profile_id is not null)::integer
	INTO legacy_assets, legacy_assets_with_legacy_photographer_id, legacy_assets_with_photographer_profile_id
	FROM assets;

	SELECT count(*)::integer
	INTO orphan_legacy_photographer_ids
	FROM (
		SELECT a.legacy_photographer_id
		FROM assets a
		LEFT JOIN photographers p
			ON p.legacy_photographer_id = a.legacy_photographer_id
		WHERE a.source = 'LEGACY_IMPORT'
			AND a.legacy_photographer_id IS NOT NULL
			AND p.id IS NULL
		GROUP BY a.legacy_photographer_id
	) orphan_ids;

	SELECT count(*)::integer
	INTO orphan_current_profile_links
	FROM assets a
	LEFT JOIN photographer_profiles pp
		ON pp.id = a.photographer_profile_id
	WHERE a.photographer_profile_id IS NOT NULL
		AND pp.id IS NULL;

	IF total_photographers <> 786 OR distinct_legacy_photographer_ids <> 786 OR missing_legacy_photographer_id <> 0 THEN
		RAISE EXCEPTION 'Photographer normalization validation failed. total=%, distinct=%, missing=%', total_photographers, distinct_legacy_photographer_ids, missing_legacy_photographer_id;
	END IF;

	IF duplicate_photographers <> 0 THEN
		RAISE EXCEPTION 'Photographer normalization validation failed. duplicate photographer legacy IDs=%', duplicate_photographers;
	END IF;

	IF legacy_assets_with_legacy_photographer_id <> legacy_assets THEN
		RAISE EXCEPTION 'Photographer normalization validation failed. legacy assets=%, with typed photographer ID=%', legacy_assets, legacy_assets_with_legacy_photographer_id;
	END IF;

	IF legacy_assets_with_photographer_profile_id <> legacy_assets THEN
		RAISE EXCEPTION 'Photographer normalization validation failed. legacy assets=%, with current profile FK=%', legacy_assets, legacy_assets_with_photographer_profile_id;
	END IF;

	IF orphan_legacy_photographer_ids <> 0 OR orphan_current_profile_links <> 0 THEN
		RAISE EXCEPTION 'Photographer normalization validation failed. orphan legacy photographer IDs=%, orphan current profile links=%', orphan_legacy_photographer_ids, orphan_current_profile_links;
	END IF;
END $$;
