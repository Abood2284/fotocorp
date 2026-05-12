CREATE TABLE "asset_download_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_download_logs_size_check" CHECK ("asset_download_logs"."download_size" in ('WEB', 'MEDIUM', 'LARGE')),
	CONSTRAINT "asset_download_logs_status_check" CHECK ("asset_download_logs"."download_status" in ('STARTED', 'FAILED'))
);
--> statement-breakpoint
ALTER TABLE "asset_download_logs" ADD CONSTRAINT "asset_download_logs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_download_logs_asset_id_idx" ON "asset_download_logs" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_download_logs_auth_user_id_idx" ON "asset_download_logs" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "asset_download_logs_app_user_profile_id_idx" ON "asset_download_logs" USING btree ("app_user_profile_id");--> statement-breakpoint
CREATE INDEX "asset_download_logs_created_at_idx" ON "asset_download_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "asset_download_logs_status_idx" ON "asset_download_logs" USING btree ("download_status");
