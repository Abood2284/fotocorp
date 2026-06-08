ALTER TABLE "staff_members" DROP CONSTRAINT IF EXISTS "staff_members_role_check";
--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_role_check" CHECK ("role" in ('SUPER_ADMIN','CATALOG_MANAGER','REVIEWER','CAPTION_MANAGER','CAPTION_WRITER','FINANCE','SUPPORT'));
