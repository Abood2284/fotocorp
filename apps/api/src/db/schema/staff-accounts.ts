import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const staffAccounts = pgTable(
  "staff_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true }),
    createdByStaffId: uuid("created_by_staff_id").references((): AnyPgColumn => staffAccounts.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    check(
      "staff_accounts_role_check",
      sql`${table.role} in ('SUPER_ADMIN','CATALOG_MANAGER','REVIEWER','CAPTION_MANAGER','FINANCE','SUPPORT')`,
    ),
    check("staff_accounts_status_check", sql`${table.status} in ('ACTIVE','DISABLED')`),
    uniqueIndex("staff_accounts_username_lower_uidx").on(sql`lower(${table.username})`),
    index("staff_accounts_status_idx").on(table.status),
  ],
);
