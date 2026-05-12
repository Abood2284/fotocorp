CREATE TABLE "asset_fotobox_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"app_user_profile_id" text,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_fotobox_items_auth_user_id_asset_id_unique" UNIQUE("auth_user_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "asset_fotobox_items" ADD CONSTRAINT "asset_fotobox_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_fotobox_items_auth_user_id_created_at_idx" ON "asset_fotobox_items" USING btree ("auth_user_id","created_at");--> statement-breakpoint
CREATE INDEX "asset_fotobox_items_asset_id_idx" ON "asset_fotobox_items" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_fotobox_items_app_user_profile_id_idx" ON "asset_fotobox_items" USING btree ("app_user_profile_id");
