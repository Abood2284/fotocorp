CREATE TABLE "asset_original_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"original_width" integer,
	"original_height" integer,
	"display_width" integer,
	"display_height" integer,
	"original_long_edge" integer,
	"original_short_edge" integer,
	"original_megapixels" numeric(10, 4),
	"original_dpi" integer,
	"original_resolution_unit" text,
	"original_format" text,
	"original_size_bytes" bigint,
	"original_color_space" text,
	"original_channels" integer,
	"original_bit_depth" integer,
	"original_has_alpha" boolean DEFAULT false NOT NULL,
	"original_orientation" integer,
	"original_has_profile" boolean DEFAULT false NOT NULL,
	"original_has_exif" boolean DEFAULT false NOT NULL,
	"original_has_iptc" boolean DEFAULT false NOT NULL,
	"original_has_xmp" boolean DEFAULT false NOT NULL,
	"source_quality_bucket" text DEFAULT 'UNKNOWN' NOT NULL,
	"download_quality_ceiling" text DEFAULT 'UNKNOWN' NOT NULL,
	"can_generate_medium" boolean DEFAULT false NOT NULL,
	"can_generate_low" boolean DEFAULT false NOT NULL,
	"technical_metadata_scanned_at" timestamp with time zone,
	"metadata_scan_status" text DEFAULT 'PENDING' NOT NULL,
	"metadata_scan_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_original_metadata_scan_status_check" CHECK ("asset_original_metadata"."metadata_scan_status" in ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED')),
	CONSTRAINT "asset_original_metadata_source_quality_bucket_check" CHECK ("asset_original_metadata"."source_quality_bucket" in ('LOW_SOURCE', 'STANDARD_SOURCE', 'HIGH_SOURCE', 'VERY_HIGH_SOURCE', 'UNKNOWN')),
	CONSTRAINT "asset_original_metadata_download_quality_ceiling_check" CHECK ("asset_original_metadata"."download_quality_ceiling" in ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'))
);
--> statement-breakpoint
ALTER TABLE "asset_original_metadata" ADD CONSTRAINT "asset_original_metadata_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_original_metadata_asset_id_uidx" ON "asset_original_metadata" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_original_metadata_metadata_scan_status_idx" ON "asset_original_metadata" USING btree ("metadata_scan_status");--> statement-breakpoint
CREATE INDEX "asset_original_metadata_source_quality_bucket_idx" ON "asset_original_metadata" USING btree ("source_quality_bucket");--> statement-breakpoint
CREATE INDEX "asset_original_metadata_download_quality_ceiling_idx" ON "asset_original_metadata" USING btree ("download_quality_ceiling");