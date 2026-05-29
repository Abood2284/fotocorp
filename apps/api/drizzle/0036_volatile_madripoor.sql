CREATE TABLE "public_creative_featured_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"rank" integer NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_creative_featured_items_period_key_check" CHECK ("public_creative_featured_items"."period_key" ~ '^[0-9]{4}-[0-9]{2}$'),
	CONSTRAINT "public_creative_featured_items_rank_check" CHECK ("public_creative_featured_items"."rank" > 0),
	CONSTRAINT "public_creative_featured_items_status_check" CHECK ("public_creative_featured_items"."status" in ('ACTIVE', 'INACTIVE'))
);
--> statement-breakpoint
ALTER TABLE "public_creative_featured_items" ADD CONSTRAINT "public_creative_featured_items_asset_id_image_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_creative_featured_items_period_rank_uidx" ON "public_creative_featured_items" USING btree ("period_key","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "public_creative_featured_items_period_asset_uidx" ON "public_creative_featured_items" USING btree ("period_key","asset_id");--> statement-breakpoint
CREATE INDEX "public_creative_featured_items_active_period_rank_idx" ON "public_creative_featured_items" USING btree ("period_key","rank") WHERE "public_creative_featured_items"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "public_event_feed_items_public_event_date_idx" ON "public_event_feed_items" USING btree ("event_date","event_id") WHERE "public_event_feed_items"."is_public" = true and "public_event_feed_items"."event_date" is not null;