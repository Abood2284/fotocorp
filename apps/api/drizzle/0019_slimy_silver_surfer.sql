CREATE TABLE "photographer_upload_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"photographer_account_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"common_title" text,
	"common_caption" text,
	"common_keywords" text,
	"total_files" integer DEFAULT 0 NOT NULL,
	"uploaded_files" integer DEFAULT 0 NOT NULL,
	"failed_files" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photographer_upload_batches_status_check" CHECK ("photographer_upload_batches"."status" in ('OPEN', 'SUBMITTED', 'COMPLETED', 'FAILED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "photographer_upload_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"photographer_id" uuid NOT NULL,
	"photographer_account_id" uuid NOT NULL,
	"image_asset_id" uuid,
	"original_file_name" text NOT NULL,
	"original_file_extension" text,
	"mime_type" text,
	"size_bytes" bigint,
	"storage_key" text NOT NULL,
	"upload_status" text DEFAULT 'PENDING' NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"uploaded_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photographer_upload_items_status_check" CHECK ("photographer_upload_items"."upload_status" in ('PENDING', 'UPLOADED', 'ASSET_CREATED', 'FAILED'))
);
--> statement-breakpoint
ALTER TABLE "image_assets" DROP CONSTRAINT "image_assets_status_check";--> statement-breakpoint
ALTER TABLE "image_assets" DROP CONSTRAINT "image_assets_source_check";--> statement-breakpoint
ALTER TABLE "photographer_upload_batches" ADD CONSTRAINT "photographer_upload_batches_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer_upload_batches" ADD CONSTRAINT "photographer_upload_batches_photographer_account_id_photographer_accounts_id_fk" FOREIGN KEY ("photographer_account_id") REFERENCES "public"."photographer_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer_upload_batches" ADD CONSTRAINT "photographer_upload_batches_event_id_photo_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."photo_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer_upload_items" ADD CONSTRAINT "photographer_upload_items_batch_id_photographer_upload_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."photographer_upload_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer_upload_items" ADD CONSTRAINT "photographer_upload_items_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer_upload_items" ADD CONSTRAINT "photographer_upload_items_photographer_account_id_photographer_accounts_id_fk" FOREIGN KEY ("photographer_account_id") REFERENCES "public"."photographer_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer_upload_items" ADD CONSTRAINT "photographer_upload_items_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photographer_upload_batches_photographer_id_idx" ON "photographer_upload_batches" USING btree ("photographer_id");--> statement-breakpoint
CREATE INDEX "photographer_upload_batches_account_id_idx" ON "photographer_upload_batches" USING btree ("photographer_account_id");--> statement-breakpoint
CREATE INDEX "photographer_upload_batches_event_id_idx" ON "photographer_upload_batches" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "photographer_upload_batches_status_idx" ON "photographer_upload_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "photographer_upload_batches_created_at_idx" ON "photographer_upload_batches" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "photographer_upload_items_storage_key_uidx" ON "photographer_upload_items" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "photographer_upload_items_batch_id_idx" ON "photographer_upload_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "photographer_upload_items_photographer_id_idx" ON "photographer_upload_items" USING btree ("photographer_id");--> statement-breakpoint
CREATE INDEX "photographer_upload_items_account_id_idx" ON "photographer_upload_items" USING btree ("photographer_account_id");--> statement-breakpoint
CREATE INDEX "photographer_upload_items_image_asset_id_idx" ON "photographer_upload_items" USING btree ("image_asset_id");--> statement-breakpoint
CREATE INDEX "photographer_upload_items_upload_status_idx" ON "photographer_upload_items" USING btree ("upload_status");--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_status_check" CHECK ("image_assets"."status" in ('DRAFT', 'SUBMITTED', 'ACTIVE', 'ARCHIVED', 'DELETED', 'MISSING_ORIGINAL', 'UNKNOWN'));--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_source_check" CHECK ("image_assets"."source" in ('LEGACY_IMPORT', 'MANUAL', 'PHOTOGRAPHER_UPLOAD'));