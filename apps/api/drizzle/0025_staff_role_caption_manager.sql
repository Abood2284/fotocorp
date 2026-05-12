ALTER TABLE "staff_accounts" DROP CONSTRAINT "staff_accounts_role_check";
--> statement-breakpoint
ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_role_check" CHECK ("role" in ('SUPER_ADMIN','CATALOG_MANAGER','REVIEWER','CAPTION_MANAGER','FINANCE','SUPPORT'));
