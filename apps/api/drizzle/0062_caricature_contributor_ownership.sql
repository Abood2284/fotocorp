ALTER TABLE "caricature_assets" ADD COLUMN "created_by_contributor_id" uuid;--> statement-breakpoint
ALTER TABLE "caricature_assets" ADD CONSTRAINT "caricature_assets_created_by_contributor_id_contributors_id_fk" FOREIGN KEY ("created_by_contributor_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "caricature_assets_created_by_contributor_id_idx" ON "caricature_assets" USING btree ("created_by_contributor_id");--> statement-breakpoint
-- Best-effort ownership backfill for contributor portal uploads that used display-name credit
-- and were not created by staff. Only assign when the credit uniquely matches one contributor.
UPDATE "caricature_assets" AS ca
SET "created_by_contributor_id" = c.id
FROM "contributors" AS c
WHERE ca."created_by_contributor_id" IS NULL
  AND ca."deleted_at" IS NULL
  AND ca."created_by_staff_id" IS NULL
  AND lower(trim(ca."credit")) = lower(trim(c."display_name"))
  AND (
    SELECT count(*)::int
    FROM "contributors" AS c2
    WHERE lower(trim(c2."display_name")) = lower(trim(c."display_name"))
  ) = 1;
