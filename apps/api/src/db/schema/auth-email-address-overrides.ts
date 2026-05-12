import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { AUTH_EMAIL_OVERRIDE_DECISIONS } from "./auth-email-domain-overrides";

export const authEmailAddressOverrides = pgTable(
  "auth_email_address_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    decision: text("decision", { enum: AUTH_EMAIL_OVERRIDE_DECISIONS }).notNull(),
    reason: text("reason"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("auth_email_address_overrides_email_idx").on(table.email)],
);
