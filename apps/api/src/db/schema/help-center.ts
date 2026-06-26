import { sql } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { staffMembers } from "./staff-members"

export const HELP_ARTICLE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const
export const HELP_ARTICLE_VISIBILITY = ["STAFF_ONLY"] as const
export const HELP_ARTICLE_DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const
export const HELP_MEDIA_TYPES = ["IMAGE", "VIDEO"] as const
export const HELP_MEDIA_UPLOAD_STATUSES = ["PENDING", "READY", "FAILED"] as const

export const helpCategories = pgTable(
  "help_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("help_categories_slug_uidx").on(table.slug),
    index("help_categories_is_active_idx").on(table.isActive),
    index("help_categories_display_order_idx").on(table.displayOrder),
  ],
)

export const helpArticles = pgTable(
  "help_articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => helpCategories.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary").notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    status: text("status").default("DRAFT").notNull(),
    visibility: text("visibility").default("STAFF_ONLY").notNull(),
    audienceRoles: text("audience_roles")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    difficulty: text("difficulty"),
    estimatedMinutes: integer("estimated_minutes"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdByStaffId: uuid("created_by_staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "restrict" }),
    updatedByStaffId: uuid("updated_by_staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "restrict" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "help_articles_status_check",
      sql`${table.status} in ('DRAFT','PUBLISHED','ARCHIVED')`,
    ),
    check("help_articles_visibility_check", sql`${table.visibility} in ('STAFF_ONLY')`),
    check(
      "help_articles_difficulty_check",
      sql`${table.difficulty} is null or ${table.difficulty} in ('BEGINNER','INTERMEDIATE','ADVANCED')`,
    ),
    uniqueIndex("help_articles_slug_uidx").on(table.slug),
    index("help_articles_category_id_idx").on(table.categoryId),
    index("help_articles_status_idx").on(table.status),
    index("help_articles_published_at_idx").on(table.publishedAt),
    index("help_articles_sort_order_idx").on(table.sortOrder),
    index("help_articles_created_by_staff_id_idx").on(table.createdByStaffId),
    index("help_articles_updated_by_staff_id_idx").on(table.updatedByStaffId),
    // TODO: add GIN/tsvector index for full-text search when Typesense or Postgres FTS is wired.
  ],
)

export const helpTags = pgTable(
  "help_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("help_tags_slug_uidx").on(table.slug),
    uniqueIndex("help_tags_name_uidx").on(table.name),
    index("help_tags_slug_idx").on(table.slug),
  ],
)

export const helpArticleTags = pgTable(
  "help_article_tags",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => helpArticles.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => helpTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.tagId], name: "help_article_tags_pkey" }),
    index("help_article_tags_article_id_idx").on(table.articleId),
    index("help_article_tags_tag_id_idx").on(table.tagId),
  ],
)

export const helpArticleMedia = pgTable(
  "help_article_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => helpArticles.id, { onDelete: "cascade" }),
    mediaType: text("media_type").notNull(),
    title: text("title"),
    description: text("description"),
    storageKey: text("storage_key"),
    mimeType: text("mime_type"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    durationSeconds: integer("duration_seconds"),
    width: integer("width"),
    height: integer("height"),
    uploadStatus: text("upload_status").default("PENDING").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdByStaffId: uuid("created_by_staff_id").references(() => staffMembers.id, { onDelete: "set null" }),
    updatedByStaffId: uuid("updated_by_staff_id").references(() => staffMembers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("help_article_media_type_check", sql`${table.mediaType} in ('IMAGE','VIDEO')`),
    check(
      "help_article_media_upload_status_check",
      sql`${table.uploadStatus} in ('PENDING','READY','FAILED')`,
    ),
    index("help_article_media_article_id_idx").on(table.articleId),
    index("help_article_media_article_upload_status_idx").on(table.articleId, table.uploadStatus),
    index("help_article_media_type_idx").on(table.mediaType),
    index("help_article_media_sort_order_idx").on(table.sortOrder),
    index("help_article_media_created_by_staff_id_idx").on(table.createdByStaffId),
  ],
)

export const helpArticleRelated = pgTable(
  "help_article_related",
  {
    articleId: uuid("article_id")
      .notNull()
      .references((): AnyPgColumn => helpArticles.id, { onDelete: "cascade" }),
    relatedArticleId: uuid("related_article_id")
      .notNull()
      .references((): AnyPgColumn => helpArticles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.articleId, table.relatedArticleId],
      name: "help_article_related_pkey",
    }),
    check(
      "help_article_related_no_self_ref",
      sql`${table.articleId} <> ${table.relatedArticleId}`,
    ),
    index("help_article_related_article_id_idx").on(table.articleId),
    index("help_article_related_related_article_id_idx").on(table.relatedArticleId),
  ],
)

export const helpArticleFeedback = pgTable(
  "help_article_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => helpArticles.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    wasHelpful: boolean("was_helpful").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("help_article_feedback_article_staff_uidx").on(table.articleId, table.staffId),
    index("help_article_feedback_article_id_idx").on(table.articleId),
    index("help_article_feedback_staff_id_idx").on(table.staffId),
    index("help_article_feedback_was_helpful_idx").on(table.wasHelpful),
  ],
)

export const helpContextualLinks = pgTable(
  "help_contextual_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contextKey: text("context_key").notNull(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => helpArticles.id, { onDelete: "cascade" }),
    label: text("label"),
    description: text("description"),
    placement: text("placement").default("PAGE_HEADER").notNull(),
    displayOrder: integer("display_order").default(10).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdByStaffId: uuid("created_by_staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "restrict" }),
    updatedByStaffId: uuid("updated_by_staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "help_contextual_links_placement_check",
      sql`${table.placement} in ('PAGE_HEADER','SIDEBAR_CARD','INLINE_PANEL')`,
    ),
    uniqueIndex("help_contextual_links_context_article_uidx").on(table.contextKey, table.articleId),
    index("help_contextual_links_context_key_idx").on(table.contextKey),
    index("help_contextual_links_article_id_idx").on(table.articleId),
    index("help_contextual_links_is_active_idx").on(table.isActive),
    index("help_contextual_links_context_active_order_idx").on(
      table.contextKey,
      table.isActive,
      table.displayOrder,
    ),
    index("help_contextual_links_created_by_staff_id_idx").on(table.createdByStaffId),
    index("help_contextual_links_updated_by_staff_id_idx").on(table.updatedByStaffId),
  ],
)

export const helpArticleViews = pgTable(
  "help_article_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => helpArticles.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow().notNull(),
    searchQuery: text("search_query"),
  },
  (table) => [
    index("help_article_views_article_id_idx").on(table.articleId),
    index("help_article_views_staff_id_idx").on(table.staffId),
    index("help_article_views_viewed_at_idx").on(table.viewedAt),
  ],
)
