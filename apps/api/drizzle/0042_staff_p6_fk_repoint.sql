-- P6: Repoint staff FKs from staff_accounts to staff_members (same UUIDs after data migration).

ALTER TABLE "subscriber_entitlements" DROP CONSTRAINT IF EXISTS "subscriber_entitlements_created_by_staff_id_staff_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriber_entitlements" DROP CONSTRAINT IF EXISTS "subscriber_entitlements_approved_by_staff_id_staff_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "staff_audit_logs" DROP CONSTRAINT IF EXISTS "staff_audit_logs_staff_account_id_staff_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriber_entitlements" ADD CONSTRAINT "subscriber_entitlements_created_by_staff_id_staff_members_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "subscriber_entitlements" ADD CONSTRAINT "subscriber_entitlements_approved_by_staff_id_staff_members_id_fk" FOREIGN KEY ("approved_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_audit_logs" ADD CONSTRAINT "staff_audit_logs_staff_account_id_staff_members_id_fk" FOREIGN KEY ("staff_account_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;
