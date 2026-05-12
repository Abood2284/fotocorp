ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "username" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "displayUsername" text;
--> statement-breakpoint
UPDATE "user"
SET "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9_.]', '_', 'g'))
WHERE "username" IS NULL;
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "username" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_username_format_check'
      AND conrelid = '"user"'::regclass
  ) THEN
    ALTER TABLE "user"
      ADD CONSTRAINT "user_username_format_check"
      CHECK ("username" ~ '^[a-z0-9_.]{3,30}$');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_username_lowercase_check'
      AND conrelid = '"user"'::regclass
  ) THEN
    ALTER TABLE "user"
      ADD CONSTRAINT "user_username_lowercase_check"
      CHECK ("username" = lower("username"));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_username_reserved_check'
      AND conrelid = '"user"'::regclass
  ) THEN
    ALTER TABLE "user"
      ADD CONSTRAINT "user_username_reserved_check"
      CHECK ("username" not in (
        'admin',
        'root',
        'support',
        'help',
        'api',
        'auth',
        'login',
        'sign-in',
        'register',
        'fotocorp',
        'system',
        'null',
        'undefined'
      ));
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_username_unique_idx" ON "user" USING btree ("username");
