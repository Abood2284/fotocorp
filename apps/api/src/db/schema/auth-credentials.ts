import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const AUTH_CREDENTIAL_OWNER_TYPES = ["USER", "STAFF", "CONTRIBUTOR"] as const;
export const AUTH_CREDENTIAL_IDENTIFIER_TYPES = ["USERNAME", "EMAIL"] as const;
export const AUTH_CREDENTIAL_STATUSES = ["ACTIVE", "DISABLED", "LOCKED"] as const;

export const authCredentials = pgTable(
  "auth_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    loginIdentifier: text("login_identifier").notNull(),
    identifierType: text("identifier_type").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    mustResetPassword: boolean("must_reset_password").default(false).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "auth_credentials_owner_type_check",
      sql`${table.ownerType} in ('USER', 'STAFF', 'CONTRIBUTOR')`,
    ),
    check(
      "auth_credentials_identifier_type_check",
      sql`${table.identifierType} in ('USERNAME', 'EMAIL')`,
    ),
    check("auth_credentials_status_check", sql`${table.status} in ('ACTIVE', 'DISABLED', 'LOCKED')`),
    uniqueIndex("auth_credentials_login_identifier_lower_uidx").on(
      table.identifierType,
      sql`lower(${table.loginIdentifier})`,
    ),
    uniqueIndex("auth_credentials_owner_identifier_type_uidx").on(
      table.ownerType,
      table.ownerId,
      table.identifierType,
    ),
    index("auth_credentials_owner_idx").on(table.ownerType, table.ownerId),
    index("auth_credentials_status_idx").on(table.status),
  ],
);
