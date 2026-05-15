import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { betterAuthUsers } from "./auth";

export const CUSTOMER_ACCESS_INQUIRY_STATUSES = ["PENDING", "IN_REVIEW", "CLOSED", "ACCESS_GRANTED"] as const;

export const customerAccessInquiries = pgTable(
  "customer_access_inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => betterAuthUsers.id, { onDelete: "cascade" }),
    status: text("status").default("PENDING").notNull(),
    interestedAssetTypes: text("interested_asset_types")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    imageQuantityRange: text("image_quantity_range"),
    imageQualityPreference: text("image_quality_preference"),
    staffNotes: text("staff_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "customer_access_inquiries_status_check",
      sql`${table.status} in ('PENDING','IN_REVIEW','CLOSED','ACCESS_GRANTED')`,
    ),
    index("customer_access_inquiries_auth_user_id_idx").on(table.authUserId),
    index("customer_access_inquiries_status_created_idx").on(table.status, table.createdAt),
  ],
);
