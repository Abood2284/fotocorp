import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const STAFF_MEMBER_STATUSES = ["ACTIVE", "DISABLED"] as const;

export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    email: text("email"),
    phoneCountryCode: text("phone_country_code"),
    phoneNumber: text("phone_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdByStaffMemberId: uuid("created_by_staff_member_id").references((): AnyPgColumn => staffMembers.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    check(
      "staff_members_role_check",
      sql`${table.role} in ('SUPER_ADMIN','CATALOG_MANAGER','REVIEWER','CAPTION_MANAGER','FINANCE','SUPPORT')`,
    ),
    check("staff_members_status_check", sql`${table.status} in ('ACTIVE','DISABLED')`),
    index("staff_members_status_idx").on(table.status),
    index("staff_members_role_idx").on(table.role),
  ],
);
