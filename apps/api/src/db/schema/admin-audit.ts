import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { assets } from "./legacy";

export const ASSET_ADMIN_AUDIT_ACTIONS = [
  "ASSET_METADATA_UPDATED",
  "ASSET_PUBLISH_STATE_UPDATED",
] as const;

export const assetAdminAuditLogs = pgTable("asset_admin_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  actorAuthUserId: text("actor_auth_user_id"),
  actorEmail: text("actor_email"),
  before: jsonb("before").notNull(),
  after: jsonb("after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
