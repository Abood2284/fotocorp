import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { imageAssets } from "./image-assets";
import { imagePublishJobs } from "./image-publish-jobs";

export const IMAGE_PUBLISH_JOB_ITEM_STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"] as const;
export type ImagePublishJobItemStatus = (typeof IMAGE_PUBLISH_JOB_ITEM_STATUSES)[number];

export const imagePublishJobItems = pgTable(
  "image_publish_job_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => imagePublishJobs.id, { onDelete: "cascade" }),
    imageAssetId: uuid("image_asset_id")
      .notNull()
      .references(() => imageAssets.id, { onDelete: "restrict" }),
    status: text("status").default("QUEUED").notNull(),
    fotokey: text("fotokey").notNull(),
    canonicalOriginalKey: text("canonical_original_key").notNull(),
    sourceBucket: text("source_bucket").notNull(),
    sourceStorageKey: text("source_storage_key").notNull(),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "image_publish_job_items_status_check",
      sql`${table.status} in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')`,
    ),
    index("image_publish_job_items_job_id_idx").on(table.jobId),
    index("image_publish_job_items_image_asset_id_idx").on(table.imageAssetId),
    uniqueIndex("image_publish_job_items_image_asset_id_active_uidx")
      .on(table.imageAssetId)
      .where(sql`${table.status} in ('QUEUED', 'RUNNING')`),
  ],
);
