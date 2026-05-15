import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { betterAuthUsers } from "./auth";

export const fotocorpUserProfiles = pgTable(
  "fotocorp_user_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => betterAuthUsers.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    username: text("username").notNull(),
    companyType: text("company_type").notNull(),
    companyName: text("company_name").notNull(),
    jobTitle: text("job_title").notNull(),
    customJobTitle: text("custom_job_title"),
    companyEmail: text("company_email").notNull(),
    companyEmailDomain: text("company_email_domain").notNull(),
    emailValidationDecision: text("email_validation_decision").notNull(),
    phoneCountryCode: text("phone_country_code").notNull(),
    phoneNumber: text("phone_number").notNull(),
    interestedAssetTypes: text("interested_asset_types")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    imageQuantityRange: text("image_quantity_range"),
    imageQualityPreference: text("image_quality_preference"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("fotocorp_user_profiles_user_id_unique_idx").on(table.userId),
    index("fotocorp_user_profiles_company_email_idx").on(table.companyEmail),
    index("fotocorp_user_profiles_company_email_domain_idx").on(table.companyEmailDomain),
    index("fotocorp_user_profiles_company_type_idx").on(table.companyType),
    index("fotocorp_user_profiles_username_idx").on(table.username),
  ],
);
