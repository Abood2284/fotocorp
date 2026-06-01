-- P7: Extend customer_access_inquiries for contributor applications.

ALTER TABLE "customer_access_inquiries" ADD COLUMN "inquiry_type" text DEFAULT 'USER_ACCESS' NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "contributor_id" uuid;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "applicant_first_name" text;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "applicant_last_name" text;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "applicant_email" text;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "applicant_phone_country_code" text;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "applicant_phone_number" text;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "proposed_username" text;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "application_notes" text;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD CONSTRAINT "customer_access_inquiries_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" DROP CONSTRAINT IF EXISTS "customer_access_inquiries_status_check";
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD CONSTRAINT "customer_access_inquiries_status_check" CHECK ("customer_access_inquiries"."status" in ('PENDING','IN_REVIEW','CLOSED','ACCESS_GRANTED','CONTRIBUTOR_APPROVED'));
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD CONSTRAINT "customer_access_inquiries_inquiry_type_check" CHECK ("customer_access_inquiries"."inquiry_type" in ('USER_ACCESS','CONTRIBUTOR_APPLICATION'));
--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD CONSTRAINT "customer_access_inquiries_owner_shape_check" CHECK (
  ("customer_access_inquiries"."inquiry_type" = 'USER_ACCESS' AND "customer_access_inquiries"."user_id" IS NOT NULL)
  OR ("customer_access_inquiries"."inquiry_type" = 'CONTRIBUTOR_APPLICATION' AND "customer_access_inquiries"."contributor_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX "customer_access_inquiries_inquiry_type_created_idx" ON "customer_access_inquiries" USING btree ("inquiry_type","created_at");
