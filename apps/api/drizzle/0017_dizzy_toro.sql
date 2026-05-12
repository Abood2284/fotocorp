CREATE TABLE "photographer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_account_id" uuid NOT NULL,
	"photographer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "photographer_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "photographer_sessions" ADD CONSTRAINT "photographer_sessions_photographer_account_id_photographer_accounts_id_fk" FOREIGN KEY ("photographer_account_id") REFERENCES "public"."photographer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer_sessions" ADD CONSTRAINT "photographer_sessions_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "photographer_sessions_token_hash_uidx" ON "photographer_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "photographer_sessions_account_id_idx" ON "photographer_sessions" USING btree ("photographer_account_id");--> statement-breakpoint
CREATE INDEX "photographer_sessions_photographer_id_idx" ON "photographer_sessions" USING btree ("photographer_id");--> statement-breakpoint
CREATE INDEX "photographer_sessions_expires_at_idx" ON "photographer_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "photographer_sessions_active_idx" ON "photographer_sessions" USING btree ("photographer_account_id","expires_at") WHERE "photographer_sessions"."revoked_at" is null;