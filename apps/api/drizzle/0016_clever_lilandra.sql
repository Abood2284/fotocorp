CREATE TABLE "photographer_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photographer_accounts_status_check" CHECK ("photographer_accounts"."status" in ('ACTIVE', 'DISABLED', 'LOCKED'))
);
--> statement-breakpoint
ALTER TABLE "photographer_accounts" ADD CONSTRAINT "photographer_accounts_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "photographer_accounts_username_lower_uidx" ON "photographer_accounts" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "photographer_accounts_photographer_id_uidx" ON "photographer_accounts" USING btree ("photographer_id");--> statement-breakpoint
CREATE INDEX "photographer_accounts_status_idx" ON "photographer_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "photographer_accounts_created_at_idx" ON "photographer_accounts" USING btree ("created_at");