ALTER TABLE "photo_events" DROP CONSTRAINT "photo_events_source_check";--> statement-breakpoint
ALTER TABLE "photo_events" ADD COLUMN "created_by_photographer_id" uuid;--> statement-breakpoint
ALTER TABLE "photo_events" ADD COLUMN "created_by_photographer_account_id" uuid;--> statement-breakpoint
ALTER TABLE "photo_events" ADD COLUMN "created_by_source" text DEFAULT 'LEGACY_IMPORT' NOT NULL;--> statement-breakpoint
ALTER TABLE "photo_events" ADD CONSTRAINT "photo_events_created_by_photographer_id_photographers_id_fk" FOREIGN KEY ("created_by_photographer_id") REFERENCES "public"."photographers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_events" ADD CONSTRAINT "photo_events_created_by_photographer_account_id_photographer_accounts_id_fk" FOREIGN KEY ("created_by_photographer_account_id") REFERENCES "public"."photographer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_events_created_by_photographer_id_idx" ON "photo_events" USING btree ("created_by_photographer_id");--> statement-breakpoint
CREATE INDEX "photo_events_created_by_photographer_account_id_idx" ON "photo_events" USING btree ("created_by_photographer_account_id");--> statement-breakpoint
CREATE INDEX "photo_events_created_by_source_idx" ON "photo_events" USING btree ("created_by_source");--> statement-breakpoint
ALTER TABLE "photo_events" ADD CONSTRAINT "photo_events_created_by_source_check" CHECK ("photo_events"."created_by_source" in ('LEGACY_IMPORT', 'ADMIN', 'PHOTOGRAPHER', 'SYSTEM'));--> statement-breakpoint
ALTER TABLE "photo_events" ADD CONSTRAINT "photo_events_source_check" CHECK ("photo_events"."source" in ('LEGACY_IMPORT', 'MANUAL', 'PHOTOGRAPHER'));