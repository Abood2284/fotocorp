-- Rename access interest IMAGE → EDITORIAL; add ROYALTY_FREE entitlement type and RF registration columns.

ALTER TABLE "subscriber_entitlements" DROP CONSTRAINT IF EXISTS "subscriber_entitlements_asset_type_check";
--> statement-breakpoint
UPDATE "subscriber_entitlements" SET "asset_type" = 'EDITORIAL' WHERE "asset_type" = 'IMAGE';
--> statement-breakpoint
UPDATE "users"
SET "interested_asset_types" = (
  SELECT COALESCE(array_agg(DISTINCT replaced ORDER BY replaced), ARRAY[]::text[])
  FROM (
    SELECT CASE elem WHEN 'IMAGE' THEN 'EDITORIAL' ELSE elem END AS replaced
    FROM unnest("users"."interested_asset_types") AS elem
  ) s
)
WHERE 'IMAGE' = ANY("interested_asset_types");
--> statement-breakpoint
UPDATE "customer_access_inquiries"
SET "interested_asset_types" = (
  SELECT COALESCE(array_agg(DISTINCT replaced ORDER BY replaced), ARRAY[]::text[])
  FROM (
    SELECT CASE elem WHEN 'IMAGE' THEN 'EDITORIAL' ELSE elem END AS replaced
    FROM unnest("customer_access_inquiries"."interested_asset_types") AS elem
  ) s
)
WHERE 'IMAGE' = ANY("interested_asset_types");
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "royalty_free_quantity_range" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "royalty_free_quality_preference" text;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN IF NOT EXISTS "royalty_free_quantity_range" text;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN IF NOT EXISTS "royalty_free_quality_preference" text;
--> statement-breakpoint
ALTER TABLE "subscriber_entitlements" ADD CONSTRAINT "subscriber_entitlements_asset_type_check" CHECK ("asset_type" in ('EDITORIAL','ROYALTY_FREE','VIDEO','CARICATURE'));
