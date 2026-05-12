import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const IMAGE_PUBLISH_JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "PARTIAL_FAILED",
] as const;
export type ImagePublishJobStatus = (typeof IMAGE_PUBLISH_JOB_STATUSES)[number];

export const imagePublishJobs = pgTable(
  "image_publish_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobType: text("job_type").default("CONTRIBUTOR_APPROVAL").notNull(),
    status: text("status").default("QUEUED").notNull(),
    requestedByAdminUserId: text("requested_by_admin_user_id"),
    totalItems: integer("total_items").default(0).notNull(),
    completedItems: integer("completed_items").default(0).notNull(),
    failedItems: integer("failed_items").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "image_publish_jobs_status_check",
      sql`${table.status} in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL_FAILED')`,
    ),
    index("image_publish_jobs_status_idx").on(table.status),
  ],
);
