ALTER TABLE "help_article_media" ADD COLUMN "upload_status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "help_article_media" ADD COLUMN "uploaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "help_article_media" ADD COLUMN "created_by_staff_id" uuid;--> statement-breakpoint
ALTER TABLE "help_article_media" ADD COLUMN "updated_by_staff_id" uuid;--> statement-breakpoint
ALTER TABLE "help_article_media" ADD CONSTRAINT "help_article_media_created_by_staff_id_staff_members_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_media" ADD CONSTRAINT "help_article_media_updated_by_staff_id_staff_members_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_media" ADD CONSTRAINT "help_article_media_upload_status_check" CHECK ("upload_status" in ('PENDING','READY','FAILED'));--> statement-breakpoint
CREATE INDEX "help_article_media_article_upload_status_idx" ON "help_article_media" USING btree ("article_id","upload_status");--> statement-breakpoint
CREATE INDEX "help_article_media_created_by_staff_id_idx" ON "help_article_media" USING btree ("created_by_staff_id");
