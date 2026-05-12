import { bigint, check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { assets } from "./legacy";

export const DOWNLOAD_SIZES = ["WEB", "MEDIUM", "LARGE"] as const;
export const DOWNLOAD_STATUSES = ["STARTED", "FAILED"] as const;

export const assetDownloadLogs = pgTable(
  "asset_download_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("asset_download_logs_size_check", sql`${table.downloadSize} in ('WEB', 'MEDIUM', 'LARGE')`),
    check("asset_download_logs_status_check", sql`${table.downloadStatus} in ('STARTED', 'FAILED')`),
    index("asset_download_logs_asset_id_idx").on(table.assetId),
    index("asset_download_logs_auth_user_id_idx").on(table.authUserId),
    index("asset_download_logs_app_user_profile_id_idx").on(table.appUserProfileId),
    index("asset_download_logs_created_at_idx").on(table.createdAt),
    index("asset_download_logs_status_idx").on(table.downloadStatus),
  ],
);
