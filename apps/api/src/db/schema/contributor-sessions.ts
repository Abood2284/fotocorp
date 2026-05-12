import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contributorAccounts } from "./contributor-accounts";
import { contributors } from "./contributors";

export const contributorSessions = pgTable(
  "contributor_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contributorAccountId: uuid("contributor_account_id")
      .notNull()
      .references(() => contributorAccounts.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("contributor_sessions_token_hash_uidx").on(table.tokenHash),
    index("contributor_sessions_account_id_idx").on(table.contributorAccountId),
    index("contributor_sessions_contributor_id_idx").on(table.contributorId),
    index("contributor_sessions_expires_at_idx").on(table.expiresAt),
    index("contributor_sessions_active_idx")
      .on(table.contributorAccountId, table.expiresAt)
      .where(sql`${table.revokedAt} is null`),
  ],
);
