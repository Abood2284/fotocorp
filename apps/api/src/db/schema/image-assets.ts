import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { assetCategories } from "./legacy";
import { photoEvents } from "./photo-events";
import { contributors } from "./contributors";

export const imageAssets = pgTable(
  "image_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacySource: text("legacy_source"),
    legacyAssetId: bigint("legacy_asset_id", { mode: "number" }),
    legacyImageCode: text("legacy_image_code"),
    title: text("title"),
    headline: text("headline"),
    caption: text("caption"),
    description: text("description"),
    keywords: text("keywords"),
    eventKeywords: text("event_keywords"),
    searchText: text("search_text"),
    imageLocation: text("image_location"),
    contributorId: uuid("contributor_id").references(() => contributors.id, { onDelete: "set null" }),
    legacyPhotographerId: bigint("legacy_photographer_id", { mode: "number" }),
    eventId: uuid("event_id").references(() => photoEvents.id, { onDelete: "set null" }),
    legacyEventId: bigint("legacy_event_id", { mode: "number" }),
    categoryId: uuid("category_id").references(() => assetCategories.id, { onDelete: "set null" }),
    legacyCategoryId: bigint("legacy_category_id", { mode: "number" }),
    legacySubcategoryId: bigint("legacy_subcategory_id", { mode: "number" }),
    originalStorageKey: text("original_storage_key"),
    originalFileName: text("original_file_name"),
    originalFileExtension: text("original_file_extension"),
    originalExistsInStorage: boolean("original_exists_in_storage").default(false).notNull(),
    originalStorageCheckedAt: timestamp("original_storage_checked_at", { withTimezone: true }),
    fotokey: text("fotokey"),
    fotokeyDate: date("fotokey_date"),
    fotokeySequence: bigint("fotokey_sequence", { mode: "number" }),
    fotokeyAssignedAt: timestamp("fotokey_assigned_at", { withTimezone: true }),
    imageDate: timestamp("image_date", { withTimezone: true }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    legacyStatus: integer("legacy_status"),
    status: text("status").default("UNKNOWN").notNull(),
    visibility: text("visibility").default("PRIVATE").notNull(),
    mediaType: text("media_type").default("IMAGE").notNull(),
    source: text("source").default("LEGACY_IMPORT").notNull(),
    legacyPayload: jsonb("legacy_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "image_assets_status_check",
      sql`${table.status} in ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'ARCHIVED', 'DELETED', 'MISSING_ORIGINAL', 'UNKNOWN')`,
    ),
    check("image_assets_visibility_check", sql`${table.visibility} in ('PUBLIC', 'PRIVATE', 'UNLISTED')`),
    check("image_assets_media_type_check", sql`${table.mediaType} in ('IMAGE')`),
    check(
      "image_assets_source_check",
      sql`${table.source} in ('LEGACY_IMPORT', 'MANUAL', 'CONTRIBUTOR_UPLOAD', 'FOTOCORP')`,
    ),
    uniqueIndex("image_assets_legacy_source_asset_id_uidx")
      .on(table.legacySource, table.legacyAssetId)
      .where(sql`${table.legacySource} is not null and ${table.legacyAssetId} is not null`),
    uniqueIndex("image_assets_fotokey_uidx")
      .on(table.fotokey)
      .where(sql`${table.fotokey} is not null`),
    index("image_assets_fotokey_date_sequence_idx")
      .on(table.fotokeyDate, table.fotokeySequence)
      .where(sql`${table.fotokey} is not null`),
    index("image_assets_legacy_image_code_idx").on(table.legacyImageCode),
    index("image_assets_contributor_id_idx").on(table.contributorId),
    index("image_assets_legacy_photographer_id_idx").on(table.legacyPhotographerId),
    index("image_assets_event_id_idx").on(table.eventId),
    index("image_assets_legacy_event_id_idx").on(table.legacyEventId),
    index("image_assets_category_id_idx").on(table.categoryId),
    index("image_assets_status_visibility_idx").on(table.status, table.visibility),
    index("image_assets_image_date_idx").on(table.imageDate),
    index("image_assets_source_idx").on(table.source),
  ],
);
