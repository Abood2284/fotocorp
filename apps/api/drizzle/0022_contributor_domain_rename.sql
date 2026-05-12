-- Enum-like text values + clean table/column renames (photographer → contributor).
-- Legacy tables (e.g. photographer_profiles) are unchanged.

ALTER TABLE "photo_events" DROP CONSTRAINT IF EXISTS "photo_events_source_check";
--> statement-breakpoint
ALTER TABLE "photo_events" DROP CONSTRAINT IF EXISTS "photo_events_created_by_source_check";
--> statement-breakpoint
UPDATE "photo_events" SET "source" = 'CONTRIBUTOR' WHERE "source" = 'PHOTOGRAPHER';
--> statement-breakpoint
UPDATE "photo_events" SET "created_by_source" = 'CONTRIBUTOR' WHERE "created_by_source" = 'PHOTOGRAPHER';
--> statement-breakpoint
ALTER TABLE "image_assets" DROP CONSTRAINT IF EXISTS "image_assets_source_check";
--> statement-breakpoint
UPDATE "image_assets" SET "source" = 'CONTRIBUTOR_UPLOAD' WHERE "source" = 'PHOTOGRAPHER_UPLOAD';
--> statement-breakpoint
ALTER TABLE "app_user_profiles" DROP CONSTRAINT IF EXISTS "app_user_profiles_role_check";
--> statement-breakpoint
UPDATE "app_user_profiles" SET "role" = 'CONTRIBUTOR' WHERE "role" = 'PHOTOGRAPHER';
--> statement-breakpoint
UPDATE "image_publish_jobs" SET "job_type" = 'CONTRIBUTOR_APPROVAL' WHERE "job_type" = 'PHOTOGRAPHER_APPROVAL';
--> statement-breakpoint
ALTER TABLE "image_publish_jobs" ALTER COLUMN "job_type" SET DEFAULT 'CONTRIBUTOR_APPROVAL';
--> statement-breakpoint
ALTER TABLE "photo_events" RENAME COLUMN "created_by_photographer_id" TO "created_by_contributor_id";
--> statement-breakpoint
ALTER TABLE "photo_events" RENAME COLUMN "created_by_photographer_account_id" TO "created_by_contributor_account_id";
--> statement-breakpoint
ALTER TABLE "image_assets" RENAME COLUMN "photographer_id" TO "contributor_id";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photo_events_created_by_photographer_id_idx" RENAME TO "photo_events_created_by_contributor_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photo_events_created_by_photographer_account_id_idx" RENAME TO "photo_events_created_by_contributor_account_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "image_assets_photographer_id_idx" RENAME TO "image_assets_contributor_id_idx";
--> statement-breakpoint
ALTER TABLE "photographers" RENAME TO "contributors";
--> statement-breakpoint
ALTER TABLE "contributors" RENAME CONSTRAINT "photographers_pkey" TO "contributors_pkey";
--> statement-breakpoint
ALTER TABLE "contributors" RENAME CONSTRAINT "photographers_legacy_photographer_id_unique" TO "contributors_legacy_photographer_id_unique";
--> statement-breakpoint
ALTER TABLE "contributors" RENAME CONSTRAINT "photographers_status_check" TO "contributors_status_check";
--> statement-breakpoint
ALTER TABLE "contributors" RENAME CONSTRAINT "photographers_source_check" TO "contributors_source_check";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographers_legacy_photographer_id_unique_idx" RENAME TO "contributors_legacy_photographer_id_unique_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographers_status_idx" RENAME TO "contributors_status_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographers_display_name_lower_idx" RENAME TO "contributors_display_name_lower_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographers_email_lower_idx" RENAME TO "contributors_email_lower_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographers_source_idx" RENAME TO "contributors_source_idx";
--> statement-breakpoint
ALTER TABLE "photographer_accounts" RENAME TO "contributor_accounts";
--> statement-breakpoint
ALTER TABLE "contributor_accounts" RENAME COLUMN "photographer_id" TO "contributor_id";
--> statement-breakpoint
ALTER TABLE "contributor_accounts" RENAME CONSTRAINT "photographer_accounts_pkey" TO "contributor_accounts_pkey";
--> statement-breakpoint
ALTER TABLE "contributor_accounts" RENAME CONSTRAINT "photographer_accounts_status_check" TO "contributor_accounts_status_check";
--> statement-breakpoint
ALTER TABLE "contributor_accounts" RENAME CONSTRAINT "photographer_accounts_photographer_id_photographers_id_fk" TO "contributor_accounts_contributor_id_contributors_id_fk";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_accounts_username_lower_uidx" RENAME TO "contributor_accounts_username_lower_uidx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_accounts_photographer_id_uidx" RENAME TO "contributor_accounts_contributor_id_uidx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_accounts_status_idx" RENAME TO "contributor_accounts_status_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_accounts_created_at_idx" RENAME TO "contributor_accounts_created_at_idx";
--> statement-breakpoint
ALTER TABLE "photographer_sessions" RENAME TO "contributor_sessions";
--> statement-breakpoint
ALTER TABLE "contributor_sessions" RENAME COLUMN "photographer_account_id" TO "contributor_account_id";
--> statement-breakpoint
ALTER TABLE "contributor_sessions" RENAME COLUMN "photographer_id" TO "contributor_id";
--> statement-breakpoint
ALTER TABLE "contributor_sessions" RENAME CONSTRAINT "photographer_sessions_pkey" TO "contributor_sessions_pkey";
--> statement-breakpoint
ALTER TABLE "contributor_sessions" RENAME CONSTRAINT "photographer_sessions_token_hash_unique" TO "contributor_sessions_token_hash_unique";
--> statement-breakpoint
ALTER TABLE "contributor_sessions" RENAME CONSTRAINT "photographer_sessions_photographer_account_id_photographer_accounts_id_fk" TO "contributor_sessions_contributor_account_id_contributor_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "contributor_sessions" RENAME CONSTRAINT "photographer_sessions_photographer_id_photographers_id_fk" TO "contributor_sessions_contributor_id_contributors_id_fk";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_sessions_token_hash_uidx" RENAME TO "contributor_sessions_token_hash_uidx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_sessions_account_id_idx" RENAME TO "contributor_sessions_account_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_sessions_photographer_id_idx" RENAME TO "contributor_sessions_contributor_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_sessions_expires_at_idx" RENAME TO "contributor_sessions_expires_at_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_sessions_active_idx" RENAME TO "contributor_sessions_active_idx";
--> statement-breakpoint
ALTER TABLE "photographer_upload_batches" RENAME TO "contributor_upload_batches";
--> statement-breakpoint
ALTER TABLE "contributor_upload_batches" RENAME COLUMN "photographer_id" TO "contributor_id";
--> statement-breakpoint
ALTER TABLE "contributor_upload_batches" RENAME COLUMN "photographer_account_id" TO "contributor_account_id";
--> statement-breakpoint
ALTER TABLE "contributor_upload_batches" RENAME CONSTRAINT "photographer_upload_batches_pkey" TO "contributor_upload_batches_pkey";
--> statement-breakpoint
ALTER TABLE "contributor_upload_batches" RENAME CONSTRAINT "photographer_upload_batches_status_check" TO "contributor_upload_batches_status_check";
--> statement-breakpoint
ALTER TABLE "contributor_upload_batches" RENAME CONSTRAINT "photographer_upload_batches_photographer_id_photographers_id_fk" TO "contributor_upload_batches_contributor_id_contributors_id_fk";
--> statement-breakpoint
ALTER TABLE "contributor_upload_batches" RENAME CONSTRAINT "photographer_upload_batches_photographer_account_id_photographer_accounts_id_fk" TO "contributor_upload_batches_contributor_account_id_contributor_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "contributor_upload_batches" RENAME CONSTRAINT "photographer_upload_batches_event_id_photo_events_id_fk" TO "contributor_upload_batches_event_id_photo_events_id_fk";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_upload_batches_photographer_id_idx" RENAME TO "contributor_upload_batches_contributor_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_upload_batches_account_id_idx" RENAME TO "contributor_upload_batches_account_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_upload_batches_event_id_idx" RENAME TO "contributor_upload_batches_event_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_upload_batches_status_idx" RENAME TO "contributor_upload_batches_status_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_upload_batches_created_at_idx" RENAME TO "contributor_upload_batches_created_at_idx";
--> statement-breakpoint
ALTER TABLE "photographer_upload_items" RENAME TO "contributor_upload_items";
--> statement-breakpoint
ALTER TABLE "contributor_upload_items" RENAME COLUMN "photographer_id" TO "contributor_id";
--> statement-breakpoint
ALTER TABLE "contributor_upload_items" RENAME COLUMN "photographer_account_id" TO "contributor_account_id";
--> statement-breakpoint
ALTER TABLE "contributor_upload_items" RENAME CONSTRAINT "photographer_upload_items_pkey" TO "contributor_upload_items_pkey";
--> statement-breakpoint
ALTER TABLE "contributor_upload_items" RENAME CONSTRAINT "photographer_upload_items_status_check" TO "contributor_upload_items_status_check";
--> statement-breakpoint
ALTER TABLE "contributor_upload_items" RENAME CONSTRAINT "photographer_upload_items_batch_id_photographer_upload_batches_id_fk" TO "contributor_upload_items_batch_id_contributor_upload_batches_id_fk";
--> statement-breakpoint
ALTER TABLE "contributor_upload_items" RENAME CONSTRAINT "photographer_upload_items_photographer_id_photographers_id_fk" TO "contributor_upload_items_contributor_id_contributors_id_fk";
--> statement-breakpoint
ALTER TABLE "contributor_upload_items" RENAME CONSTRAINT "photographer_upload_items_photographer_account_id_photographer_accounts_id_fk" TO "contributor_upload_items_contributor_account_id_contributor_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "contributor_upload_items" RENAME CONSTRAINT "photographer_upload_items_image_asset_id_image_assets_id_fk" TO "contributor_upload_items_image_asset_id_image_assets_id_fk";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_upload_items_storage_key_uidx" RENAME TO "contributor_upload_items_storage_key_uidx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_upload_items_batch_id_idx" RENAME TO "contributor_upload_items_batch_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_upload_items_photographer_id_idx" RENAME TO "contributor_upload_items_contributor_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_upload_items_account_id_idx" RENAME TO "contributor_upload_items_account_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_upload_items_image_asset_id_idx" RENAME TO "contributor_upload_items_image_asset_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "photographer_upload_items_upload_status_idx" RENAME TO "contributor_upload_items_upload_status_idx";
--> statement-breakpoint
ALTER TABLE "image_assets" RENAME CONSTRAINT "image_assets_photographer_id_photographers_id_fk" TO "image_assets_contributor_id_contributors_id_fk";
--> statement-breakpoint
ALTER TABLE "photo_events" RENAME CONSTRAINT "photo_events_created_by_photographer_id_photographers_id_fk" TO "photo_events_created_by_contributor_id_contributors_id_fk";
--> statement-breakpoint
ALTER TABLE "photo_events" RENAME CONSTRAINT "photo_events_created_by_photographer_account_id_photographer_accounts_id_fk" TO "photo_events_created_by_contributor_account_id_contributor_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "photo_events" ADD CONSTRAINT "photo_events_source_check" CHECK ("photo_events"."source" in ('LEGACY_IMPORT', 'MANUAL', 'CONTRIBUTOR'));
--> statement-breakpoint
ALTER TABLE "photo_events" ADD CONSTRAINT "photo_events_created_by_source_check" CHECK ("photo_events"."created_by_source" in ('LEGACY_IMPORT', 'ADMIN', 'CONTRIBUTOR', 'SYSTEM'));
--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_source_check" CHECK ("image_assets"."source" in ('LEGACY_IMPORT', 'MANUAL', 'CONTRIBUTOR_UPLOAD', 'FOTOCORP'));
--> statement-breakpoint
ALTER TABLE "app_user_profiles" ADD CONSTRAINT "app_user_profiles_role_check" CHECK ("app_user_profiles"."role" in ('USER', 'CONTRIBUTOR', 'ADMIN', 'SUPER_ADMIN'));
