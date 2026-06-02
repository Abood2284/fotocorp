ALTER TABLE "public_creative_featured_items" RENAME TO "public_royalty_free_featured_items";--> statement-breakpoint
ALTER TABLE "public_royalty_free_featured_items" DROP CONSTRAINT "public_creative_featured_items_period_key_check";--> statement-breakpoint
ALTER TABLE "public_royalty_free_featured_items" DROP CONSTRAINT "public_creative_featured_items_rank_check";--> statement-breakpoint
ALTER TABLE "public_royalty_free_featured_items" DROP CONSTRAINT "public_creative_featured_items_status_check";--> statement-breakpoint
ALTER TABLE "public_royalty_free_featured_items" DROP CONSTRAINT "public_creative_featured_items_asset_id_image_assets_id_fk";
--> statement-breakpoint
DROP INDEX "public_creative_featured_items_period_rank_uidx";--> statement-breakpoint
DROP INDEX "public_creative_featured_items_period_asset_uidx";--> statement-breakpoint
DROP INDEX "public_creative_featured_items_active_period_rank_idx";--> statement-breakpoint
ALTER TABLE "public_royalty_free_featured_items" ADD CONSTRAINT "public_royalty_free_featured_items_asset_id_image_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_royalty_free_featured_items_period_rank_uidx" ON "public_royalty_free_featured_items" USING btree ("period_key","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "public_royalty_free_featured_items_period_asset_uidx" ON "public_royalty_free_featured_items" USING btree ("period_key","asset_id");--> statement-breakpoint
CREATE INDEX "public_royalty_free_featured_items_active_period_rank_idx" ON "public_royalty_free_featured_items" USING btree ("period_key","rank") WHERE "public_royalty_free_featured_items"."status" = 'ACTIVE';--> statement-breakpoint
ALTER TABLE "public_royalty_free_featured_items" ADD CONSTRAINT "public_royalty_free_featured_items_period_key_check" CHECK ("public_royalty_free_featured_items"."period_key" ~ '^[0-9]{4}-[0-9]{2}$');--> statement-breakpoint
ALTER TABLE "public_royalty_free_featured_items" ADD CONSTRAINT "public_royalty_free_featured_items_rank_check" CHECK ("public_royalty_free_featured_items"."rank" > 0);--> statement-breakpoint
ALTER TABLE "public_royalty_free_featured_items" ADD CONSTRAINT "public_royalty_free_featured_items_status_check" CHECK ("public_royalty_free_featured_items"."status" in ('ACTIVE', 'INACTIVE'));