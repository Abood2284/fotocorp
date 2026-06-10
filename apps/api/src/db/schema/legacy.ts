import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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

