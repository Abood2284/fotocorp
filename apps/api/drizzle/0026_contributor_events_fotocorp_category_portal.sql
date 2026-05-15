ALTER TABLE "photo_events" DROP CONSTRAINT IF EXISTS "photo_events_source_check";
--> statement-breakpoint
UPDATE "photo_events" SET "source" = 'Fotocorp' WHERE "source" = 'CONTRIBUTOR';
--> statement-breakpoint
ALTER TABLE "photo_events" ADD CONSTRAINT "photo_events_source_check" CHECK ("photo_events"."source" in ('LEGACY_IMPORT', 'MANUAL', 'CONTRIBUTOR', 'Fotocorp'));
--> statement-breakpoint
ALTER TABLE "photo_events" ADD COLUMN "category_id" uuid;
--> statement-breakpoint
ALTER TABLE "photo_events" ADD CONSTRAINT "photo_events_category_id_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "photo_events_category_id_idx" ON "photo_events" USING btree ("category_id");
--> statement-breakpoint
ALTER TABLE "contributor_accounts" ADD COLUMN "portal_role" text DEFAULT 'STANDARD' NOT NULL;
--> statement-breakpoint
ALTER TABLE "contributor_accounts" ADD CONSTRAINT "contributor_accounts_portal_role_check" CHECK ("portal_role" in ('STANDARD', 'PORTAL_ADMIN'));
