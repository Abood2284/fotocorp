ALTER TABLE "image_download_logs" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "image_download_logs" ADD COLUMN "ip_country" varchar(2);--> statement-breakpoint
ALTER TABLE "image_download_logs" ADD COLUMN "ip_city" text;--> statement-breakpoint
ALTER TABLE "image_download_logs" ADD COLUMN "ip_region" text;--> statement-breakpoint
ALTER TABLE "image_download_logs" ADD COLUMN "ip_region_code" varchar(32);--> statement-breakpoint
ALTER TABLE "image_download_logs" ADD COLUMN "cf_ray" text;--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "submission_ip_address" text;--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "submission_ip_hash" text;--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "submission_ip_country" varchar(2);--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "submission_ip_city" text;--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "submission_ip_region" text;--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "submission_ip_region_code" varchar(32);--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "submission_cf_ray" text;--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN "submission_user_agent" text;--> statement-breakpoint
CREATE INDEX "image_download_logs_ip_hash_created_at_idx" ON "image_download_logs" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "image_download_logs_ip_country_created_at_idx" ON "image_download_logs" USING btree ("ip_country","created_at");--> statement-breakpoint
CREATE INDEX "customer_access_inquiries_submission_ip_hash_created_at_idx" ON "customer_access_inquiries" USING btree ("submission_ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "customer_access_inquiries_submission_ip_country_created_at_idx" ON "customer_access_inquiries" USING btree ("submission_ip_country","created_at");