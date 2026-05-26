CREATE TABLE IF NOT EXISTS "fotobox_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"app_user_profile_id" text,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "asset_fotobox_items" DROP CONSTRAINT IF EXISTS "asset_fotobox_items_auth_user_id_asset_id_unique";
--> statement-breakpoint

DROP INDEX IF EXISTS "asset_fotobox_items_auth_user_id_created_at_idx";
--> statement-breakpoint

ALTER TABLE "asset_fotobox_items" ADD COLUMN IF NOT EXISTS "board_id" uuid;
--> statement-breakpoint

DO $$
DECLARE
	uid_rec RECORD;
	new_board_id uuid;
BEGIN
	FOR uid_rec IN SELECT DISTINCT auth_user_id FROM asset_fotobox_items WHERE board_id IS NULL LOOP
		INSERT INTO fotobox_boards (auth_user_id, name)
		VALUES (uid_rec.auth_user_id, 'My Board')
		RETURNING id INTO new_board_id;

		UPDATE asset_fotobox_items
		SET board_id = new_board_id
		WHERE auth_user_id = uid_rec.auth_user_id AND board_id IS NULL;
	END LOOP;
END $$;
--> statement-breakpoint

ALTER TABLE "asset_fotobox_items" ALTER COLUMN "board_id" SET NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'asset_fotobox_items_board_id_fotobox_boards_id_fk'
	) THEN
		ALTER TABLE "asset_fotobox_items"
		ADD CONSTRAINT "asset_fotobox_items_board_id_fotobox_boards_id_fk"
		FOREIGN KEY ("board_id") REFERENCES "fotobox_boards"("id") ON DELETE CASCADE;
	END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'asset_fotobox_items_board_asset_unique'
	) THEN
		ALTER TABLE "asset_fotobox_items"
		ADD CONSTRAINT "asset_fotobox_items_board_asset_unique" UNIQUE("board_id","asset_id");
	END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fotobox_boards_auth_user_id_idx" ON "fotobox_boards" USING btree ("auth_user_id","sort_order");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "asset_fotobox_items_board_id_created_at_idx" ON "asset_fotobox_items" USING btree ("board_id","created_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "asset_fotobox_items_auth_user_id_idx" ON "asset_fotobox_items" USING btree ("auth_user_id");
