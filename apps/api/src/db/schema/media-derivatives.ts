import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { assets } from "./legacy";

export const MEDIA_DERIVATIVE_VARIANTS = ["thumb", "card", "detail"] as const;
export const MEDIA_DERIVATIVE_STATUSES = ["READY", "STALE", "FAILED"] as const;
export const MEDIA_ACCESS_OUTCOMES = [
  "SERVED",
  "NOT_FOUND",
  "PREVIEW_NOT_READY",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_TOKEN",
  "R2_ERROR",
] as const;

export type MediaDerivativeVariant = (typeof MEDIA_DERIVATIVE_VARIANTS)[number];

export const assetMediaDerivatives = pgTable(
  "asset_media_derivatives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    variant: text("variant").notNull(),
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    byteSize: bigint("byte_size", { mode: "number" }),
    checksum: text("checksum"),
    isWatermarked: boolean("is_watermarked").default(true).notNull(),
    watermarkProfile: text("watermark_profile"),
    generationStatus: text("generation_status").default("READY").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("asset_media_derivatives_asset_id_variant_unique").on(table.assetId, table.variant),
    check("asset_media_derivatives_variant_check", sql`${table.variant} in ('thumb', 'card', 'detail')`),
    check(
      "asset_media_derivatives_generation_status_check",
      sql`${table.generationStatus} in ('READY', 'STALE', 'FAILED')`,
    ),
    index("asset_media_derivatives_asset_id_idx").on(table.assetId),
    index("asset_media_derivatives_variant_idx").on(table.variant),
    index("asset_media_derivatives_generation_status_idx").on(table.generationStatus),
    index("asset_media_derivatives_lookup_idx").on(table.assetId, table.variant, table.generationStatus),
  ],
);

export const assetMediaAccessLogs = pgTable(
  "asset_media_access_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    derivativeId: uuid("derivative_id").references(() => assetMediaDerivatives.id, { onDelete: "set null" }),
    variant: text("variant"),
    requesterUserId: text("requester_user_id"),
    requesterRole: text("requester_role"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    statusCode: integer("status_code").notNull(),
    outcome: text("outcome").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "asset_media_access_logs_outcome_check",
      sql`${table.outcome} in ('SERVED', 'NOT_FOUND', 'PREVIEW_NOT_READY', 'UNAUTHORIZED', 'FORBIDDEN', 'INVALID_TOKEN', 'R2_ERROR')`,
    ),
    index("asset_media_access_logs_asset_id_idx").on(table.assetId),
    index("asset_media_access_logs_derivative_id_idx").on(table.derivativeId),
    index("asset_media_access_logs_outcome_idx").on(table.outcome),
    index("asset_media_access_logs_created_at_idx").on(table.createdAt),
  ],
);
