ALTER TABLE "contributors" DROP CONSTRAINT "contributors_source_check";--> statement-breakpoint
ALTER TABLE "contributors" DROP COLUMN "legacy_status";--> statement-breakpoint
ALTER TABLE "contributors" DROP COLUMN "legacy_payload";--> statement-breakpoint
ALTER TABLE "contributors" ADD CONSTRAINT "contributors_source_check" CHECK ("contributors"."source" in ('LEGACY_IMPORT', 'MANUAL', 'APPLICATION'));