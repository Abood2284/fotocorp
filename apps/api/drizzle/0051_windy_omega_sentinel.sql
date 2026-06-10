ALTER TABLE "asset_admin_audit_logs" DROP CONSTRAINT "asset_admin_audit_logs_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "asset_admin_audit_logs" ADD CONSTRAINT "asset_admin_audit_logs_asset_id_image_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TABLE "asset_import_issues";--> statement-breakpoint
DROP TABLE "asset_media_access_logs";--> statement-breakpoint
DROP TABLE "asset_media_derivatives";--> statement-breakpoint
DROP TABLE "asset_download_logs";--> statement-breakpoint
DROP TABLE "asset_fotobox_items";--> statement-breakpoint
DROP TABLE "assets";--> statement-breakpoint
DROP TABLE "asset_events";--> statement-breakpoint
DROP TABLE "image_assets_duplicate_backup_20260518";