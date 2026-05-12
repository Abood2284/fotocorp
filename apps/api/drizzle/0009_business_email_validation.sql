CREATE TABLE IF NOT EXISTS "auth_email_domain_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"verdict" text NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"is_disposable" boolean DEFAULT false NOT NULL,
	"has_mx" boolean,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_email_domain_checks_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_email_domain_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_email_domain_overrides_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_email_address_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_email_address_overrides_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auth_email_domain_overrides_decision_check'
      AND conrelid = 'auth_email_domain_overrides'::regclass
  ) THEN
    ALTER TABLE "auth_email_domain_overrides"
      ADD CONSTRAINT "auth_email_domain_overrides_decision_check"
      CHECK ("decision" in ('ALLOW', 'BLOCK'));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auth_email_address_overrides_decision_check'
      AND conrelid = 'auth_email_address_overrides'::regclass
  ) THEN
    ALTER TABLE "auth_email_address_overrides"
      ADD CONSTRAINT "auth_email_address_overrides_decision_check"
      CHECK ("decision" in ('ALLOW', 'BLOCK'));
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_email_domain_checks_domain_idx" ON "auth_email_domain_checks" USING btree ("domain");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_email_domain_checks_expires_at_idx" ON "auth_email_domain_checks" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_email_domain_overrides_domain_idx" ON "auth_email_domain_overrides" USING btree ("domain");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_email_address_overrides_email_idx" ON "auth_email_address_overrides" USING btree ("email");
