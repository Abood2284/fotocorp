CREATE TABLE "asset_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_category_code" integer,
	"name" text NOT NULL,
	"slug" text,
	"parent_legacy_category_code" integer,
	"include_file" text,
	"legacy_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_categories_legacy_category_code_unique" UNIQUE("legacy_category_code")
);
--> statement-breakpoint
CREATE TABLE "asset_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_event_id" bigint,
	"name" text,
	"event_date" timestamp with time zone,
	"country" text,
	"state" text,
	"city" text,
	"location" text,
	"keywords" text,
	"photo_count" bigint,
	"photo_count_unpublished" bigint,
	"small_image_1" text,
	"small_image_2" text,
	"legacy_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_events_legacy_event_id_unique" UNIQUE("legacy_event_id")
);
--> statement-breakpoint
CREATE TABLE "asset_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" text NOT NULL,
	"source_table" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"inserted_rows" integer DEFAULT 0 NOT NULL,
	"updated_rows" integer DEFAULT 0 NOT NULL,
	"r2_matched_rows" integer DEFAULT 0 NOT NULL,
	"r2_missing_rows" integer DEFAULT 0 NOT NULL,
	"duplicate_imagecode_rows" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_import_batches_status_check" CHECK ("asset_import_batches"."status" in ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ISSUES', 'FAILED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "asset_import_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"legacy_source" text,
	"legacy_srno" bigint,
	"legacy_imagecode" text,
	"issue_type" text NOT NULL,
	"severity" text DEFAULT 'WARNING' NOT NULL,
	"message" text NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_import_issues_issue_type_check" CHECK ("asset_import_issues"."issue_type" in ('MISSING_R2_OBJECT', 'DUPLICATE_IMAGECODE', 'MISSING_EVENT', 'MISSING_CATEGORY', 'MISSING_PHOTOGRAPHER', 'INVALID_DATE', 'UNKNOWN_STATUS', 'IMPORT_ERROR')),
	CONSTRAINT "asset_import_issues_severity_check" CHECK ("asset_import_issues"."severity" in ('INFO', 'WARNING', 'ERROR'))
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_source" text,
	"legacy_srno" bigint,
	"legacy_event_id" bigint,
	"legacy_imagecode" text,
	"r2_original_key" text,
	"original_filename" text,
	"original_ext" text,
	"r2_exists" boolean DEFAULT false NOT NULL,
	"r2_checked_at" timestamp with time zone,
	"title" text,
	"caption" text,
	"headline" text,
	"keywords" text,
	"event_keywords" text,
	"image_location" text,
	"search_text" text,
	"image_date" timestamp with time zone,
	"uploaded_at" timestamp with time zone,
	"legacy_status" integer,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"visibility" text DEFAULT 'PRIVATE' NOT NULL,
	"media_type" text DEFAULT 'IMAGE' NOT NULL,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"category_id" uuid,
	"photographer_profile_id" uuid,
	"event_id" uuid,
	"legacy_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_legacy_source_legacy_srno_unique" UNIQUE("legacy_source","legacy_srno"),
	CONSTRAINT "assets_status_check" CHECK ("assets"."status" in ('DRAFT', 'REVIEW', 'APPROVED', 'READY', 'PUBLISHED', 'ARCHIVED', 'REJECTED')),
	CONSTRAINT "assets_visibility_check" CHECK ("assets"."visibility" in ('PRIVATE', 'PUBLIC', 'UNLISTED')),
	CONSTRAINT "assets_media_type_check" CHECK ("assets"."media_type" in ('IMAGE', 'VIDEO', 'OTHER')),
	CONSTRAINT "assets_source_check" CHECK ("assets"."source" in ('MANUAL', 'LEGACY_IMPORT', 'ADMIN_UPLOAD', 'PHOTOGRAPHER_UPLOAD'))
);
--> statement-breakpoint
CREATE TABLE "photographer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"legacy_photographer_id" bigint,
	"display_name" text NOT NULL,
	"email" text,
	"phone" text,
	"city" text,
	"state" text,
	"country" text,
	"profile_source" text DEFAULT 'MANUAL' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"legacy_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photographer_profiles_legacy_photographer_id_unique" UNIQUE("legacy_photographer_id"),
	CONSTRAINT "photographer_profiles_profile_source_check" CHECK ("photographer_profiles"."profile_source" in ('MANUAL', 'LEGACY_IMPORT')),
	CONSTRAINT "photographer_profiles_status_check" CHECK ("photographer_profiles"."status" in ('ACTIVE', 'INACTIVE', 'LEGACY_ONLY', 'SUSPENDED'))
);
--> statement-breakpoint
ALTER TABLE "asset_import_issues" ADD CONSTRAINT "asset_import_issues_batch_id_asset_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."asset_import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_photographer_profile_id_photographer_profiles_id_fk" FOREIGN KEY ("photographer_profile_id") REFERENCES "public"."photographer_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_event_id_asset_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."asset_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_categories_name_idx" ON "asset_categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "asset_categories_parent_legacy_category_code_idx" ON "asset_categories" USING btree ("parent_legacy_category_code");--> statement-breakpoint
CREATE INDEX "asset_events_legacy_event_id_idx" ON "asset_events" USING btree ("legacy_event_id");--> statement-breakpoint
CREATE INDEX "asset_events_event_date_idx" ON "asset_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "asset_import_batches_status_idx" ON "asset_import_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "asset_import_batches_source_table_idx" ON "asset_import_batches" USING btree ("source_table");--> statement-breakpoint
CREATE INDEX "asset_import_issues_batch_id_idx" ON "asset_import_issues" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "asset_import_issues_issue_type_idx" ON "asset_import_issues" USING btree ("issue_type");--> statement-breakpoint
CREATE INDEX "asset_import_issues_severity_idx" ON "asset_import_issues" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "asset_import_issues_legacy_imagecode_idx" ON "asset_import_issues" USING btree ("legacy_imagecode");--> statement-breakpoint
CREATE INDEX "assets_legacy_imagecode_idx" ON "assets" USING btree ("legacy_imagecode");--> statement-breakpoint
CREATE INDEX "assets_r2_original_key_idx" ON "assets" USING btree ("r2_original_key");--> statement-breakpoint
CREATE INDEX "assets_r2_exists_idx" ON "assets" USING btree ("r2_exists");--> statement-breakpoint
CREATE INDEX "assets_status_idx" ON "assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assets_visibility_idx" ON "assets" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "assets_source_idx" ON "assets" USING btree ("source");--> statement-breakpoint
CREATE INDEX "assets_legacy_status_idx" ON "assets" USING btree ("legacy_status");--> statement-breakpoint
CREATE INDEX "assets_event_id_idx" ON "assets" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "assets_category_id_idx" ON "assets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "assets_photographer_profile_id_idx" ON "assets" USING btree ("photographer_profile_id");--> statement-breakpoint
CREATE INDEX "assets_image_date_idx" ON "assets" USING btree ("image_date");--> statement-breakpoint
CREATE INDEX "assets_uploaded_at_idx" ON "assets" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "photographer_profiles_user_id_idx" ON "photographer_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "photographer_profiles_status_idx" ON "photographer_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "photographer_profiles_profile_source_idx" ON "photographer_profiles" USING btree ("profile_source");