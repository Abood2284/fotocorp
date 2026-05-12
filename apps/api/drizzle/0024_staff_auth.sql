CREATE TABLE "staff_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	"last_login_at" timestamptz,
	"password_updated_at" timestamptz,
	"created_by_staff_id" uuid,
	CONSTRAINT "staff_accounts_role_check" CHECK ("role" in ('SUPER_ADMIN','CATALOG_MANAGER','REVIEWER','FINANCE','SUPPORT')),
	CONSTRAINT "staff_accounts_status_check" CHECK ("status" in ('ACTIVE','DISABLED'))
);
--> statement-breakpoint
ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_created_by_staff_id_staff_accounts_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_accounts_username_lower_uidx" ON "staff_accounts" USING btree (lower("username"));
--> statement-breakpoint
CREATE INDEX "staff_accounts_status_idx" ON "staff_accounts" USING btree ("status");
--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_account_id" uuid NOT NULL,
	"session_token_hash" text NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"last_seen_at" timestamptz,
	"ip_address" text,
	"user_agent" text,
	"revoked_at" timestamptz,
	CONSTRAINT "staff_sessions_staff_account_id_staff_accounts_id_fk" FOREIGN KEY ("staff_account_id") REFERENCES "public"."staff_accounts"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_sessions_session_token_hash_uidx" ON "staff_sessions" USING btree ("session_token_hash");
--> statement-breakpoint
CREATE INDEX "staff_sessions_account_id_idx" ON "staff_sessions" USING btree ("staff_account_id");
--> statement-breakpoint
CREATE INDEX "staff_sessions_expires_at_idx" ON "staff_sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "staff_sessions_active_idx" ON "staff_sessions" USING btree ("staff_account_id","expires_at") WHERE "staff_sessions"."revoked_at" is null;
--> statement-breakpoint
CREATE TABLE "staff_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_account_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata_json" jsonb,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "staff_audit_logs_staff_account_id_staff_accounts_id_fk" FOREIGN KEY ("staff_account_id") REFERENCES "public"."staff_accounts"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "staff_audit_logs_staff_account_id_idx" ON "staff_audit_logs" USING btree ("staff_account_id");
--> statement-breakpoint
CREATE INDEX "staff_audit_logs_created_at_idx" ON "staff_audit_logs" USING btree ("created_at");
