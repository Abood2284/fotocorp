CREATE TABLE IF NOT EXISTS "photo_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_event_id" bigint,
	"name" text NOT NULL,
	"description" text,
	"event_date" timestamp with time zone,
	"event_time" text,
	"country" text,
	"state_region" text,
	"city" text,
	"location" text,
	"keywords" text,
	"photo_count" bigint,
	"unpublished_photo_count" bigint,
	"default_main_image_code" text,
	"default_unpublished_main_image_code" text,
	"small_image_code_1" text,
	"small_image_code_2" text,
	"status" text DEFAULT 'UNKNOWN' NOT NULL,
	"source" text DEFAULT 'LEGACY_IMPORT' NOT NULL,
	"legacy_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_events_legacy_event_id_unique" UNIQUE("legacy_event_id"),
	CONSTRAINT "photo_events_status_check" CHECK ("status" in ('ACTIVE', 'INACTIVE', 'DELETED', 'UNKNOWN')),
	CONSTRAINT "photo_events_source_check" CHECK ("source" in ('LEGACY_IMPORT', 'MANUAL'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "image_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_source" text,
	"legacy_asset_id" bigint,
	"legacy_image_code" text,
	"title" text,
	"headline" text,
	"caption" text,
	"description" text,
	"keywords" text,
	"event_keywords" text,
	"search_text" text,
	"image_location" text,
	"photographer_id" uuid,
	"legacy_photographer_id" bigint,
	"event_id" uuid,
	"legacy_event_id" bigint,
	"category_id" uuid,
	"legacy_category_id" bigint,
	"legacy_subcategory_id" bigint,
	"original_storage_key" text,
	"original_file_name" text,
	"original_file_extension" text,
	"original_exists_in_storage" boolean DEFAULT false NOT NULL,
	"original_storage_checked_at" timestamp with time zone,
	"image_date" timestamp with time zone,
	"uploaded_at" timestamp with time zone,
	"legacy_status" integer,
	"status" text DEFAULT 'UNKNOWN' NOT NULL,
	"visibility" text DEFAULT 'PRIVATE' NOT NULL,
	"media_type" text DEFAULT 'IMAGE' NOT NULL,
	"source" text DEFAULT 'LEGACY_IMPORT' NOT NULL,
	"legacy_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_assets_status_check" CHECK ("status" in ('DRAFT', 'ACTIVE', 'ARCHIVED', 'DELETED', 'MISSING_ORIGINAL', 'UNKNOWN')),
	CONSTRAINT "image_assets_visibility_check" CHECK ("visibility" in ('PUBLIC', 'PRIVATE', 'UNLISTED')),
	CONSTRAINT "image_assets_media_type_check" CHECK ("media_type" in ('IMAGE')),
	CONSTRAINT "image_assets_source_check" CHECK ("source" in ('LEGACY_IMPORT', 'MANUAL'))
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'image_assets_photographer_id_photographers_id_fk'
	) THEN
		ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'image_assets_event_id_photo_events_id_fk'
	) THEN
		ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_event_id_photo_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."photo_events"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'image_assets_category_id_asset_categories_id_fk'
	) THEN
		ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_category_id_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_events_legacy_event_id_idx" ON "photo_events" USING btree ("legacy_event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_events_event_date_idx" ON "photo_events" USING btree ("event_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_events_city_idx" ON "photo_events" USING btree ("city");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_events_status_idx" ON "photo_events" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_events_source_idx" ON "photo_events" USING btree ("source");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "image_assets_legacy_source_asset_id_uidx" ON "image_assets" USING btree ("legacy_source","legacy_asset_id") WHERE "legacy_source" is not null and "legacy_asset_id" is not null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_assets_legacy_image_code_idx" ON "image_assets" USING btree ("legacy_image_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_assets_photographer_id_idx" ON "image_assets" USING btree ("photographer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_assets_legacy_photographer_id_idx" ON "image_assets" USING btree ("legacy_photographer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_assets_event_id_idx" ON "image_assets" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_assets_legacy_event_id_idx" ON "image_assets" USING btree ("legacy_event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_assets_category_id_idx" ON "image_assets" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_assets_status_visibility_idx" ON "image_assets" USING btree ("status","visibility");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_assets_image_date_idx" ON "image_assets" USING btree ("image_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_assets_source_idx" ON "image_assets" USING btree ("source");
--> statement-breakpoint
INSERT INTO photo_events (
	id,
	legacy_event_id,
	name,
	description,
	event_date,
	event_time,
	country,
	state_region,
	city,
	location,
	keywords,
	photo_count,
	unpublished_photo_count,
	default_main_image_code,
	default_unpublished_main_image_code,
	small_image_code_1,
	small_image_code_2,
	status,
	source,
	legacy_payload,
	created_at,
	updated_at
)
SELECT
	ae.id,
	ae.legacy_event_id,
	COALESCE(NULLIF(btrim(ae.name), ''), NULLIF(btrim(ae.legacy_payload->>'eventname'), ''), 'Untitled event') AS name,
	NULL::text AS description,
	ae.event_date,
	NULLIF(btrim(ae.legacy_payload->>'eventtime'), '') AS event_time,
	ae.country,
	ae.state AS state_region,
	ae.city,
	ae.location,
	ae.keywords,
	ae.photo_count,
	ae.photo_count_unpublished AS unpublished_photo_count,
	NULLIF(btrim(ae.legacy_payload->>'defaultmain'), '') AS default_main_image_code,
	NULLIF(btrim(ae.legacy_payload->>'defaultmainunpub'), '') AS default_unpublished_main_image_code,
	ae.small_image_1 AS small_image_code_1,
	ae.small_image_2 AS small_image_code_2,
	CASE
		WHEN btrim(coalesce(ae.legacy_payload->>'status', '')) = '1' OR lower(btrim(coalesce(ae.legacy_payload->>'status', ''))) in ('yes', 'active') THEN 'ACTIVE'
		WHEN btrim(coalesce(ae.legacy_payload->>'status', '')) = '0' OR lower(btrim(coalesce(ae.legacy_payload->>'status', ''))) in ('no', 'inactive') THEN 'INACTIVE'
		WHEN lower(btrim(coalesce(ae.legacy_payload->>'status', ''))) = 'deleted' THEN 'DELETED'
		ELSE 'UNKNOWN'
	END AS status,
	'LEGACY_IMPORT' AS source,
	ae.legacy_payload,
	ae.created_at,
	ae.updated_at
FROM asset_events ae
ON CONFLICT (legacy_event_id) DO UPDATE SET
	name = excluded.name,
	description = excluded.description,
	event_date = excluded.event_date,
	event_time = excluded.event_time,
	country = excluded.country,
	state_region = excluded.state_region,
	city = excluded.city,
	location = excluded.location,
	keywords = excluded.keywords,
	photo_count = excluded.photo_count,
	unpublished_photo_count = excluded.unpublished_photo_count,
	default_main_image_code = excluded.default_main_image_code,
	default_unpublished_main_image_code = excluded.default_unpublished_main_image_code,
	small_image_code_1 = excluded.small_image_code_1,
	small_image_code_2 = excluded.small_image_code_2,
	status = excluded.status,
	source = excluded.source,
	legacy_payload = excluded.legacy_payload,
	updated_at = excluded.updated_at;
--> statement-breakpoint
INSERT INTO image_assets (
	id,
	legacy_source,
	legacy_asset_id,
	legacy_image_code,
	title,
	headline,
	caption,
	description,
	keywords,
	event_keywords,
	search_text,
	image_location,
	photographer_id,
	legacy_photographer_id,
	event_id,
	legacy_event_id,
	category_id,
	legacy_category_id,
	legacy_subcategory_id,
	original_storage_key,
	original_file_name,
	original_file_extension,
	original_exists_in_storage,
	original_storage_checked_at,
	image_date,
	uploaded_at,
	legacy_status,
	status,
	visibility,
	media_type,
	source,
	legacy_payload,
	created_at,
	updated_at
)
SELECT
	a.id,
	a.legacy_source,
	a.legacy_srno AS legacy_asset_id,
	a.legacy_imagecode AS legacy_image_code,
	a.title,
	a.headline,
	a.caption,
	a.description,
	a.keywords,
	a.event_keywords,
	a.search_text,
	a.image_location,
	p.id AS photographer_id,
	a.legacy_photographer_id,
	a.event_id,
	a.legacy_event_id,
	a.category_id,
	CASE WHEN NULLIF(a.legacy_payload->>'catid', 'NULL') ~ '^[0-9]+$' THEN (a.legacy_payload->>'catid')::bigint ELSE NULL END AS legacy_category_id,
	CASE WHEN NULLIF(a.legacy_payload->>'subcatid', 'NULL') ~ '^[0-9]+$' THEN (a.legacy_payload->>'subcatid')::bigint ELSE NULL END AS legacy_subcategory_id,
	a.r2_original_key AS original_storage_key,
	a.original_filename AS original_file_name,
	a.original_ext AS original_file_extension,
	a.r2_exists AS original_exists_in_storage,
	a.r2_checked_at AS original_storage_checked_at,
	a.image_date,
	a.uploaded_at,
	a.legacy_status,
	CASE
		WHEN a.status in ('DRAFT', 'ACTIVE', 'ARCHIVED', 'DELETED') THEN a.status
		WHEN a.status in ('READY', 'APPROVED', 'PUBLISHED', 'REVIEW') THEN 'ACTIVE'
		WHEN a.r2_exists = false THEN 'MISSING_ORIGINAL'
		ELSE 'UNKNOWN'
	END AS status,
	CASE WHEN a.visibility in ('PUBLIC', 'PRIVATE', 'UNLISTED') THEN a.visibility ELSE 'PRIVATE' END AS visibility,
	'IMAGE' AS media_type,
	CASE WHEN a.source in ('LEGACY_IMPORT', 'MANUAL') THEN a.source ELSE 'LEGACY_IMPORT' END AS source,
	a.legacy_payload,
	a.created_at,
	a.updated_at
FROM assets a
LEFT JOIN photographers p
	ON p.legacy_photographer_id = a.legacy_photographer_id
LEFT JOIN photo_events pe
	ON pe.id = a.event_id
ON CONFLICT (legacy_source, legacy_asset_id) WHERE legacy_source IS NOT NULL AND legacy_asset_id IS NOT NULL DO UPDATE SET
	id = excluded.id,
	legacy_image_code = excluded.legacy_image_code,
	title = excluded.title,
	headline = excluded.headline,
	caption = excluded.caption,
	description = excluded.description,
	keywords = excluded.keywords,
	event_keywords = excluded.event_keywords,
	search_text = excluded.search_text,
	image_location = excluded.image_location,
	photographer_id = excluded.photographer_id,
	legacy_photographer_id = excluded.legacy_photographer_id,
	event_id = excluded.event_id,
	legacy_event_id = excluded.legacy_event_id,
	category_id = excluded.category_id,
	legacy_category_id = excluded.legacy_category_id,
	legacy_subcategory_id = excluded.legacy_subcategory_id,
	original_storage_key = excluded.original_storage_key,
	original_file_name = excluded.original_file_name,
	original_file_extension = excluded.original_file_extension,
	original_exists_in_storage = excluded.original_exists_in_storage,
	original_storage_checked_at = excluded.original_storage_checked_at,
	image_date = excluded.image_date,
	uploaded_at = excluded.uploaded_at,
	legacy_status = excluded.legacy_status,
	status = excluded.status,
	visibility = excluded.visibility,
	media_type = excluded.media_type,
	source = excluded.source,
	legacy_payload = excluded.legacy_payload,
	created_at = excluded.created_at,
	updated_at = excluded.updated_at;
--> statement-breakpoint
DO $$
DECLARE
	old_asset_events integer;
	new_photo_events integer;
	old_assets integer;
	new_image_assets integer;
	missing_preserved_image_asset_ids integer;
	missing_preserved_photo_event_ids integer;
	legacy_image_assets integer;
	with_legacy_photographer_id integer;
	with_photographer_id integer;
	orphan_photographer_links integer;
	orphan_legacy_photographer_ids integer;
	old_assets_with_event_id integer;
	new_image_assets_with_event_id integer;
	orphan_event_links integer;
	duplicate_legacy_assets integer;
BEGIN
	SELECT count(*)::integer INTO old_asset_events FROM asset_events;
	SELECT count(*)::integer INTO new_photo_events FROM photo_events;
	SELECT count(*)::integer INTO old_assets FROM assets;
	SELECT count(*)::integer INTO new_image_assets FROM image_assets;

	SELECT count(*)::integer
	INTO missing_preserved_image_asset_ids
	FROM assets a
	LEFT JOIN image_assets ia ON ia.id = a.id
	WHERE ia.id IS NULL;

	SELECT count(*)::integer
	INTO missing_preserved_photo_event_ids
	FROM asset_events ae
	LEFT JOIN photo_events pe ON pe.id = ae.id
	WHERE pe.id IS NULL;

	SELECT
		count(*) filter (where source = 'LEGACY_IMPORT')::integer,
		count(*) filter (where source = 'LEGACY_IMPORT' and legacy_photographer_id is not null)::integer,
		count(*) filter (where source = 'LEGACY_IMPORT' and photographer_id is not null)::integer
	INTO legacy_image_assets, with_legacy_photographer_id, with_photographer_id
	FROM image_assets;

	SELECT count(*)::integer
	INTO orphan_photographer_links
	FROM (
		SELECT ia.legacy_photographer_id
		FROM image_assets ia
		LEFT JOIN photographers p ON p.id = ia.photographer_id
		WHERE ia.source = 'LEGACY_IMPORT'
			AND ia.photographer_id IS NOT NULL
			AND p.id IS NULL
		GROUP BY ia.legacy_photographer_id
	) orphan_links;

	SELECT count(*)::integer
	INTO orphan_legacy_photographer_ids
	FROM (
		SELECT ia.legacy_photographer_id
		FROM image_assets ia
		LEFT JOIN photographers p ON p.legacy_photographer_id = ia.legacy_photographer_id
		WHERE ia.source = 'LEGACY_IMPORT'
			AND ia.legacy_photographer_id IS NOT NULL
			AND p.id IS NULL
		GROUP BY ia.legacy_photographer_id
	) orphan_legacy_ids;

	SELECT
		count(*) filter (where a.event_id is not null)::integer,
		count(*) filter (where ia.event_id is not null)::integer
	INTO old_assets_with_event_id, new_image_assets_with_event_id
	FROM assets a
	JOIN image_assets ia ON ia.id = a.id;

	SELECT count(*)::integer
	INTO orphan_event_links
	FROM image_assets ia
	LEFT JOIN photo_events pe ON pe.id = ia.event_id
	WHERE ia.event_id IS NOT NULL
		AND pe.id IS NULL;

	SELECT count(*)::integer
	INTO duplicate_legacy_assets
	FROM (
		SELECT legacy_source, legacy_asset_id
		FROM image_assets
		WHERE legacy_source IS NOT NULL
			AND legacy_asset_id IS NOT NULL
		GROUP BY legacy_source, legacy_asset_id
		HAVING count(*) > 1
	) duplicates;

	IF old_asset_events <> new_photo_events THEN
		RAISE EXCEPTION 'Image asset normalization validation failed. old asset_events=%, new photo_events=%', old_asset_events, new_photo_events;
	END IF;

	IF old_assets <> new_image_assets THEN
		RAISE EXCEPTION 'Image asset normalization validation failed. old assets=%, new image_assets=%', old_assets, new_image_assets;
	END IF;

	IF missing_preserved_image_asset_ids <> 0 OR missing_preserved_photo_event_ids <> 0 THEN
		RAISE EXCEPTION 'Image asset normalization validation failed. missing image ids=%, missing event ids=%', missing_preserved_image_asset_ids, missing_preserved_photo_event_ids;
	END IF;

	IF with_legacy_photographer_id <> legacy_image_assets OR with_photographer_id <> legacy_image_assets THEN
		RAISE EXCEPTION 'Image asset normalization validation failed. legacy image assets=%, with legacy photographer=%, with photographer=%', legacy_image_assets, with_legacy_photographer_id, with_photographer_id;
	END IF;

	IF orphan_photographer_links <> 0 OR orphan_legacy_photographer_ids <> 0 THEN
		RAISE EXCEPTION 'Image asset normalization validation failed. orphan photographer links=%, orphan legacy photographer ids=%', orphan_photographer_links, orphan_legacy_photographer_ids;
	END IF;

	IF old_assets_with_event_id <> new_image_assets_with_event_id OR orphan_event_links <> 0 THEN
		RAISE EXCEPTION 'Image asset normalization validation failed. old event links=%, new event links=%, orphan event links=%', old_assets_with_event_id, new_image_assets_with_event_id, orphan_event_links;
	END IF;

	IF duplicate_legacy_assets <> 0 THEN
		RAISE EXCEPTION 'Image asset normalization validation failed. duplicate legacy source/asset rows=%', duplicate_legacy_assets;
	END IF;
END $$;
