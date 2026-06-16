import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { caricatureCategories } from "./caricature-categories";
import { staffMembers } from "./staff-members";

export const CARICATURE_LANGUAGES = [
  "NO_VISIBLE_TEXT",
  "ENGLISH",
  "HINDI",
  "MARATHI",
  "URDU",
  "MIXED",
  "OTHER",
] as const;

export const CARICATURE_ASSET_STATUSES = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED"] as const;

export const CARICATURE_ASSET_VISIBILITY = ["PRIVATE", "PUBLIC"] as const;

export const caricatureAssets = pgTable(
  "caricature_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    headline: text("headline").notNull(),
    slug: text("slug"),
    description: text("description").notNull(),
    credit: text("credit").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => caricatureCategories.id, { onDelete: "restrict" }),
    language: text("language").notNull(),
    languageOther: text("language_other"),
    visibleText: text("visible_text"),
    visibleTextTranslationEn: text("visible_text_translation_en"),
    hasVisibleText: boolean("has_visible_text").notNull(),
    keywords: text("keywords")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    depictedSubjects: text("depicted_subjects")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    status: text("status").default("DRAFT").notNull(),
    visibility: text("visibility").default("PRIVATE").notNull(),
    originalBucket: text("original_bucket"),
    originalObjectKey: text("original_object_key"),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    width: integer("width"),
    height: integer("height"),
    checksum: text("checksum"),
    createdByStaffId: uuid("created_by_staff_id").references((): AnyPgColumn => staffMembers.id, {
      onDelete: "set null",
    }),
    updatedByStaffId: uuid("updated_by_staff_id").references((): AnyPgColumn => staffMembers.id, {
      onDelete: "set null",
    }),
    publishedByStaffId: uuid("published_by_staff_id").references((): AnyPgColumn => staffMembers.id, {
      onDelete: "set null",
    }),
    publishedRecordAt: timestamp("published_record_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "caricature_assets_language_check",
      sql`${table.language} in ('NO_VISIBLE_TEXT', 'ENGLISH', 'HINDI', 'MARATHI', 'URDU', 'MIXED', 'OTHER')`,
    ),
    check(
      "caricature_assets_status_check",
      sql`${table.status} in ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED')`,
    ),
    check("caricature_assets_visibility_check", sql`${table.visibility} in ('PRIVATE', 'PUBLIC')`),
    uniqueIndex("caricature_assets_slug_uidx")
      .on(table.slug)
      .where(sql`${table.slug} is not null`),
    index("caricature_assets_category_id_idx").on(table.categoryId),
    index("caricature_assets_status_visibility_idx").on(table.status, table.visibility),
    index("caricature_assets_language_idx").on(table.language),
    index("caricature_assets_has_visible_text_idx").on(table.hasVisibleText),
    index("caricature_assets_published_at_idx").on(table.publishedAt),
    index("caricature_assets_credit_idx").on(table.credit),
    index("caricature_assets_deleted_at_idx").on(table.deletedAt),
  ],
);
