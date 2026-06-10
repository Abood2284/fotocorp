ALTER TABLE "asset_original_metadata" RENAME TO "image_assets_metadata";--> statement-breakpoint
ALTER TABLE "image_assets_metadata" RENAME COLUMN "asset_id" TO "image_asset_id";--> statement-breakpoint
ALTER TABLE "image_assets_metadata" DROP CONSTRAINT "asset_original_metadata_scan_status_check";--> statement-breakpoint
ALTER TABLE "image_assets_metadata" DROP CONSTRAINT "asset_original_metadata_source_quality_bucket_check";--> statement-breakpoint
ALTER TABLE "image_assets_metadata" DROP CONSTRAINT "asset_original_metadata_download_quality_ceiling_check";--> statement-breakpoint
ALTER TABLE "image_assets_metadata" DROP CONSTRAINT "asset_original_metadata_asset_id_assets_id_fk";
--> statement-breakpoint
DROP INDEX "asset_original_metadata_asset_id_uidx";--> statement-breakpoint
DROP INDEX "asset_original_metadata_metadata_scan_status_idx";--> statement-breakpoint
DROP INDEX "asset_original_metadata_source_quality_bucket_idx";--> statement-breakpoint
DROP INDEX "asset_original_metadata_download_quality_ceiling_idx";--> statement-breakpoint
ALTER TABLE "image_assets_metadata" ADD CONSTRAINT "image_assets_metadata_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "image_assets_metadata_image_asset_id_uidx" ON "image_assets_metadata" USING btree ("image_asset_id");--> statement-breakpoint
CREATE INDEX "image_assets_metadata_metadata_scan_status_idx" ON "image_assets_metadata" USING btree ("metadata_scan_status");--> statement-breakpoint
CREATE INDEX "image_assets_metadata_source_quality_bucket_idx" ON "image_assets_metadata" USING btree ("source_quality_bucket");--> statement-breakpoint
CREATE INDEX "image_assets_metadata_download_quality_ceiling_idx" ON "image_assets_metadata" USING btree ("download_quality_ceiling");--> statement-breakpoint
ALTER TABLE "image_assets_metadata" ADD CONSTRAINT "image_assets_metadata_scan_status_check" CHECK ("image_assets_metadata"."metadata_scan_status" in ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED'));--> statement-breakpoint
ALTER TABLE "image_assets_metadata" ADD CONSTRAINT "image_assets_metadata_source_quality_bucket_check" CHECK ("image_assets_metadata"."source_quality_bucket" in ('LOW_SOURCE', 'STANDARD_SOURCE', 'HIGH_SOURCE', 'VERY_HIGH_SOURCE', 'UNKNOWN'));--> statement-breakpoint
ALTER TABLE "image_assets_metadata" ADD CONSTRAINT "image_assets_metadata_download_quality_ceiling_check" CHECK ("image_assets_metadata"."download_quality_ceiling" in ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'));