import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const AUTH_EMAIL_DOMAIN_VERDICTS = [
  "ALLOW",
  "BLOCK_FREE_EMAIL",
  "BLOCK_DISPOSABLE_EMAIL",
  "BLOCK_NO_MX",
  "VALIDATION_ERROR",
] as const;

export const authEmailDomainChecks = pgTable(
  "auth_email_domain_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domain: text("domain").notNull().unique(),
    verdict: text("verdict").notNull(),
    isFree: boolean("is_free").default(false).notNull(),
    isDisposable: boolean("is_disposable").default(false).notNull(),
    hasMx: boolean("has_mx"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("auth_email_domain_checks_domain_idx").on(table.domain),
    index("auth_email_domain_checks_expires_at_idx").on(table.expiresAt),
  ],
);
