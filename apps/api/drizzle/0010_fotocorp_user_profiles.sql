CREATE TABLE IF NOT EXISTS "fotocorp_user_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "username" text NOT NULL,
  "company_type" text NOT NULL,
  "company_name" text NOT NULL,
  "job_title" text NOT NULL,
  "custom_job_title" text,
  "company_email" text NOT NULL,
  "company_email_domain" text NOT NULL,
  "email_validation_decision" text NOT NULL,
  "phone_country_code" text NOT NULL,
  "phone_number" text NOT NULL,
  "phone_extension" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fotocorp_user_profiles_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "fotocorp_user_profiles_user_id_unique_idx"
  ON "fotocorp_user_profiles" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "fotocorp_user_profiles_company_email_idx"
  ON "fotocorp_user_profiles" USING btree ("company_email");

CREATE INDEX IF NOT EXISTS "fotocorp_user_profiles_company_email_domain_idx"
  ON "fotocorp_user_profiles" USING btree ("company_email_domain");

CREATE INDEX IF NOT EXISTS "fotocorp_user_profiles_company_type_idx"
  ON "fotocorp_user_profiles" USING btree ("company_type");

CREATE INDEX IF NOT EXISTS "fotocorp_user_profiles_username_idx"
  ON "fotocorp_user_profiles" USING btree ("username");
