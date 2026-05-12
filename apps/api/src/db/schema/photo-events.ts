import { sql } from "drizzle-orm";
import { bigint, check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contributorAccounts } from "./contributor-accounts";
import { contributors } from "./contributors";

export const PHOTO_EVENT_CREATED_BY_SOURCES = ["LEGACY_IMPORT", "ADMIN", "CONTRIBUTOR", "SYSTEM"] as const;
export const PHOTO_EVENT_ROW_SOURCES = ["LEGACY_IMPORT", "MANUAL", "CONTRIBUTOR"] as const;

export const photoEvents = pgTable(
  "photo_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyEventId: bigint("legacy_event_id", { mode: "number" }).unique(),
    name: text("name").notNull(),
    description: text("description"),
    eventDate: timestamp("event_date", { withTimezone: true }),
    eventTime: text("event_time"),
    country: text("country"),
    stateRegion: text("state_region"),
    city: text("city"),
    location: text("location"),
    keywords: text("keywords"),
    photoCount: bigint("photo_count", { mode: "number" }),
    unpublishedPhotoCount: bigint("unpublished_photo_count", { mode: "number" }),
    defaultMainImageCode: text("default_main_image_code"),
    defaultUnpublishedMainImageCode: text("default_unpublished_main_image_code"),
    smallImageCode1: text("small_image_code_1"),
    smallImageCode2: text("small_image_code_2"),
    status: text("status").default("UNKNOWN").notNull(),
    source: text("source").default("LEGACY_IMPORT").notNull(),
    createdByContributorId: uuid("created_by_contributor_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    createdByContributorAccountId: uuid("created_by_contributor_account_id").references(() => contributorAccounts.id, {
      onDelete: "set null",
    }),
    createdBySource: text("created_by_source").default("LEGACY_IMPORT").notNull(),
    legacyPayload: jsonb("legacy_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("photo_events_status_check", sql`${table.status} in ('ACTIVE', 'INACTIVE', 'DELETED', 'UNKNOWN')`),
    check("photo_events_source_check", sql`${table.source} in ('LEGACY_IMPORT', 'MANUAL', 'CONTRIBUTOR')`),
    check(
      "photo_events_created_by_source_check",
      sql`${table.createdBySource} in ('LEGACY_IMPORT', 'ADMIN', 'CONTRIBUTOR', 'SYSTEM')`,
    ),
    index("photo_events_legacy_event_id_idx").on(table.legacyEventId),
    index("photo_events_event_date_idx").on(table.eventDate),
    index("photo_events_city_idx").on(table.city),
    index("photo_events_status_idx").on(table.status),
    index("photo_events_source_idx").on(table.source),
    index("photo_events_created_by_contributor_id_idx").on(table.createdByContributorId),
    index("photo_events_created_by_contributor_account_id_idx").on(table.createdByContributorAccountId),
    index("photo_events_created_by_source_idx").on(table.createdBySource),
  ],
);
