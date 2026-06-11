ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "video_quantity_range" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "caricature_quantity_range" text;--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN IF NOT EXISTS "video_quantity_range" text;--> statement-breakpoint
ALTER TABLE "customer_access_inquiries" ADD COLUMN IF NOT EXISTS "caricature_quantity_range" text;
