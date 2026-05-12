CREATE TABLE "fotokey_daily_counters" (
	"code_date" date PRIMARY KEY NOT NULL,
	"last_sequence" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_publish_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text DEFAULT 'PHOTOGRAPHER_APPROVAL' NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"requested_by_admin_user_id" text,
	"total_items" integer DEFAULT 0 NOT NULL,
	"completed_items" integer DEFAULT 0 NOT NULL,
	"failed_items" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_publish_jobs_status_check" CHECK ("image_publish_jobs"."status" in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL_FAILED'))
);
--> statement-breakpoint
CREATE TABLE "image_publish_job_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"image_asset_id" uuid NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"fotokey" text NOT NULL,
	"canonical_original_key" text NOT NULL,
	"source_bucket" text NOT NULL,
	"source_storage_key" text NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_publish_job_items_status_check" CHECK ("image_publish_job_items"."status" in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'))
);
--> statement-breakpoint
ALTER TABLE "image_assets" DROP CONSTRAINT "image_assets_status_check";--> statement-breakpoint
ALTER TABLE "image_assets" ADD COLUMN "fotokey" text;--> statement-breakpoint
ALTER TABLE "image_assets" ADD COLUMN "fotokey_date" date;--> statement-breakpoint
ALTER TABLE "image_assets" ADD COLUMN "fotokey_sequence" bigint;--> statement-breakpoint
ALTER TABLE "image_assets" ADD COLUMN "fotokey_assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "image_publish_job_items" ADD CONSTRAINT "image_publish_job_items_job_id_image_publish_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."image_publish_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_publish_job_items" ADD CONSTRAINT "image_publish_job_items_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_publish_jobs_status_idx" ON "image_publish_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "image_publish_job_items_job_id_idx" ON "image_publish_job_items" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "image_publish_job_items_image_asset_id_idx" ON "image_publish_job_items" USING btree ("image_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "image_publish_job_items_image_asset_id_active_uidx" ON "image_publish_job_items" USING btree ("image_asset_id") WHERE "image_publish_job_items"."status" in ('QUEUED', 'RUNNING');--> statement-breakpoint
CREATE UNIQUE INDEX "image_assets_fotokey_uidx" ON "image_assets" USING btree ("fotokey") WHERE "image_assets"."fotokey" is not null;--> statement-breakpoint
CREATE INDEX "image_assets_fotokey_date_sequence_idx" ON "image_assets" USING btree ("fotokey_date","fotokey_sequence") WHERE "image_assets"."fotokey" is not null;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_status_check" CHECK ("image_assets"."status" in ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'ARCHIVED', 'DELETED', 'MISSING_ORIGINAL', 'UNKNOWN'));