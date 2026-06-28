CREATE TABLE IF NOT EXISTS "help_contextual_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"context_key" text NOT NULL,
	"article_id" uuid NOT NULL,
	"label" text,
	"description" text,
	"placement" text DEFAULT 'PAGE_HEADER' NOT NULL,
	"display_order" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_staff_id" uuid NOT NULL,
	"updated_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_contextual_links_placement_check" CHECK ("help_contextual_links"."placement" in ('PAGE_HEADER','SIDEBAR_CARD','INLINE_PANEL'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "help_contextual_links" ADD CONSTRAINT "help_contextual_links_article_id_help_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."help_articles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "help_contextual_links" ADD CONSTRAINT "help_contextual_links_created_by_staff_id_staff_members_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "help_contextual_links" ADD CONSTRAINT "help_contextual_links_updated_by_staff_id_staff_members_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "help_contextual_links_context_article_uidx" ON "help_contextual_links" USING btree ("context_key","article_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_contextual_links_context_key_idx" ON "help_contextual_links" USING btree ("context_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_contextual_links_article_id_idx" ON "help_contextual_links" USING btree ("article_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_contextual_links_is_active_idx" ON "help_contextual_links" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_contextual_links_context_active_order_idx" ON "help_contextual_links" USING btree ("context_key","is_active","display_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_contextual_links_created_by_staff_id_idx" ON "help_contextual_links" USING btree ("created_by_staff_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "help_contextual_links_updated_by_staff_id_idx" ON "help_contextual_links" USING btree ("updated_by_staff_id");
