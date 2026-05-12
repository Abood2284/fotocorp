import { sql } from "drizzle-orm";
import { bigint, check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const contributors = pgTable(
  "contributors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyPhotographerId: bigint("legacy_photographer_id", { mode: "number" }).unique(),
    displayName: text("display_name").notNull(),
    firstName: text("first_name"),
    middleName: text("middle_name"),
    lastName: text("last_name"),
    email: text("email"),
    mobilePhone: text("mobile_phone"),
    landlinePhone: text("landline_phone"),
    address: text("address"),
    city: text("city"),
    stateRegion: text("state_region"),
    country: text("country"),
    postalCode: text("postal_code"),
    status: text("status").default("UNKNOWN").notNull(),
    legacyStatus: text("legacy_status"),
    source: text("source").default("LEGACY_IMPORT").notNull(),
    legacyPayload: jsonb("legacy_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("contributors_status_check", sql`${table.status} in ('ACTIVE', 'INACTIVE', 'DELETED', 'UNKNOWN')`),
    check("contributors_source_check", sql`${table.source} in ('LEGACY_IMPORT', 'MANUAL')`),
    uniqueIndex("contributors_legacy_photographer_id_unique_idx")
      .on(table.legacyPhotographerId)
      .where(sql`${table.legacyPhotographerId} is not null`),
    index("contributors_status_idx").on(table.status),
    index("contributors_display_name_lower_idx").on(sql`lower(${table.displayName})`),
    index("contributors_email_lower_idx").on(sql`lower(${table.email})`).where(sql`${table.email} is not null`),
    index("contributors_source_idx").on(table.source),
  ],
);
