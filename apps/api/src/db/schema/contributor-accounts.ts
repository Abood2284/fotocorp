import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contributors } from "./contributors";

export const contributorAccounts = pgTable(
  "contributor_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "restrict" }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    mustChangePassword: boolean("must_change_password").default(true).notNull(),
    portalRole: text("portal_role").default("STANDARD").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("contributor_accounts_status_check", sql`${table.status} in ('ACTIVE', 'DISABLED', 'LOCKED')`),
    check("contributor_accounts_portal_role_check", sql`${table.portalRole} in ('STANDARD', 'PORTAL_ADMIN')`),
    uniqueIndex("contributor_accounts_username_lower_uidx").on(sql`lower(${table.username})`),
    uniqueIndex("contributor_accounts_contributor_id_uidx").on(table.contributorId),
    index("contributor_accounts_status_idx").on(table.status),
    index("contributor_accounts_created_at_idx").on(table.createdAt),
  ],
);
