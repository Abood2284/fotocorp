CREATE TABLE IF NOT EXISTS "image_derivatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_asset_id" uuid NOT NULL,
	"variant" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" bigint,
	"checksum" text,
	"is_watermarked" boolean DEFAULT true NOT NULL,
	"watermark_profile" text,
	"generation_status" text DEFAULT 'READY' NOT NULL,
	"generated_at" timestamp with time zone,
	"source" text DEFAULT 'LEGACY_MIGRATION' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_derivatives_variant_check" CHECK ("variant" in ('THUMB', 'CARD', 'DETAIL')),
	CONSTRAINT "image_derivatives_generation_status_check" CHECK ("generation_status" in ('READY', 'STALE', 'FAILED')),
	CONSTRAINT "image_derivatives_source_check" CHECK ("source" in ('LEGACY_MIGRATION', 'GENERATED', 'MANUAL'))
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'image_derivatives_image_asset_id_image_assets_id_fk'
	) THEN
		ALTER TABLE "image_derivatives" ADD CONSTRAINT "image_derivatives_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "image_derivatives_image_asset_id_variant_uidx" ON "image_derivatives" USING btree ("image_asset_id","variant");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_derivatives_image_asset_id_idx" ON "image_derivatives" USING btree ("image_asset_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_derivatives_variant_idx" ON "image_derivatives" USING btree ("variant");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_derivatives_generation_status_idx" ON "image_derivatives" USING btree ("generation_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_derivatives_lookup_idx" ON "image_derivatives" USING btree ("image_asset_id","variant","generation_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_derivatives_storage_key_idx" ON "image_derivatives" USING btree ("storage_key");
--> statement-breakpoint
DO $$
DECLARE
	unknown_variant_count integer;
BEGIN
	SELECT count(*)::integer
	INTO unknown_variant_count
	FROM asset_media_derivatives
	WHERE variant NOT IN ('thumb', 'card', 'detail');

	IF unknown_variant_count <> 0 THEN
		RAISE EXCEPTION 'Image derivative normalization aborted. Unknown old derivative variants=%', unknown_variant_count;
	END IF;
END $$;
--> statement-breakpoint
INSERT INTO image_derivatives (
	id,
	image_asset_id,
	variant,
	storage_key,
	mime_type,
	width,
	height,
	size_bytes,
	checksum,
	is_watermarked,
	watermark_profile,
	generation_status,
	generated_at,
	source,
	created_at,
	updated_at
)
SELECT
	old.id,
	old.asset_id AS image_asset_id,
	CASE old.variant
		WHEN 'thumb' THEN 'THUMB'
		WHEN 'card' THEN 'CARD'
		WHEN 'detail' THEN 'DETAIL'
	END AS variant,
	old.r2_key AS storage_key,
	old.mime_type,
	old.width,
	old.height,
	old.byte_size AS size_bytes,
	old.checksum,
	old.is_watermarked,
	old.watermark_profile,
	old.generation_status,
	old.generated_at,
	'LEGACY_MIGRATION' AS source,
	old.created_at,
	old.updated_at
FROM asset_media_derivatives old
JOIN image_assets ia
	ON ia.id = old.asset_id
WHERE old.variant IN ('thumb', 'card', 'detail')
ON CONFLICT (id) DO UPDATE SET
	image_asset_id = excluded.image_asset_id,
	variant = excluded.variant,
	storage_key = excluded.storage_key,
	mime_type = excluded.mime_type,
	width = excluded.width,
	height = excluded.height,
	size_bytes = excluded.size_bytes,
	checksum = excluded.checksum,
	is_watermarked = excluded.is_watermarked,
	watermark_profile = excluded.watermark_profile,
	generation_status = excluded.generation_status,
	generated_at = excluded.generated_at,
	source = excluded.source,
	created_at = excluded.created_at,
	updated_at = excluded.updated_at;
--> statement-breakpoint
DO $$
DECLARE
	old_derivatives integer;
	new_derivatives integer;
	missing_preserved_derivative_ids integer;
	derivative_rows_with_missing_image_asset integer;
	old_derivatives_with_missing_image_asset integer;
	duplicate_image_asset_variant_pairs integer;
	unknown_old_variants integer;
	missing_storage_key_count integer;
	missing_mime_type_count integer;
BEGIN
	SELECT count(*)::integer INTO old_derivatives FROM asset_media_derivatives;
	SELECT count(*)::integer INTO new_derivatives FROM image_derivatives;

	SELECT count(*)::integer
	INTO missing_preserved_derivative_ids
	FROM asset_media_derivatives old
	LEFT JOIN image_derivatives clean
		ON clean.id = old.id
	WHERE clean.id IS NULL;

	SELECT count(*)::integer
	INTO derivative_rows_with_missing_image_asset
	FROM image_derivatives d
	LEFT JOIN image_assets ia
		ON ia.id = d.image_asset_id
	WHERE ia.id IS NULL;

	SELECT count(*)::integer
	INTO old_derivatives_with_missing_image_asset
	FROM asset_media_derivatives old
	LEFT JOIN image_assets ia
		ON ia.id = old.asset_id
	WHERE ia.id IS NULL;

	SELECT count(*)::integer
	INTO duplicate_image_asset_variant_pairs
	FROM (
		SELECT image_asset_id, variant
		FROM image_derivatives
		GROUP BY image_asset_id, variant
		HAVING count(*) > 1
	) duplicate_pairs;

	SELECT count(*)::integer
	INTO unknown_old_variants
	FROM (
		SELECT variant
		FROM asset_media_derivatives
		WHERE variant NOT IN ('thumb', 'card', 'detail')
		GROUP BY variant
	) unknown_variants;

	SELECT count(*)::integer
	INTO missing_storage_key_count
	FROM image_derivatives
	WHERE storage_key IS NULL
		OR btrim(storage_key) = '';

	SELECT count(*)::integer
	INTO missing_mime_type_count
	FROM image_derivatives
	WHERE mime_type IS NULL
		OR btrim(mime_type) = '';

	IF old_derivatives <> new_derivatives THEN
		RAISE EXCEPTION 'Image derivative normalization validation failed. old derivatives=%, new derivatives=%', old_derivatives, new_derivatives;
	END IF;

	IF missing_preserved_derivative_ids <> 0 THEN
		RAISE EXCEPTION 'Image derivative normalization validation failed. missing preserved derivative IDs=%', missing_preserved_derivative_ids;
	END IF;

	IF derivative_rows_with_missing_image_asset <> 0 OR old_derivatives_with_missing_image_asset <> 0 THEN
		RAISE EXCEPTION 'Image derivative normalization validation failed. clean missing image_asset=%, old missing image_asset=%', derivative_rows_with_missing_image_asset, old_derivatives_with_missing_image_asset;
	END IF;

	IF duplicate_image_asset_variant_pairs <> 0 THEN
		RAISE EXCEPTION 'Image derivative normalization validation failed. duplicate image asset/variant pairs=%', duplicate_image_asset_variant_pairs;
	END IF;

	IF unknown_old_variants <> 0 THEN
		RAISE EXCEPTION 'Image derivative normalization validation failed. unknown old variants=%', unknown_old_variants;
	END IF;

	IF missing_storage_key_count <> 0 OR missing_mime_type_count <> 0 THEN
		RAISE EXCEPTION 'Image derivative normalization validation failed. missing storage keys=%, missing MIME types=%', missing_storage_key_count, missing_mime_type_count;
	END IF;
END $$;
