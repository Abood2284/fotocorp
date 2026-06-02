-- P4 users platform cutover (schema companion to apply-users-p4-migration.ts).
-- On Development, run: pnpm --dir apps/api db:apply:users-p4-migration
-- That script backfills users, repoints FKs, and truncates Better Auth + legacy profile tables.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'USER' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" in ('USER', 'ADMIN', 'SUPER_ADMIN'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
