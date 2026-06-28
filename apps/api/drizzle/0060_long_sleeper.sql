CREATE TABLE "image_preview_regeneration_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_asset_id" uuid NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"requested_by_staff_id" uuid,
	"failure_code" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_preview_regeneration_jobs_status_check" CHECK ("image_preview_regeneration_jobs"."status" in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'))
);
--> statement-breakpoint
ALTER TABLE "image_preview_regeneration_jobs" ADD CONSTRAINT "image_preview_regeneration_jobs_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_preview_regeneration_jobs" ADD CONSTRAINT "image_preview_regeneration_jobs_requested_by_staff_id_staff_members_id_fk" FOREIGN KEY ("requested_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_preview_regeneration_jobs_status_idx" ON "image_preview_regeneration_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "image_preview_regeneration_jobs_image_asset_id_idx" ON "image_preview_regeneration_jobs" USING btree ("image_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "image_preview_regeneration_jobs_image_asset_id_active_uidx" ON "image_preview_regeneration_jobs" USING btree ("image_asset_id") WHERE "image_preview_regeneration_jobs"."status" in ('QUEUED', 'RUNNING');
