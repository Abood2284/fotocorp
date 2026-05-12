import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { imageAssets } from "./image-assets";

export const IMAGE_DOWNLOAD_SIZES = ["WEB", "MEDIUM", "LARGE"] as const;
export const IMAGE_DOWNLOAD_STATUSES = ["STARTED", "COMPLETED", "FAILED"] as const;
export const IMAGE_DOWNLOAD_LOG_SOURCES = ["LEGACY_MIGRATION", "APPLICATION"] as const;

export const imageDownloadLogs = pgTable(
  "image_download_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    imageAssetId: uuid("image_asset_id").references(() => imageAssets.id, { onDelete: "set null" }),
    authUserId: text("auth_user_id").notNull(),
    appUserProfileId: text("app_user_profile_id"),
    downloadSize: text("download_size").notNull(),
    downloadStatus: text("download_status").notNull(),
    quotaBefore: integer("quota_before"),
    quotaAfter: integer("quota_after"),
    bytesServed: bigint("bytes_served", { mode: "number" }),
    contentType: text("content_type"),
    failureCode: text("failure_code"),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    source: text("source").default("LEGACY_MIGRATION").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("image_download_logs_size_check", sql`${table.downloadSize} in ('WEB', 'MEDIUM', 'LARGE')`),
    check("image_download_logs_status_check", sql`${table.downloadStatus} in ('STARTED', 'COMPLETED', 'FAILED')`),
    check("image_download_logs_source_check", sql`${table.source} in ('LEGACY_MIGRATION', 'APPLICATION')`),
    index("image_download_logs_image_asset_id_idx").on(table.imageAssetId),
    index("image_download_logs_auth_user_id_idx").on(table.authUserId),
    index("image_download_logs_app_user_profile_id_idx").on(table.appUserProfileId),
    index("image_download_logs_download_size_idx").on(table.downloadSize),
    index("image_download_logs_download_status_idx").on(table.downloadStatus),
    index("image_download_logs_created_at_idx").on(table.createdAt),
    index("image_download_logs_failure_code_idx").on(table.failureCode),
  ],
);
