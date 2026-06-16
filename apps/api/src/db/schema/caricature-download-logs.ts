import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { caricatureAssets } from "./caricature-assets";
import { subscriberEntitlements } from "./subscriber-entitlements";
import { users } from "./users";

export const CARICATURE_DOWNLOAD_FORMATS = ["ORIGINAL"] as const;

export const CARICATURE_DOWNLOAD_STATUSES = ["STARTED", "COMPLETED", "FAILED"] as const;

export const caricatureDownloadLogs = pgTable(
  "caricature_download_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caricatureId: uuid("caricature_id")
      .notNull()
      .references(() => caricatureAssets.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),
    entitlementId: uuid("entitlement_id").references(() => subscriberEntitlements.id, { onDelete: "set null" }),
    downloadFormat: text("download_format").default("ORIGINAL").notNull(),
    status: text("status").notNull(),
    failureReason: text("failure_reason"),
    requestIpHash: text("request_ip_hash"),
    requestCountry: varchar("request_country", { length: 2 }),
    requestRegion: text("request_region"),
    requestCity: text("request_city"),
    requestUserAgent: text("request_user_agent"),
    requestCfRay: text("request_cf_ray"),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("caricature_download_logs_format_check", sql`${table.downloadFormat} in ('ORIGINAL')`),
    check("caricature_download_logs_status_check", sql`${table.status} in ('STARTED', 'COMPLETED', 'FAILED')`),
    index("caricature_download_logs_caricature_id_idx").on(table.caricatureId),
    index("caricature_download_logs_user_id_idx").on(table.userId),
    index("caricature_download_logs_status_idx").on(table.status),
    index("caricature_download_logs_downloaded_at_idx").on(table.downloadedAt),
    index("caricature_download_logs_request_ip_hash_idx").on(table.requestIpHash),
  ],
);
