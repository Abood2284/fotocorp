ALTER TABLE "fotocorp_user_profiles" DROP COLUMN IF EXISTS "phone_extension";
--> statement-breakpoint
ALTER TABLE "fotocorp_user_profiles" ADD COLUMN "interested_asset_types" text[] DEFAULT ARRAY[]::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "fotocorp_user_profiles" ADD COLUMN "image_quantity_range" text;
--> statement-breakpoint
ALTER TABLE "fotocorp_user_profiles" ADD COLUMN "image_quality_preference" text;
--> statement-breakpoint
CREATE TABLE "customer_access_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"interested_asset_types" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"image_quantity_range" text,
	"image_quality_preference" text,
	"staff_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_access_inquiries_status_check" CHECK ("status" in ('PENDING','IN_REVIEW','CLOSED'))
);
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD CONSTRAINT "customer_access_inquiries_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_access_inquiries_auth_user_id_idx" ON "customer_access_inquiries" USING btree ("auth_user_id");
--> statement-breakpoint
CREATE INDEX "customer_access_inquiries_status_created_idx" ON "customer_access_inquiries" USING btree ("status","created_at");
--> statement-breakpoint
CREATE TABLE "subscriber_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source_inquiry_id" uuid,
	"asset_type" text NOT NULL,
	"allowed_downloads" integer,
	"downloads_used" integer DEFAULT 0 NOT NULL,
	"quality_access" text NOT NULL,
	"status" text NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"created_by_staff_id" uuid,
	"approved_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriber_entitlements_asset_type_check" CHECK ("asset_type" in ('IMAGE','VIDEO','CARICATURE')),
	CONSTRAINT "subscriber_entitlements_status_check" CHECK ("status" in ('DRAFT','ACTIVE','EXPIRED','SUSPENDED','CANCELLED')),
	CONSTRAINT "subscriber_entitlements_quality_access_check" CHECK ("quality_access" in ('LOW','MEDIUM','HIGH')),
	CONSTRAINT "subscriber_entitlements_downloads_used_check" CHECK ("downloads_used" >= 0)
);
--> statement-breakpoint
ALTER TABLE "subscriber_entitlements" ADD CONSTRAINT "subscriber_entitlements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "subscriber_entitlements" ADD CONSTRAINT "subscriber_entitlements_source_inquiry_id_customer_access_inquiries_id_fk" FOREIGN KEY ("source_inquiry_id") REFERENCES "public"."customer_access_inquiries"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "subscriber_entitlements" ADD CONSTRAINT "subscriber_entitlements_created_by_staff_id_staff_accounts_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "subscriber_entitlements" ADD CONSTRAINT "subscriber_entitlements_approved_by_staff_id_staff_accounts_id_fk" FOREIGN KEY ("approved_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "subscriber_entitlements_user_id_idx" ON "subscriber_entitlements" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "subscriber_entitlements_status_idx" ON "subscriber_entitlements" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "subscriber_entitlements_source_inquiry_idx" ON "subscriber_entitlements" USING btree ("source_inquiry_id");
