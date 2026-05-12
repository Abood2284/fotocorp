import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { staffAccounts } from "./staff-accounts";

export const staffSessions = pgTable(
  "staff_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffAccountId: uuid("staff_account_id")
      .notNull()
      .references(() => staffAccounts.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("staff_sessions_session_token_hash_uidx").on(table.sessionTokenHash),
    index("staff_sessions_account_id_idx").on(table.staffAccountId),
    index("staff_sessions_expires_at_idx").on(table.expiresAt),
    index("staff_sessions_active_idx")
      .on(table.staffAccountId, table.expiresAt)
      .where(sql`${table.revokedAt} is null`),
  ],
);
