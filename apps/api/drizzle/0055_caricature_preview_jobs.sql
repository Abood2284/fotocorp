CREATE TABLE "caricature_preview_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caricature_asset_id" uuid NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"publish_on_success" boolean DEFAULT true NOT NULL,
	"requested_by_staff_id" uuid,
	"failure_code" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caricature_preview_jobs_status_check" CHECK ("caricature_preview_jobs"."status" in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'))
);
--> statement-breakpoint
ALTER TABLE "caricature_preview_jobs" ADD CONSTRAINT "caricature_preview_jobs_caricature_asset_id_caricature_assets_id_fk" FOREIGN KEY ("caricature_asset_id") REFERENCES "public"."caricature_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caricature_preview_jobs" ADD CONSTRAINT "caricature_preview_jobs_requested_by_staff_id_staff_members_id_fk" FOREIGN KEY ("requested_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "caricature_preview_jobs_status_idx" ON "caricature_preview_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "caricature_preview_jobs_caricature_asset_id_idx" ON "caricature_preview_jobs" USING btree ("caricature_asset_id");
