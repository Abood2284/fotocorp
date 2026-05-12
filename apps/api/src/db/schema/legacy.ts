import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const assetCategories = pgTable(
  "asset_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyCategoryCode: integer("legacy_category_code").unique(),
    name: text("name").notNull(),
    slug: text("slug"),
    parentLegacyCategoryCode: integer("parent_legacy_category_code"),
    includeFile: text("include_file"),
    legacyPayload: jsonb("legacy_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("asset_categories_name_idx").on(table.name),
    index("asset_categories_parent_legacy_category_code_idx").on(table.parentLegacyCategoryCode),
  ],
);

export const assetEvents = pgTable(
  "asset_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyEventId: bigint("legacy_event_id", { mode: "number" }).unique(),
    name: text("name"),
    eventDate: timestamp("event_date", { withTimezone: true }),
    country: text("country"),
    state: text("state"),
    city: text("city"),
    location: text("location"),
    keywords: text("keywords"),
    photoCount: bigint("photo_count", { mode: "number" }),
    photoCountUnpublished: bigint("photo_count_unpublished", { mode: "number" }),
    smallImage1: text("small_image_1"),
    smallImage2: text("small_image_2"),
    legacyPayload: jsonb("legacy_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("asset_events_legacy_event_id_idx").on(table.legacyEventId),
    index("asset_events_event_date_idx").on(table.eventDate),
  ],
);

