import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export const USER_ROLES = ["USER", "ADMIN", "SUPER_ADMIN"] as const;
export const USER_SUBSCRIPTION_STATUSES = ["NONE", "ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED"] as const;

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    username: text("username"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
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
    status: text("status").default("ACTIVE").notNull(),
    role: text("role").default("USER").notNull(),
    isSubscriber: boolean("is_subscriber").default(false).notNull(),
    subscriptionStatus: text("subscription_status").default("NONE").notNull(),
    subscriptionPlanId: text("subscription_plan_id"),
    subscriptionStartedAt: timestamp("subscription_started_at", { withTimezone: true }),
    subscriptionEndsAt: timestamp("subscription_ends_at", { withTimezone: true }),
    downloadQuotaLimit: integer("download_quota_limit"),
    downloadQuotaUsed: integer("download_quota_used").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("users_status_check", sql`${table.status} in ('ACTIVE', 'SUSPENDED')`),
    check("users_role_check", sql`${table.role} in ('USER', 'ADMIN', 'SUPER_ADMIN')`),
    check(
      "users_subscription_status_check",
      sql`${table.subscriptionStatus} in ('NONE', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED')`,
    ),
    check("users_download_quota_used_check", sql`${table.downloadQuotaUsed} >= 0`),
    uniqueIndex("users_username_lower_uidx").on(sql`lower(${table.username})`).where(sql`${table.username} is not null`),
    index("users_email_lower_idx").on(sql`lower(${table.email})`),
    index("users_company_email_idx").on(table.companyEmail),
    index("users_status_idx").on(table.status),
    index("users_subscription_status_idx").on(table.subscriptionStatus),
    index("users_is_subscriber_idx").on(table.isSubscriber),
  ],
);
