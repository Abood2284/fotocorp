import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { imageAssets } from "./image-assets";

export const IMAGE_DERIVATIVE_VARIANTS = ["THUMB", "CARD", "DETAIL"] as const;
export const IMAGE_DERIVATIVE_STATUSES = ["READY", "STALE", "FAILED"] as const;
export const IMAGE_DERIVATIVE_SOURCES = ["LEGACY_MIGRATION", "GENERATED", "MANUAL"] as const;

export type ImageDerivativeVariant = (typeof IMAGE_DERIVATIVE_VARIANTS)[number];

export const imageDerivatives = pgTable(
  "image_derivatives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    imageAssetId: uuid("image_asset_id")
      .notNull()
      .references(() => imageAssets.id, { onDelete: "cascade" }),
    variant: text("variant").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    checksum: text("checksum"),
    isWatermarked: boolean("is_watermarked").default(true).notNull(),
    watermarkProfile: text("watermark_profile"),
    generationStatus: text("generation_status").default("READY").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    source: text("source").default("LEGACY_MIGRATION").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("image_derivatives_variant_check", sql`${table.variant} in ('THUMB', 'CARD', 'DETAIL')`),
    check("image_derivatives_generation_status_check", sql`${table.generationStatus} in ('READY', 'STALE', 'FAILED')`),
    check("image_derivatives_source_check", sql`${table.source} in ('LEGACY_MIGRATION', 'GENERATED', 'MANUAL')`),
    uniqueIndex("image_derivatives_image_asset_id_variant_uidx").on(table.imageAssetId, table.variant),
    index("image_derivatives_image_asset_id_idx").on(table.imageAssetId),
    index("image_derivatives_variant_idx").on(table.variant),
    index("image_derivatives_generation_status_idx").on(table.generationStatus),
    index("image_derivatives_lookup_idx").on(table.imageAssetId, table.variant, table.generationStatus),
    index("image_derivatives_storage_key_idx").on(table.storageKey),
  ],
);
