ALTER TABLE "contributors" ADD COLUMN "allowed_upload_types" text[] DEFAULT ARRAY['EDITORIAL']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "contributors" ADD CONSTRAINT "contributors_allowed_upload_types_check" CHECK (
  cardinality("allowed_upload_types") >= 1
  AND "allowed_upload_types" <@ ARRAY['EDITORIAL','CARICATURE']::text[]
);--> statement-breakpoint
-- Existing contributors: Editorial by default.
UPDATE "contributors"
SET "allowed_upload_types" = ARRAY['EDITORIAL']::text[],
    "updated_at" = now();--> statement-breakpoint
-- Named caricature contributor (profile email and/or EMAIL identity claim).
UPDATE "contributors" AS c
SET "allowed_upload_types" = ARRAY['CARICATURE']::text[],
    "updated_at" = now()
WHERE lower(trim(c."email")) = 'jamesmanalody@gmail.com'
   OR c."id" IN (
     SELECT aic."owner_id"
     FROM "auth_identity_claims" AS aic
     WHERE aic."owner_type" = 'CONTRIBUTOR'
       AND aic."claim_type" = 'EMAIL'
       AND aic."status" <> 'RELEASED'
       AND lower(trim(aic."normalized_value")) = 'jamesmanalody@gmail.com'
   );
