import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { staffAccounts } from "./staff-accounts";

export const staffAuditLogs = pgTable(
  "staff_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffAccountId: uuid("staff_account_id").references(() => staffAccounts.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("staff_audit_logs_staff_account_id_idx").on(table.staffAccountId),
    index("staff_audit_logs_created_at_idx").on(table.createdAt),
  ],
);
