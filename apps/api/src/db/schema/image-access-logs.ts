import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { imageAssets } from "./image-assets";
import { imageDerivatives } from "./image-derivatives";

export const IMAGE_ACCESS_LOG_VARIANTS = ["THUMB", "CARD", "DETAIL"] as const;
export const IMAGE_ACCESS_LOG_OUTCOMES = [
  "SERVED",
  "NOT_FOUND",
  "PREVIEW_NOT_READY",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_TOKEN",
  "R2_ERROR",
] as const;
export const IMAGE_ACCESS_LOG_SOURCES = ["LEGACY_MIGRATION", "APPLICATION"] as const;

export const imageAccessLogs = pgTable(
  "image_access_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    imageAssetId: uuid("image_asset_id").references(() => imageAssets.id, { onDelete: "set null" }),
    imageDerivativeId: uuid("image_derivative_id").references(() => imageDerivatives.id, { onDelete: "set null" }),
    variant: text("variant"),
    requesterUserId: text("requester_user_id"),
    requesterRole: text("requester_role"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    statusCode: integer("status_code").notNull(),
    outcome: text("outcome").notNull(),
    source: text("source").default("LEGACY_MIGRATION").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("image_access_logs_variant_check", sql`${table.variant} is null or ${table.variant} in ('THUMB', 'CARD', 'DETAIL')`),
    check(
      "image_access_logs_outcome_check",
      sql`${table.outcome} in ('SERVED', 'NOT_FOUND', 'PREVIEW_NOT_READY', 'UNAUTHORIZED', 'FORBIDDEN', 'INVALID_TOKEN', 'R2_ERROR')`,
    ),
    check("image_access_logs_source_check", sql`${table.source} in ('LEGACY_MIGRATION', 'APPLICATION')`),
    index("image_access_logs_image_asset_id_idx").on(table.imageAssetId),
    index("image_access_logs_image_derivative_id_idx").on(table.imageDerivativeId),
    index("image_access_logs_variant_idx").on(table.variant),
    index("image_access_logs_outcome_idx").on(table.outcome),
    index("image_access_logs_status_code_idx").on(table.statusCode),
    index("image_access_logs_created_at_idx").on(table.createdAt),
    index("image_access_logs_requester_user_id_idx").on(table.requesterUserId),
  ],
);