export const photographerProfiles = pgTable(
  "photographer_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id"),
    legacyPhotographerId: bigint("legacy_photographer_id", { mode: "number" }).unique(),
    displayName: text("display_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    profileSource: text("profile_source").default("MANUAL").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    legacyPayload: jsonb("legacy_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("photographer_profiles_profile_source_check", sql`${table.profileSource} in ('MANUAL', 'LEGACY_IMPORT')`),
    check("photographer_profiles_status_check", sql`${table.status} in ('ACTIVE', 'INACTIVE', 'LEGACY_ONLY', 'SUSPENDED')`),
    index("photographer_profiles_user_id_idx").on(table.userId),
    index("photographer_profiles_status_idx").on(table.status),
    index("photographer_profiles_profile_source_idx").on(table.profileSource),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacySource: text("legacy_source"),
    legacySrno: bigint("legacy_srno", { mode: "number" }),
    legacyEventId: bigint("legacy_event_id", { mode: "number" }),
    legacyPhotographerId: bigint("legacy_photographer_id", { mode: "number" }),
    legacyImagecode: text("legacy_imagecode"),
    r2OriginalKey: text("r2_original_key"),
    originalFilename: text("original_filename"),
    originalExt: text("original_ext"),
    r2Exists: boolean("r2_exists").default(false).notNull(),
    r2CheckedAt: timestamp("r2_checked_at", { withTimezone: true }),
    title: text("title"),
    caption: text("caption"),
    headline: text("headline"),
    description: text("description"),
    keywords: text("keywords"),
    eventKeywords: text("event_keywords"),
    imageLocation: text("image_location"),
    searchText: text("search_text"),
    imageDate: timestamp("image_date", { withTimezone: true }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    legacyStatus: integer("legacy_status"),
    status: text("status").default("DRAFT").notNull(),
    visibility: text("visibility").default("PRIVATE").notNull(),
    mediaType: text("media_type").default("IMAGE").notNull(),
    source: text("source").default("MANUAL").notNull(),
    categoryId: uuid("category_id").references(() => assetCategories.id, { onDelete: "set null" }),
    photographerProfileId: uuid("photographer_profile_id").references(() => photographerProfiles.id, { onDelete: "set null" }),
    eventId: uuid("event_id").references(() => assetEvents.id, { onDelete: "set null" }),
    legacyPayload: jsonb("legacy_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("assets_legacy_source_legacy_srno_unique").on(table.legacySource, table.legacySrno),
    check("assets_status_check", sql`${table.status} in ('DRAFT', 'REVIEW', 'APPROVED', 'READY', 'PUBLISHED', 'ARCHIVED', 'REJECTED')`),
    check("assets_visibility_check", sql`${table.visibility} in ('PRIVATE', 'PUBLIC', 'UNLISTED')`),
    check("assets_media_type_check", sql`${table.mediaType} in ('IMAGE', 'VIDEO', 'OTHER')`),
    check("assets_source_check", sql`${table.source} in ('MANUAL', 'LEGACY_IMPORT', 'ADMIN_UPLOAD', 'PHOTOGRAPHER_UPLOAD')`),
    index("assets_legacy_imagecode_idx").on(table.legacyImagecode),
    index("assets_legacy_photographer_id_idx").on(table.legacyPhotographerId),
    index("assets_r2_original_key_idx").on(table.r2OriginalKey),
    index("assets_r2_exists_idx").on(table.r2Exists),
    index("assets_status_idx").on(table.status),
    index("assets_visibility_idx").on(table.visibility),
    index("assets_source_idx").on(table.source),
    index("assets_legacy_status_idx").on(table.legacyStatus),
    index("assets_event_id_idx").on(table.eventId),
    index("assets_category_id_idx").on(table.categoryId),
    index("assets_photographer_profile_id_idx").on(table.photographerProfileId),
    index("assets_image_date_idx").on(table.imageDate),
    index("assets_uploaded_at_idx").on(table.uploadedAt),
    index("assets_public_browse_idx")
      .on(table.imageDate, table.id)
      .where(sql`${table.status} = 'APPROVED' and ${table.visibility} = 'PUBLIC' and ${table.mediaType} = 'IMAGE' and ${table.r2Exists} = true`),
    index("assets_public_category_idx")
      .on(table.categoryId, table.imageDate, table.id)
      .where(sql`${table.status} = 'APPROVED' and ${table.visibility} = 'PUBLIC' and ${table.mediaType} = 'IMAGE' and ${table.r2Exists} = true`),
    index("assets_public_event_idx")
      .on(table.eventId, table.imageDate, table.id)
      .where(sql`${table.status} = 'APPROVED' and ${table.visibility} = 'PUBLIC' and ${table.mediaType} = 'IMAGE' and ${table.r2Exists} = true`),
    index("assets_public_photographer_idx")
      .on(table.photographerProfileId, table.imageDate, table.id)
      .where(sql`${table.status} = 'APPROVED' and ${table.visibility} = 'PUBLIC' and ${table.mediaType} = 'IMAGE' and ${table.r2Exists} = true`),
  ],
);

export const assetImportBatches = pgTable(
  "asset_import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceName: text("source_name").notNull(),
    sourceTable: text("source_table"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    totalRows: integer("total_rows").default(0).notNull(),
    insertedRows: integer("inserted_rows").default(0).notNull(),
    updatedRows: integer("updated_rows").default(0).notNull(),
    r2MatchedRows: integer("r2_matched_rows").default(0).notNull(),
    r2MissingRows: integer("r2_missing_rows").default(0).notNull(),
    duplicateImagecodeRows: integer("duplicate_imagecode_rows").default(0).notNull(),
    failedRows: integer("failed_rows").default(0).notNull(),
    status: text("status").default("RUNNING").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("asset_import_batches_status_check", sql`${table.status} in ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ISSUES', 'FAILED', 'CANCELLED')`),
    index("asset_import_batches_status_idx").on(table.status),
    index("asset_import_batches_source_table_idx").on(table.sourceTable),
  ],
);

export const assetImportIssues = pgTable(
  "asset_import_issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id").references(() => assetImportBatches.id, { onDelete: "cascade" }),
    legacySource: text("legacy_source"),
    legacySrno: bigint("legacy_srno", { mode: "number" }),
    legacyImagecode: text("legacy_imagecode"),
    issueType: text("issue_type").notNull(),
    severity: text("severity").default("WARNING").notNull(),
    message: text("message").notNull(),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "asset_import_issues_issue_type_check",
      sql`${table.issueType} in ('MISSING_R2_OBJECT', 'DUPLICATE_IMAGECODE', 'MISSING_EVENT', 'MISSING_CATEGORY', 'MISSING_PHOTOGRAPHER', 'INVALID_DATE', 'UNKNOWN_STATUS', 'IMPORT_ERROR')`,
    ),
    check("asset_import_issues_severity_check", sql`${table.severity} in ('INFO', 'WARNING', 'ERROR')`),
    index("asset_import_issues_batch_id_idx").on(table.batchId),
    index("asset_import_issues_issue_type_idx").on(table.issueType),
    index("asset_import_issues_severity_idx").on(table.severity),
    index("asset_import_issues_legacy_imagecode_idx").on(table.legacyImagecode),
  ],
);
