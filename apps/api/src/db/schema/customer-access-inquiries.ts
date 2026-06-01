import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contributors } from "./contributors";
import { users } from "./users";

export const CUSTOMER_ACCESS_INQUIRY_TYPES = ["USER_ACCESS", "CONTRIBUTOR_APPLICATION"] as const;
export const CUSTOMER_ACCESS_INQUIRY_STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "CLOSED",
  "ACCESS_GRANTED",
  "CONTRIBUTOR_APPROVED",
] as const;

export const customerAccessInquiries = pgTable(
  "customer_access_inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inquiryType: text("inquiry_type").default("USER_ACCESS").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id").references(() => contributors.id, { onDelete: "set null" }),
    status: text("status").default("PENDING").notNull(),
    interestedAssetTypes: text("interested_asset_types")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    imageQuantityRange: text("image_quantity_range"),
    imageQualityPreference: text("image_quality_preference"),
    applicantFirstName: text("applicant_first_name"),
    applicantLastName: text("applicant_last_name"),
    applicantEmail: text("applicant_email"),
    applicantPhoneCountryCode: text("applicant_phone_country_code"),
    applicantPhoneNumber: text("applicant_phone_number"),
    proposedUsername: text("proposed_username"),
    applicationNotes: text("application_notes"),
    staffNotes: text("staff_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "customer_access_inquiries_status_check",
      sql`${table.status} in ('PENDING','IN_REVIEW','CLOSED','ACCESS_GRANTED','CONTRIBUTOR_APPROVED')`,
    ),
    check(
      "customer_access_inquiries_inquiry_type_check",
      sql`${table.inquiryType} in ('USER_ACCESS','CONTRIBUTOR_APPLICATION')`,
    ),
    check(
      "customer_access_inquiries_owner_shape_check",
      sql`(
        (${table.inquiryType} = 'USER_ACCESS' and ${table.userId} is not null)
        or (${table.inquiryType} = 'CONTRIBUTOR_APPLICATION' and ${table.contributorId} is not null)
      )`,
    ),
    index("customer_access_inquiries_user_id_idx").on(table.userId),
    index("customer_access_inquiries_status_created_idx").on(table.status, table.createdAt),
    index("customer_access_inquiries_inquiry_type_created_idx").on(table.inquiryType, table.createdAt),
  ],
);
