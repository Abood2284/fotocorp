import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const AUTH_EMAIL_OVERRIDE_DECISIONS = ["ALLOW", "BLOCK"] as const;

export const authEmailDomainOverrides = pgTable(
  "auth_email_domain_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domain: text("domain").notNull().unique(),
    decision: text("decision", { enum: AUTH_EMAIL_OVERRIDE_DECISIONS }).notNull(),
    reason: text("reason"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("auth_email_domain_overrides_domain_idx").on(table.domain)],
);
