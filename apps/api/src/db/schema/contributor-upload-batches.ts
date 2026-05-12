import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contributorAccounts } from "./contributor-accounts";
import { contributors } from "./contributors";
import { photoEvents } from "./photo-events";

export const CONTRIBUTOR_UPLOAD_BATCH_STATUSES = ["OPEN", "SUBMITTED", "COMPLETED", "FAILED", "CANCELLED"] as const;

export const contributorUploadBatches = pgTable(
  "contributor_upload_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "restrict" }),
    contributorAccountId: uuid("contributor_account_id")
      .notNull()
      .references(() => contributorAccounts.id, { onDelete: "restrict" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => photoEvents.id, { onDelete: "restrict" }),
    status: text("status").default("OPEN").notNull(),
    assetType: text("asset_type").default("IMAGE").notNull(),
    commonTitle: text("common_title"),
    commonCaption: text("common_caption"),
    commonKeywords: text("common_keywords"),
    totalFiles: integer("total_files").default(0).notNull(),
    uploadedFiles: integer("uploaded_files").default(0).notNull(),
    failedFiles: integer("failed_files").default(0).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "contributor_upload_batches_status_check",
      sql`${table.status} in ('OPEN', 'SUBMITTED', 'COMPLETED', 'FAILED', 'CANCELLED')`,
    ),
    index("contributor_upload_batches_contributor_id_idx").on(table.contributorId),
    index("contributor_upload_batches_account_id_idx").on(table.contributorAccountId),
    index("contributor_upload_batches_event_id_idx").on(table.eventId),
    index("contributor_upload_batches_status_idx").on(table.status),
    index("contributor_upload_batches_created_at_idx").on(table.createdAt),
  ],
);
