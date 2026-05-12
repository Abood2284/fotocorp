CREATE TABLE "admin_user_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_auth_user_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_auth_user_id" text,
	"actor_email" text,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
