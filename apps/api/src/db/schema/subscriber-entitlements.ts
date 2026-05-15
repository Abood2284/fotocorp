import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { betterAuthUsers } from "./auth";
import { customerAccessInquiries } from "./customer-access-inquiries";
import { staffAccounts } from "./staff-accounts";

export const SUBSCRIBER_ENTITLEMENT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED"] as const;

export const subscriberEntitlements = pgTable(
  "subscriber_entitlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => betterAuthUsers.id, { onDelete: "cascade" }),
    sourceInquiryId: uuid("source_inquiry_id").references(() => customerAccessInquiries.id, {
      onDelete: "set null",
    }),
    assetType: text("asset_type").notNull(),
    allowedDownloads: integer("allowed_downloads"),
    downloadsUsed: integer("downloads_used").default(0).notNull(),
    qualityAccess: text("quality_access").notNull(),
    status: text("status").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    createdByStaffId: uuid("created_by_staff_id").references((): AnyPgColumn => staffAccounts.id, {
      onDelete: "set null",
    }),
    approvedByStaffId: uuid("approved_by_staff_id").references((): AnyPgColumn => staffAccounts.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("subscriber_entitlements_asset_type_check", sql`${table.assetType} in ('IMAGE','VIDEO','CARICATURE')`),
    check(
      "subscriber_entitlements_status_check",
      sql`${table.status} in ('DRAFT','ACTIVE','EXPIRED','SUSPENDED','CANCELLED')`,
    ),
    check(
      "subscriber_entitlements_quality_access_check",
      sql`${table.qualityAccess} in ('LOW','MEDIUM','HIGH')`,
    ),
    check("subscriber_entitlements_downloads_used_check", sql`${table.downloadsUsed} >= 0`),
    index("subscriber_entitlements_user_id_idx").on(table.userId),
    index("subscriber_entitlements_status_idx").on(table.status),
    index("subscriber_entitlements_source_inquiry_idx").on(table.sourceInquiryId),
  ],
);
