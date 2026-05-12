CREATE TABLE IF NOT EXISTS "image_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_asset_id" uuid,
	"image_derivative_id" uuid,
	"variant" text,
	"requester_user_id" text,
	"requester_role" text,
	"ip_hash" text,
	"user_agent" text,
	"status_code" integer NOT NULL,
	"outcome" text NOT NULL,
	"source" text DEFAULT 'LEGACY_MIGRATION' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_access_logs_variant_check" CHECK ("variant" is null or "variant" in ('THUMB', 'CARD', 'DETAIL')),
	CONSTRAINT "image_access_logs_outcome_check" CHECK ("outcome" in ('SERVED', 'NOT_FOUND', 'PREVIEW_NOT_READY', 'UNAUTHORIZED', 'FORBIDDEN', 'INVALID_TOKEN', 'R2_ERROR')),
	CONSTRAINT "image_access_logs_source_check" CHECK ("source" in ('LEGACY_MIGRATION', 'APPLICATION'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "image_download_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_asset_id" uuid,
	"auth_user_id" text NOT NULL,
	"app_user_profile_id" text,
	"download_size" text NOT NULL,
	"download_status" text NOT NULL,
	"quota_before" integer,
	"quota_after" integer,
	"bytes_served" bigint,
	"content_type" text,
	"failure_code" text,
	"user_agent" text,
	"ip_hash" text,
	"source" text DEFAULT 'LEGACY_MIGRATION' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_download_logs_size_check" CHECK ("download_size" in ('WEB', 'MEDIUM', 'LARGE')),
	CONSTRAINT "image_download_logs_status_check" CHECK ("download_status" in ('STARTED', 'COMPLETED', 'FAILED')),
	CONSTRAINT "image_download_logs_source_check" CHECK ("source" in ('LEGACY_MIGRATION', 'APPLICATION'))
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'image_access_logs_image_asset_id_image_assets_id_fk'
	) THEN
		ALTER TABLE "image_access_logs" ADD CONSTRAINT "image_access_logs_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'image_access_logs_image_derivative_id_image_derivatives_id_fk'
	) THEN
		ALTER TABLE "image_access_logs" ADD CONSTRAINT "image_access_logs_image_derivative_id_image_derivatives_id_fk" FOREIGN KEY ("image_derivative_id") REFERENCES "public"."image_derivatives"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'image_download_logs_image_asset_id_image_assets_id_fk'
	) THEN
		ALTER TABLE "image_download_logs" ADD CONSTRAINT "image_download_logs_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_access_logs_image_asset_id_idx" ON "image_access_logs" USING btree ("image_asset_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_access_logs_image_derivative_id_idx" ON "image_access_logs" USING btree ("image_derivative_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_access_logs_variant_idx" ON "image_access_logs" USING btree ("variant");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_access_logs_outcome_idx" ON "image_access_logs" USING btree ("outcome");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_access_logs_status_code_idx" ON "image_access_logs" USING btree ("status_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_access_logs_created_at_idx" ON "image_access_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_access_logs_requester_user_id_idx" ON "image_access_logs" USING btree ("requester_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_download_logs_image_asset_id_idx" ON "image_download_logs" USING btree ("image_asset_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_download_logs_auth_user_id_idx" ON "image_download_logs" USING btree ("auth_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_download_logs_app_user_profile_id_idx" ON "image_download_logs" USING btree ("app_user_profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_download_logs_download_size_idx" ON "image_download_logs" USING btree ("download_size");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_download_logs_download_status_idx" ON "image_download_logs" USING btree ("download_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_download_logs_created_at_idx" ON "image_download_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_download_logs_failure_code_idx" ON "image_download_logs" USING btree ("failure_code");
--> statement-breakpoint
DO $$
DECLARE
	unknown_access_variants integer;
	unknown_download_sizes integer;
	unknown_download_statuses integer;
BEGIN
	SELECT count(*)::integer
	INTO unknown_access_variants
	FROM asset_media_access_logs
	WHERE variant IS NOT NULL
		AND variant NOT IN ('thumb', 'card', 'detail', 'THUMB', 'CARD', 'DETAIL');

	SELECT count(*)::integer
	INTO unknown_download_sizes
	FROM asset_download_logs
	WHERE upper(download_size) NOT IN ('WEB', 'MEDIUM', 'LARGE');

	SELECT count(*)::integer
	INTO unknown_download_statuses
	FROM asset_download_logs
	WHERE upper(download_status) NOT IN ('STARTED', 'COMPLETED', 'FAILED');

	IF unknown_access_variants <> 0 THEN
		RAISE EXCEPTION 'Image log normalization aborted. Unknown access variants=%', unknown_access_variants;
	END IF;

	IF unknown_download_sizes <> 0 OR unknown_download_statuses <> 0 THEN
		RAISE EXCEPTION 'Image log normalization aborted. Unknown download sizes=%, statuses=%', unknown_download_sizes, unknown_download_statuses;
	END IF;
END $$;
--> statement-breakpoint
INSERT INTO image_access_logs (
	id,
	image_asset_id,
	image_derivative_id,
	variant,
	requester_user_id,
	requester_role,
	ip_hash,
	user_agent,
	status_code,
	outcome,
	source,
	created_at
)
SELECT
	old.id,
	old.asset_id AS image_asset_id,
	old.derivative_id AS image_derivative_id,
	CASE old.variant
		WHEN 'thumb' THEN 'THUMB'
		WHEN 'card' THEN 'CARD'
		WHEN 'detail' THEN 'DETAIL'
		WHEN 'THUMB' THEN 'THUMB'
		WHEN 'CARD' THEN 'CARD'
		WHEN 'DETAIL' THEN 'DETAIL'
		ELSE NULL
	END AS variant,
	old.requester_user_id,
	old.requester_role,
	old.ip_hash,
	old.user_agent,
	old.status_code,
	old.outcome,
	'LEGACY_MIGRATION' AS source,
	old.created_at
FROM asset_media_access_logs old
LEFT JOIN image_assets ia
	ON ia.id = old.asset_id
LEFT JOIN image_derivatives d
	ON d.id = old.derivative_id
WHERE (old.asset_id IS NULL OR ia.id IS NOT NULL)
	AND (old.derivative_id IS NULL OR d.id IS NOT NULL)
ON CONFLICT (id) DO UPDATE SET
	image_asset_id = excluded.image_asset_id,
	image_derivative_id = excluded.image_derivative_id,
	variant = excluded.variant,
	requester_user_id = excluded.requester_user_id,
	requester_role = excluded.requester_role,
	ip_hash = excluded.ip_hash,
	user_agent = excluded.user_agent,
	status_code = excluded.status_code,
	outcome = excluded.outcome,
	source = excluded.source,
	created_at = excluded.created_at;
--> statement-breakpoint
INSERT INTO image_download_logs (
	id,
	image_asset_id,
	auth_user_id,
	app_user_profile_id,
	download_size,
	download_status,
	quota_before,
	quota_after,
	bytes_served,
	content_type,
	failure_code,
	user_agent,
	ip_hash,
	source,
	created_at
)
SELECT
	old.id,
	old.asset_id AS image_asset_id,
	old.auth_user_id,
	old.app_user_profile_id,
	upper(old.download_size) AS download_size,
	upper(old.download_status) AS download_status,
	old.quota_before,
	old.quota_after,
	old.bytes_served,
	old.content_type,
	old.failure_code,
	old.user_agent,
	old.ip_hash,
	'LEGACY_MIGRATION' AS source,
	old.created_at
FROM asset_download_logs old
LEFT JOIN image_assets ia
	ON ia.id = old.asset_id
WHERE old.asset_id IS NULL OR ia.id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
	image_asset_id = excluded.image_asset_id,
	auth_user_id = excluded.auth_user_id,
	app_user_profile_id = excluded.app_user_profile_id,
	download_size = excluded.download_size,
	download_status = excluded.download_status,
	quota_before = excluded.quota_before,
	quota_after = excluded.quota_after,
	bytes_served = excluded.bytes_served,
	content_type = excluded.content_type,
	failure_code = excluded.failure_code,
	user_agent = excluded.user_agent,
	ip_hash = excluded.ip_hash,
	source = excluded.source,
	created_at = excluded.created_at;
--> statement-breakpoint
DO $$
DECLARE
	old_media_access_logs integer;
	new_image_access_logs integer;
	missing_preserved_access_log_ids integer;
	image_access_logs_with_missing_image_asset integer;
	image_access_logs_with_missing_image_derivative integer;
	unknown_old_access_variants integer;
	unknown_new_access_variants integer;
	old_download_logs integer;
	new_image_download_logs integer;
	missing_preserved_download_log_ids integer;
	image_download_logs_with_missing_image_asset integer;
	unknown_old_download_sizes integer;
	unknown_old_download_statuses integer;
	missing_auth_user_id_count integer;
BEGIN
	SELECT count(*)::integer INTO old_media_access_logs FROM asset_media_access_logs;
	SELECT count(*)::integer INTO new_image_access_logs FROM image_access_logs;

	SELECT count(*)::integer
	INTO missing_preserved_access_log_ids
	FROM asset_media_access_logs old
	LEFT JOIN image_access_logs clean ON clean.id = old.id
	WHERE clean.id IS NULL;

	SELECT count(*)::integer
	INTO image_access_logs_with_missing_image_asset
	FROM image_access_logs l
	LEFT JOIN image_assets ia ON ia.id = l.image_asset_id
	WHERE l.image_asset_id IS NOT NULL
		AND ia.id IS NULL;

	SELECT count(*)::integer
	INTO image_access_logs_with_missing_image_derivative
	FROM image_access_logs l
	LEFT JOIN image_derivatives d ON d.id = l.image_derivative_id
	WHERE l.image_derivative_id IS NOT NULL
		AND d.id IS NULL;

	SELECT count(*)::integer
	INTO unknown_old_access_variants
	FROM (
		SELECT variant
		FROM asset_media_access_logs
		WHERE variant IS NOT NULL
			AND variant NOT IN ('thumb', 'card', 'detail', 'THUMB', 'CARD', 'DETAIL')
		GROUP BY variant
	) old_variants;

	SELECT count(*)::integer
	INTO unknown_new_access_variants
	FROM (
		SELECT variant
		FROM image_access_logs
		WHERE variant IS NOT NULL
			AND variant NOT IN ('THUMB', 'CARD', 'DETAIL')
		GROUP BY variant
	) new_variants;

	SELECT count(*)::integer INTO old_download_logs FROM asset_download_logs;
	SELECT count(*)::integer INTO new_image_download_logs FROM image_download_logs;

	SELECT count(*)::integer
	INTO missing_preserved_download_log_ids
	FROM asset_download_logs old
	LEFT JOIN image_download_logs clean ON clean.id = old.id
	WHERE clean.id IS NULL;

	SELECT count(*)::integer
	INTO image_download_logs_with_missing_image_asset
	FROM image_download_logs l
	LEFT JOIN image_assets ia ON ia.id = l.image_asset_id
	WHERE l.image_asset_id IS NOT NULL
		AND ia.id IS NULL;

	SELECT count(*)::integer
	INTO unknown_old_download_sizes
	FROM (
		SELECT download_size
		FROM asset_download_logs
		WHERE upper(download_size) NOT IN ('WEB', 'MEDIUM', 'LARGE')
		GROUP BY download_size
	) sizes;

	SELECT count(*)::integer
	INTO unknown_old_download_statuses
	FROM (
		SELECT download_status
		FROM asset_download_logs
		WHERE upper(download_status) NOT IN ('STARTED', 'COMPLETED', 'FAILED')
		GROUP BY download_status
	) statuses;

	SELECT count(*)::integer
	INTO missing_auth_user_id_count
	FROM image_download_logs
	WHERE auth_user_id IS NULL
		OR btrim(auth_user_id) = '';

	IF old_media_access_logs <> new_image_access_logs THEN
		RAISE EXCEPTION 'Image log normalization validation failed. old access logs=%, new access logs=%', old_media_access_logs, new_image_access_logs;
	END IF;

	IF missing_preserved_access_log_ids <> 0 THEN
		RAISE EXCEPTION 'Image log normalization validation failed. missing access log IDs=%', missing_preserved_access_log_ids;
	END IF;

	IF image_access_logs_with_missing_image_asset <> 0 OR image_access_logs_with_missing_image_derivative <> 0 THEN
		RAISE EXCEPTION 'Image log normalization validation failed. access missing image_asset=%, image_derivative=%', image_access_logs_with_missing_image_asset, image_access_logs_with_missing_image_derivative;
	END IF;

	IF unknown_old_access_variants <> 0 OR unknown_new_access_variants <> 0 THEN
		RAISE EXCEPTION 'Image log normalization validation failed. unknown access variants old=%, new=%', unknown_old_access_variants, unknown_new_access_variants;
	END IF;

	IF old_download_logs <> new_image_download_logs THEN
		RAISE EXCEPTION 'Image log normalization validation failed. old download logs=%, new download logs=%', old_download_logs, new_image_download_logs;
	END IF;

	IF missing_preserved_download_log_ids <> 0 THEN
		RAISE EXCEPTION 'Image log normalization validation failed. missing download log IDs=%', missing_preserved_download_log_ids;
	END IF;

	IF image_download_logs_with_missing_image_asset <> 0 THEN
		RAISE EXCEPTION 'Image log normalization validation failed. download logs missing image_asset=%', image_download_logs_with_missing_image_asset;
	END IF;

	IF unknown_old_download_sizes <> 0 OR unknown_old_download_statuses <> 0 THEN
		RAISE EXCEPTION 'Image log normalization validation failed. unknown download sizes=%, statuses=%', unknown_old_download_sizes, unknown_old_download_statuses;
	END IF;

	IF missing_auth_user_id_count <> 0 THEN
		RAISE EXCEPTION 'Image log normalization validation failed. missing auth_user_id=%', missing_auth_user_id_count;
	END IF;
END $$;
