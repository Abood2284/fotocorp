CREATE TABLE "auth_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"login_identifier" text NOT NULL,
	"identifier_type" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"must_reset_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"password_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_credentials_owner_type_check" CHECK ("auth_credentials"."owner_type" in ('USER', 'STAFF', 'CONTRIBUTOR')),
	CONSTRAINT "auth_credentials_identifier_type_check" CHECK ("auth_credentials"."identifier_type" in ('USERNAME', 'EMAIL')),
	CONSTRAINT "auth_credentials_status_check" CHECK ("auth_credentials"."status" in ('ACTIVE', 'DISABLED', 'LOCKED'))
);
--> statement-breakpoint
CREATE TABLE "auth_identity_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_type" text NOT NULL,
	"normalized_value" text NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identity_claims_claim_type_check" CHECK ("auth_identity_claims"."claim_type" in ('USERNAME', 'EMAIL', 'PHONE')),
	CONSTRAINT "auth_identity_claims_owner_type_check" CHECK ("auth_identity_claims"."owner_type" in ('USER', 'STAFF', 'CONTRIBUTOR')),
	CONSTRAINT "auth_identity_claims_status_check" CHECK ("auth_identity_claims"."status" in ('PENDING', 'ACTIVE', 'RELEASED'))
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credential_id" uuid NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"session_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "auth_sessions_owner_type_check" CHECK ("auth_sessions"."owner_type" in ('USER', 'STAFF', 'CONTRIBUTOR'))
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"email" text,
	"phone_country_code" text,
	"phone_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_by_staff_member_id" uuid,
	CONSTRAINT "staff_members_role_check" CHECK ("staff_members"."role" in ('SUPER_ADMIN','CATALOG_MANAGER','REVIEWER','CAPTION_MANAGER','FINANCE','SUPPORT')),
	CONSTRAINT "staff_members_status_check" CHECK ("staff_members"."status" in ('ACTIVE','DISABLED'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"company_type" text NOT NULL,
	"company_name" text NOT NULL,
	"job_title" text NOT NULL,
	"custom_job_title" text,
	"company_email" text NOT NULL,
	"company_email_domain" text NOT NULL,
	"email_validation_decision" text NOT NULL,
	"phone_country_code" text NOT NULL,
	"phone_number" text NOT NULL,
	"interested_asset_types" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"image_quantity_range" text,
	"image_quality_preference" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"is_subscriber" boolean DEFAULT false NOT NULL,
	"subscription_status" text DEFAULT 'NONE' NOT NULL,
	"subscription_plan_id" text,
	"subscription_started_at" timestamp with time zone,
	"subscription_ends_at" timestamp with time zone,
	"download_quota_limit" integer,
	"download_quota_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_status_check" CHECK ("users"."status" in ('ACTIVE', 'SUSPENDED')),
	CONSTRAINT "users_subscription_status_check" CHECK ("users"."subscription_status" in ('NONE', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED')),
	CONSTRAINT "users_download_quota_used_check" CHECK ("users"."download_quota_used" >= 0)
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_credential_id_auth_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."auth_credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_created_by_staff_member_id_staff_members_id_fk" FOREIGN KEY ("created_by_staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_credentials_login_identifier_lower_uidx" ON "auth_credentials" USING btree ("identifier_type",lower("login_identifier"));--> statement-breakpoint
CREATE UNIQUE INDEX "auth_credentials_owner_identifier_type_uidx" ON "auth_credentials" USING btree ("owner_type","owner_id","identifier_type");--> statement-breakpoint
CREATE INDEX "auth_credentials_owner_idx" ON "auth_credentials" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "auth_credentials_status_idx" ON "auth_credentials" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identity_claims_type_value_uidx" ON "auth_identity_claims" USING btree ("claim_type","normalized_value");--> statement-breakpoint
CREATE INDEX "auth_identity_claims_owner_idx" ON "auth_identity_claims" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "auth_identity_claims_status_idx" ON "auth_identity_claims" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_session_token_hash_uidx" ON "auth_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_credential_id_idx" ON "auth_sessions" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_owner_idx" ON "auth_sessions" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_active_idx" ON "auth_sessions" USING btree ("owner_type","owner_id","expires_at") WHERE "auth_sessions"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "staff_members_status_idx" ON "staff_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "staff_members_role_idx" ON "staff_members" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_uidx" ON "users" USING btree (lower("username")) WHERE "users"."username" is not null;--> statement-breakpoint
CREATE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_company_email_idx" ON "users" USING btree ("company_email");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_subscription_status_idx" ON "users" USING btree ("subscription_status");--> statement-breakpoint
CREATE INDEX "users_is_subscriber_idx" ON "users" USING btree ("is_subscriber");