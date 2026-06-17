import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { caricatureAssets } from "./caricature-assets";
import { staffMembers } from "./staff-members";

export const CARICATURE_PREVIEW_JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
] as const;
export type CaricaturePreviewJobStatus = (typeof CARICATURE_PREVIEW_JOB_STATUSES)[number];

export const caricaturePreviewJobs = pgTable(
  "caricature_preview_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caricatureAssetId: uuid("caricature_asset_id")
      .notNull()
      .references(() => caricatureAssets.id, { onDelete: "cascade" }),
    status: text("status").default("QUEUED").notNull(),
    publishOnSuccess: boolean("publish_on_success").default(true).notNull(),
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
      "caricature_preview_jobs_status_check",
      sql`${table.status} in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')`,
    ),
    index("caricature_preview_jobs_status_idx").on(table.status),
    index("caricature_preview_jobs_caricature_asset_id_idx").on(table.caricatureAssetId),
  ],
);
