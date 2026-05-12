ALTER TABLE "app_user_profiles" ADD COLUMN IF NOT EXISTS "is_subscriber" boolean DEFAULT false;--> statement-breakpoint
UPDATE "app_user_profiles" SET "is_subscriber" = false WHERE "is_subscriber" IS NULL;--> statement-breakpoint
ALTER TABLE "app_user_profiles" ALTER COLUMN "is_subscriber" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "app_user_profiles" ALTER COLUMN "is_subscriber" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user_profiles" ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'NONE';--> statement-breakpoint
UPDATE "app_user_profiles" SET "subscription_status" = 'NONE' WHERE "subscription_status" IS NULL;--> statement-breakpoint
ALTER TABLE "app_user_profiles" ALTER COLUMN "subscription_status" SET DEFAULT 'NONE';--> statement-breakpoint
ALTER TABLE "app_user_profiles" ALTER COLUMN "subscription_status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user_profiles" ADD COLUMN IF NOT EXISTS "subscription_plan_id" text;--> statement-breakpoint
ALTER TABLE "app_user_profiles" ADD COLUMN IF NOT EXISTS "subscription_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_user_profiles" ADD COLUMN IF NOT EXISTS "subscription_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_user_profiles" ADD COLUMN IF NOT EXISTS "download_quota_limit" integer;--> statement-breakpoint
ALTER TABLE "app_user_profiles" ADD COLUMN IF NOT EXISTS "download_quota_used" integer DEFAULT 0;--> statement-breakpoint
UPDATE "app_user_profiles" SET "download_quota_used" = 0 WHERE "download_quota_used" IS NULL;--> statement-breakpoint
ALTER TABLE "app_user_profiles" ALTER COLUMN "download_quota_used" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "app_user_profiles" ALTER COLUMN "download_quota_used" SET NOT NULL;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_user_profiles_subscription_status_check'
      AND conrelid = 'app_user_profiles'::regclass
  ) THEN
    ALTER TABLE "app_user_profiles"
      ADD CONSTRAINT "app_user_profiles_subscription_status_check"
      CHECK ("subscription_status" in ('NONE', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'));
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_user_profiles_download_quota_used_check'
      AND conrelid = 'app_user_profiles'::regclass
  ) THEN
    ALTER TABLE "app_user_profiles"
      ADD CONSTRAINT "app_user_profiles_download_quota_used_check"
      CHECK ("download_quota_used" >= 0);
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_user_profiles_subscription_status_idx" ON "app_user_profiles" USING btree ("subscription_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_user_profiles_is_subscriber_idx" ON "app_user_profiles" USING btree ("is_subscriber");
