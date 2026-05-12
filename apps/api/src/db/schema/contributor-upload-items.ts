import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contributorAccounts } from "./contributor-accounts";
import { contributorUploadBatches } from "./contributor-upload-batches";
import { contributors } from "./contributors";
import { imageAssets } from "./image-assets";

export const CONTRIBUTOR_UPLOAD_ITEM_STATUSES = ["PENDING", "UPLOADED", "ASSET_CREATED", "FAILED"] as const;

export const contributorUploadItems = pgTable(
  "contributor_upload_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => contributorUploadBatches.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "restrict" }),
    contributorAccountId: uuid("contributor_account_id")
      .notNull()
      .references(() => contributorAccounts.id, { onDelete: "restrict" }),
    imageAssetId: uuid("image_asset_id").references(() => imageAssets.id, { onDelete: "set null" }),
    originalFileName: text("original_file_name").notNull(),
    originalFileExtension: text("original_file_extension"),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    storageKey: text("storage_key").notNull(),
    uploadStatus: text("upload_status").default("PENDING").notNull(),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "contributor_upload_items_status_check",
      sql`${table.uploadStatus} in ('PENDING', 'UPLOADED', 'ASSET_CREATED', 'FAILED')`,
    ),
    uniqueIndex("contributor_upload_items_storage_key_uidx").on(table.storageKey),
    index("contributor_upload_items_batch_id_idx").on(table.batchId),
    index("contributor_upload_items_contributor_id_idx").on(table.contributorId),
    index("contributor_upload_items_account_id_idx").on(table.contributorAccountId),
    index("contributor_upload_items_image_asset_id_idx").on(table.imageAssetId),
    index("contributor_upload_items_upload_status_idx").on(table.uploadStatus),
  ],
);
