import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const APP_ROLES = ["USER", "CONTRIBUTOR", "ADMIN", "SUPER_ADMIN"] as const;
export const APP_USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export const SUBSCRIPTION_STATUSES = ["NONE", "ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED"] as const;

export const appUserProfiles = pgTable(
  "app_user_profiles",
  {
    id: text("id").$defaultFn(() => crypto.randomUUID()).primaryKey(),
    authUserId: text("auth_user_id").notNull().unique(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    role: text("role").default("USER").notNull(),
    status: text("status").default("ACTIVE").notNull(),
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
    check("app_user_profiles_role_check", sql`${table.role} in ('USER', 'CONTRIBUTOR', 'ADMIN', 'SUPER_ADMIN')`),
    check("app_user_profiles_status_check", sql`${table.status} in ('ACTIVE', 'SUSPENDED')`),
    check(
      "app_user_profiles_subscription_status_check",
      sql`${table.subscriptionStatus} in ('NONE', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED')`,
    ),
    check("app_user_profiles_download_quota_used_check", sql`${table.downloadQuotaUsed} >= 0`),
    index("app_user_profiles_email_idx").on(sql`lower(${table.email})`),
    index("app_user_profiles_role_idx").on(table.role),
    index("app_user_profiles_status_idx").on(table.status),
    index("app_user_profiles_subscription_status_idx").on(table.subscriptionStatus),
    index("app_user_profiles_is_subscriber_idx").on(table.isSubscriber),
  ],
);
