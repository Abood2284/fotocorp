import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const ADMIN_USER_AUDIT_ACTIONS = ["USER_SUBSCRIPTION_UPDATED"] as const;

export const adminUserAuditLogs = pgTable("admin_user_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  targetAuthUserId: text("target_auth_user_id").notNull(),
  action: text("action").notNull(),
  actorAuthUserId: text("actor_auth_user_id"),
  actorEmail: text("actor_email"),
  before: jsonb("before").notNull(),
  after: jsonb("after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
