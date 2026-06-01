import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const AUTH_IDENTITY_CLAIM_TYPES = ["USERNAME", "EMAIL", "PHONE"] as const;
export const AUTH_IDENTITY_CLAIM_OWNER_TYPES = ["USER", "STAFF", "CONTRIBUTOR"] as const;
export const AUTH_IDENTITY_CLAIM_STATUSES = ["PENDING", "ACTIVE", "RELEASED"] as const;

export const authIdentityClaims = pgTable(
  "auth_identity_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    claimType: text("claim_type").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("auth_identity_claims_claim_type_check", sql`${table.claimType} in ('USERNAME', 'EMAIL', 'PHONE')`),
    check(
      "auth_identity_claims_owner_type_check",
      sql`${table.ownerType} in ('USER', 'STAFF', 'CONTRIBUTOR')`,
    ),
    check("auth_identity_claims_status_check", sql`${table.status} in ('PENDING', 'ACTIVE', 'RELEASED')`),
    uniqueIndex("auth_identity_claims_type_value_uidx").on(table.claimType, table.normalizedValue),
    index("auth_identity_claims_owner_idx").on(table.ownerType, table.ownerId),
    index("auth_identity_claims_status_idx").on(table.status),
  ],
);
