CREATE TABLE "asset_media_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid,
	"derivative_id" uuid,
	"variant" text,
	"requester_user_id" text,
	"requester_role" text,
	"ip_hash" text,
	"user_agent" text,
	"status_code" integer NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_media_access_logs_outcome_check" CHECK ("asset_media_access_logs"."outcome" in ('SERVED', 'NOT_FOUND', 'PREVIEW_NOT_READY', 'UNAUTHORIZED', 'FORBIDDEN', 'INVALID_TOKEN', 'R2_ERROR'))
);
--> statement-breakpoint
CREATE TABLE "asset_media_derivatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"variant" text NOT NULL,
	"r2_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"byte_size" bigint,
	"checksum" text,
	"is_watermarked" boolean DEFAULT true NOT NULL,
	"watermark_profile" text,
	"generation_status" text DEFAULT 'READY' NOT NULL,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_media_derivatives_asset_id_variant_unique" UNIQUE("asset_id","variant"),
	CONSTRAINT "asset_media_derivatives_variant_check" CHECK ("asset_media_derivatives"."variant" in ('thumb', 'card', 'detail')),
	CONSTRAINT "asset_media_derivatives_generation_status_check" CHECK ("asset_media_derivatives"."generation_status" in ('READY', 'STALE', 'FAILED'))
);
--> statement-breakpoint
ALTER TABLE "asset_media_access_logs" ADD CONSTRAINT "asset_media_access_logs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_media_access_logs" ADD CONSTRAINT "asset_media_access_logs_derivative_id_asset_media_derivatives_id_fk" FOREIGN KEY ("derivative_id") REFERENCES "public"."asset_media_derivatives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_media_derivatives" ADD CONSTRAINT "asset_media_derivatives_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_media_access_logs_asset_id_idx" ON "asset_media_access_logs" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_media_access_logs_derivative_id_idx" ON "asset_media_access_logs" USING btree ("derivative_id");--> statement-breakpoint
CREATE INDEX "asset_media_access_logs_outcome_idx" ON "asset_media_access_logs" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "asset_media_access_logs_created_at_idx" ON "asset_media_access_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "asset_media_derivatives_asset_id_idx" ON "asset_media_derivatives" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_media_derivatives_variant_idx" ON "asset_media_derivatives" USING btree ("variant");--> statement-breakpoint
CREATE INDEX "asset_media_derivatives_generation_status_idx" ON "asset_media_derivatives" USING btree ("generation_status");