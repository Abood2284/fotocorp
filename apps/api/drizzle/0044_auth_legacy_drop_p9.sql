-- P9: Drop legacy auth tables after P4–P8 cutover (Development).

ALTER TABLE "contributor_upload_batches" DROP CONSTRAINT IF EXISTS "contributor_upload_batches_contributor_account_id_contributor_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "contributor_upload_items" DROP CONSTRAINT IF EXISTS "contributor_upload_items_contributor_account_id_contributor_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "photo_events" DROP CONSTRAINT IF EXISTS "photo_events_created_by_contributor_account_id_contributor_accounts_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "photo_events_created_by_contributor_account_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "contributor_upload_batches_account_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "contributor_upload_items_account_id_idx";
--> statement-breakpoint
ALTER TABLE "contributor_upload_batches" DROP COLUMN IF EXISTS "contributor_account_id";
--> statement-breakpoint
ALTER TABLE "contributor_upload_items" DROP COLUMN IF EXISTS "contributor_account_id";
--> statement-breakpoint
ALTER TABLE "photo_events" DROP COLUMN IF EXISTS "created_by_contributor_account_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "contributor_sessions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "contributor_accounts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "staff_sessions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "staff_accounts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "fotocorp_user_profiles" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "app_user_profiles" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "session" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "account" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "verification" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "user" CASCADE;
