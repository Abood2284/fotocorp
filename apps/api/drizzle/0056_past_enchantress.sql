CREATE TABLE "help_article_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"was_helpful" boolean NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_article_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"media_type" text NOT NULL,
	"title" text,
	"description" text,
	"storage_key" text,
	"mime_type" text,
	"file_size_bytes" bigint,
	"duration_seconds" integer,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_article_media_type_check" CHECK ("help_article_media"."media_type" in ('IMAGE','VIDEO'))
);
--> statement-breakpoint
CREATE TABLE "help_article_related" (
	"article_id" uuid NOT NULL,
	"related_article_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_article_related_pkey" PRIMARY KEY("article_id","related_article_id"),
	CONSTRAINT "help_article_related_no_self_ref" CHECK ("help_article_related"."article_id" <> "help_article_related"."related_article_id")
);
--> statement-breakpoint
CREATE TABLE "help_article_tags" (
	"article_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_article_tags_pkey" PRIMARY KEY("article_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "help_article_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_query" text
);
--> statement-breakpoint
CREATE TABLE "help_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text NOT NULL,
	"body_markdown" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"visibility" text DEFAULT 'STAFF_ONLY' NOT NULL,
	"audience_roles" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"difficulty" text,
	"estimated_minutes" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_staff_id" uuid NOT NULL,
	"updated_by_staff_id" uuid NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_articles_status_check" CHECK ("help_articles"."status" in ('DRAFT','PUBLISHED','ARCHIVED')),
	CONSTRAINT "help_articles_visibility_check" CHECK ("help_articles"."visibility" in ('STAFF_ONLY')),
	CONSTRAINT "help_articles_difficulty_check" CHECK ("help_articles"."difficulty" is null or "help_articles"."difficulty" in ('BEGINNER','INTERMEDIATE','ADVANCED'))
);
--> statement-breakpoint
CREATE TABLE "help_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "help_article_feedback" ADD CONSTRAINT "help_article_feedback_article_id_help_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."help_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_feedback" ADD CONSTRAINT "help_article_feedback_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_media" ADD CONSTRAINT "help_article_media_article_id_help_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."help_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_related" ADD CONSTRAINT "help_article_related_article_id_help_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."help_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_related" ADD CONSTRAINT "help_article_related_related_article_id_help_articles_id_fk" FOREIGN KEY ("related_article_id") REFERENCES "public"."help_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_tags" ADD CONSTRAINT "help_article_tags_article_id_help_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."help_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_tags" ADD CONSTRAINT "help_article_tags_tag_id_help_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."help_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_views" ADD CONSTRAINT "help_article_views_article_id_help_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."help_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_article_views" ADD CONSTRAINT "help_article_views_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_category_id_help_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."help_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_created_by_staff_id_staff_members_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_updated_by_staff_id_staff_members_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "help_article_feedback_article_staff_uidx" ON "help_article_feedback" USING btree ("article_id","staff_id");--> statement-breakpoint
CREATE INDEX "help_article_feedback_article_id_idx" ON "help_article_feedback" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "help_article_feedback_staff_id_idx" ON "help_article_feedback" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "help_article_feedback_was_helpful_idx" ON "help_article_feedback" USING btree ("was_helpful");--> statement-breakpoint
CREATE INDEX "help_article_media_article_id_idx" ON "help_article_media" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "help_article_media_type_idx" ON "help_article_media" USING btree ("media_type");--> statement-breakpoint
CREATE INDEX "help_article_media_sort_order_idx" ON "help_article_media" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "help_article_related_article_id_idx" ON "help_article_related" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "help_article_related_related_article_id_idx" ON "help_article_related" USING btree ("related_article_id");--> statement-breakpoint
CREATE INDEX "help_article_tags_article_id_idx" ON "help_article_tags" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "help_article_tags_tag_id_idx" ON "help_article_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "help_article_views_article_id_idx" ON "help_article_views" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "help_article_views_staff_id_idx" ON "help_article_views" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "help_article_views_viewed_at_idx" ON "help_article_views" USING btree ("viewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "help_articles_slug_uidx" ON "help_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "help_articles_category_id_idx" ON "help_articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "help_articles_status_idx" ON "help_articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "help_articles_published_at_idx" ON "help_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "help_articles_sort_order_idx" ON "help_articles" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "help_articles_created_by_staff_id_idx" ON "help_articles" USING btree ("created_by_staff_id");--> statement-breakpoint
CREATE INDEX "help_articles_updated_by_staff_id_idx" ON "help_articles" USING btree ("updated_by_staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "help_categories_slug_uidx" ON "help_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "help_categories_is_active_idx" ON "help_categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "help_categories_display_order_idx" ON "help_categories" USING btree ("display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "help_tags_slug_uidx" ON "help_tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "help_tags_name_uidx" ON "help_tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "help_tags_slug_idx" ON "help_tags" USING btree ("slug");
