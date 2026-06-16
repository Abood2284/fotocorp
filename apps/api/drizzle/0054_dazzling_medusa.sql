CREATE TABLE "caricature_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caricature_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"headline" text NOT NULL,
	"slug" text,
	"description" text NOT NULL,
	"credit" text NOT NULL,
	"category_id" uuid NOT NULL,
	"language" text NOT NULL,
	"language_other" text,
	"visible_text" text,
	"visible_text_translation_en" text,
	"has_visible_text" boolean NOT NULL,
	"keywords" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"depicted_subjects" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"visibility" text DEFAULT 'PRIVATE' NOT NULL,
	"original_bucket" text,
	"original_object_key" text,
	"original_filename" text,
	"mime_type" text,
	"file_size_bytes" bigint,
	"width" integer,
	"height" integer,
	"checksum" text,
	"created_by_staff_id" uuid,
	"updated_by_staff_id" uuid,
	"published_by_staff_id" uuid,
	"published_record_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caricature_assets_language_check" CHECK ("caricature_assets"."language" in ('NO_VISIBLE_TEXT', 'ENGLISH', 'HINDI', 'MARATHI', 'URDU', 'MIXED', 'OTHER')),
	CONSTRAINT "caricature_assets_status_check" CHECK ("caricature_assets"."status" in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED')),
	CONSTRAINT "caricature_assets_visibility_check" CHECK ("caricature_assets"."visibility" in ('PRIVATE', 'PUBLIC'))
);
--> statement-breakpoint
CREATE TABLE "caricature_derivatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caricature_id" uuid NOT NULL,
	"derivative_type" text NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"public_url" text,
	"format" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"file_size_bytes" bigint,
	"blur_version" text,
	"watermark_version" text,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"error_message" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caricature_derivatives_type_check" CHECK ("caricature_derivatives"."derivative_type" in ('BLURRED_CARD', 'BLURRED_DETAIL')),
	CONSTRAINT "caricature_derivatives_status_check" CHECK ("caricature_derivatives"."status" in ('QUEUED', 'GENERATING', 'READY', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "caricature_download_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caricature_id" uuid NOT NULL,
	"user_id" uuid,
	"customer_id" uuid,
	"entitlement_id" uuid,
	"download_format" text DEFAULT 'ORIGINAL' NOT NULL,
	"status" text NOT NULL,
	"failure_reason" text,
	"request_ip_hash" text,
	"request_country" varchar(2),
	"request_region" text,
	"request_city" text,
	"request_user_agent" text,
	"request_cf_ray" text,
	"downloaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caricature_download_logs_format_check" CHECK ("caricature_download_logs"."download_format" in ('ORIGINAL')),
	CONSTRAINT "caricature_download_logs_status_check" CHECK ("caricature_download_logs"."status" in ('STARTED', 'COMPLETED', 'FAILED'))
);
--> statement-breakpoint
ALTER TABLE "caricature_assets" ADD CONSTRAINT "caricature_assets_category_id_caricature_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."caricature_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caricature_assets" ADD CONSTRAINT "caricature_assets_created_by_staff_id_staff_members_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caricature_assets" ADD CONSTRAINT "caricature_assets_updated_by_staff_id_staff_members_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caricature_assets" ADD CONSTRAINT "caricature_assets_published_by_staff_id_staff_members_id_fk" FOREIGN KEY ("published_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caricature_derivatives" ADD CONSTRAINT "caricature_derivatives_caricature_id_caricature_assets_id_fk" FOREIGN KEY ("caricature_id") REFERENCES "public"."caricature_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caricature_download_logs" ADD CONSTRAINT "caricature_download_logs_caricature_id_caricature_assets_id_fk" FOREIGN KEY ("caricature_id") REFERENCES "public"."caricature_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caricature_download_logs" ADD CONSTRAINT "caricature_download_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caricature_download_logs" ADD CONSTRAINT "caricature_download_logs_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caricature_download_logs" ADD CONSTRAINT "caricature_download_logs_entitlement_id_subscriber_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."subscriber_entitlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "caricature_categories_slug_uidx" ON "caricature_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "caricature_categories_is_active_sort_order_idx" ON "caricature_categories" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "caricature_assets_slug_uidx" ON "caricature_assets" USING btree ("slug") WHERE "caricature_assets"."slug" is not null;--> statement-breakpoint
CREATE INDEX "caricature_assets_category_id_idx" ON "caricature_assets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "caricature_assets_status_visibility_idx" ON "caricature_assets" USING btree ("status","visibility");--> statement-breakpoint
CREATE INDEX "caricature_assets_language_idx" ON "caricature_assets" USING btree ("language");--> statement-breakpoint
CREATE INDEX "caricature_assets_has_visible_text_idx" ON "caricature_assets" USING btree ("has_visible_text");--> statement-breakpoint
CREATE INDEX "caricature_assets_published_at_idx" ON "caricature_assets" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "caricature_assets_credit_idx" ON "caricature_assets" USING btree ("credit");--> statement-breakpoint
CREATE INDEX "caricature_assets_deleted_at_idx" ON "caricature_assets" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "caricature_derivatives_caricature_id_type_uidx" ON "caricature_derivatives" USING btree ("caricature_id","derivative_type");--> statement-breakpoint
CREATE INDEX "caricature_derivatives_caricature_id_idx" ON "caricature_derivatives" USING btree ("caricature_id");--> statement-breakpoint
CREATE INDEX "caricature_derivatives_status_idx" ON "caricature_derivatives" USING btree ("status");--> statement-breakpoint
CREATE INDEX "caricature_download_logs_caricature_id_idx" ON "caricature_download_logs" USING btree ("caricature_id");--> statement-breakpoint
CREATE INDEX "caricature_download_logs_user_id_idx" ON "caricature_download_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "caricature_download_logs_status_idx" ON "caricature_download_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "caricature_download_logs_downloaded_at_idx" ON "caricature_download_logs" USING btree ("downloaded_at");--> statement-breakpoint
CREATE INDEX "caricature_download_logs_request_ip_hash_idx" ON "caricature_download_logs" USING btree ("request_ip_hash");