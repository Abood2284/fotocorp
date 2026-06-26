import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { imageAssets } from "./image-assets";
import { staffMembers } from "./staff-members";

export const IMAGE_PREVIEW_REGENERATION_JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
] as const;
export type ImagePreviewRegenerationJobStatus =
  (typeof IMAGE_PREVIEW_REGENERATION_JOB_STATUSES)[number];

export const imagePreviewRegenerationJobs = pgTable(
  "image_preview_regeneration_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    imageAssetId: uuid("image_asset_id")
      .notNull()
      .references(() => imageAssets.id, { onDelete: "cascade" }),
    status: text("status").default("QUEUED").notNull(),
    requestedByStaffId: uuid("requested_by_staff_id").references(() => staffMembers.id, {
      onDelete: "set null",
    }),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "image_preview_regeneration_jobs_status_check",
      sql`${table.status} in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')`,
    ),
    index("image_preview_regeneration_jobs_status_idx").on(table.status),
    index("image_preview_regeneration_jobs_image_asset_id_idx").on(table.imageAssetId),
    uniqueIndex("image_preview_regeneration_jobs_image_asset_id_active_uidx")
      .on(table.imageAssetId)
      .where(sql`${table.status} in ('QUEUED', 'RUNNING')`),
  ],
);
