ALTER TABLE "image_assets" DROP CONSTRAINT "image_assets_source_check";--> statement-breakpoint
UPDATE "image_assets"
SET "source" = 'FOTOCORP', "updated_at" = now()
WHERE "source" = 'PHOTOGRAPHER_UPLOAD';--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_source_check" CHECK ("image_assets"."source" in ('LEGACY_IMPORT', 'MANUAL', 'PHOTOGRAPHER_UPLOAD', 'FOTOCORP'));