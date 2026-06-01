import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { authCredentials } from "./auth-credentials";

export const AUTH_SESSION_OWNER_TYPES = ["USER", "STAFF", "CONTRIBUTOR"] as const;

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    credentialId: uuid("credential_id")
      .notNull()
      .references(() => authCredentials.id, { onDelete: "cascade" }),
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    sessionTokenHash: text("session_token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "auth_sessions_owner_type_check",
      sql`${table.ownerType} in ('USER', 'STAFF', 'CONTRIBUTOR')`,
    ),
    uniqueIndex("auth_sessions_session_token_hash_uidx").on(table.sessionTokenHash),
    index("auth_sessions_credential_id_idx").on(table.credentialId),
    index("auth_sessions_owner_idx").on(table.ownerType, table.ownerId),
    index("auth_sessions_expires_at_idx").on(table.expiresAt),
    index("auth_sessions_active_idx")
      .on(table.ownerType, table.ownerId, table.expiresAt)
      .where(sql`${table.revokedAt} is null`),
  ],
);
