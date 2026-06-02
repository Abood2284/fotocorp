CREATE TABLE "public_homepage_hero_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_key" text NOT NULL,
	"active_from" timestamp with time zone NOT NULL,
	"active_until" timestamp with time zone NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"generation_run_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_homepage_hero_sets_active_window_check" CHECK ("public_homepage_hero_sets"."active_until" > "public_homepage_hero_sets"."active_from")
);
--> statement-breakpoint
CREATE TABLE "public_homepage_hero_set_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"asset_id" uuid NOT NULL,
	"preview_url" text NOT NULL,
	"title" text NOT NULL,
	"event_id" uuid,
	"event_name" text,
	"fotokey" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_homepage_hero_set_items_slot_check" CHECK ("public_homepage_hero_set_items"."slot" > 0)
);
--> statement-breakpoint
ALTER TABLE "public_homepage_hero_set_items" ADD CONSTRAINT "public_homepage_hero_set_items_set_id_public_homepage_hero_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."public_homepage_hero_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_homepage_hero_set_items" ADD CONSTRAINT "public_homepage_hero_set_items_asset_id_image_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_homepage_hero_sets_set_key_uidx" ON "public_homepage_hero_sets" USING btree ("set_key");--> statement-breakpoint
CREATE INDEX "public_homepage_hero_sets_active_window_idx" ON "public_homepage_hero_sets" USING btree ("active_from","active_until");--> statement-breakpoint
CREATE UNIQUE INDEX "public_homepage_hero_set_items_set_slot_uidx" ON "public_homepage_hero_set_items" USING btree ("set_id","slot");--> statement-breakpoint
CREATE INDEX "public_homepage_hero_set_items_set_slot_idx" ON "public_homepage_hero_set_items" USING btree ("set_id","slot");