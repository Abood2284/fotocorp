import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { imageAssets } from "./image-assets";

export const METADATA_SCAN_STATUSES = ["PENDING", "SUCCESS", "FAILED", "SKIPPED"] as const;
export const SOURCE_QUALITY_BUCKETS = [
  "LOW_SOURCE",
  "STANDARD_SOURCE",
  "HIGH_SOURCE",
  "VERY_HIGH_SOURCE",
  "UNKNOWN",
] as const;
export const DOWNLOAD_QUALITY_CEILINGS = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"] as const;

export type MetadataScanStatus = (typeof METADATA_SCAN_STATUSES)[number];
export type SourceQualityBucket = (typeof SOURCE_QUALITY_BUCKETS)[number];
export type DownloadQualityCeiling = (typeof DOWNLOAD_QUALITY_CEILINGS)[number];

export const imageAssetsMetadata = pgTable(
  "image_assets_metadata",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    imageAssetId: uuid("image_asset_id")
      .notNull()
      .references(() => imageAssets.id, { onDelete: "cascade" }),
    originalWidth: integer("original_width"),
    originalHeight: integer("original_height"),
    displayWidth: integer("display_width"),
    displayHeight: integer("display_height"),
    originalLongEdge: integer("original_long_edge"),
    originalShortEdge: integer("original_short_edge"),
    originalMegapixels: numeric("original_megapixels", { precision: 10, scale: 4 }),
    originalDpi: integer("original_dpi"),
    originalResolutionUnit: text("original_resolution_unit"),
    originalFormat: text("original_format"),
    originalSizeBytes: bigint("original_size_bytes", { mode: "number" }),
    originalColorSpace: text("original_color_space"),
    originalChannels: integer("original_channels"),
    originalBitDepth: integer("original_bit_depth"),
    originalHasAlpha: boolean("original_has_alpha").default(false).notNull(),
    originalOrientation: integer("original_orientation"),
    originalHasProfile: boolean("original_has_profile").default(false).notNull(),
    originalHasExif: boolean("original_has_exif").default(false).notNull(),
    originalHasIptc: boolean("original_has_iptc").default(false).notNull(),
    originalHasXmp: boolean("original_has_xmp").default(false).notNull(),
    sourceQualityBucket: text("source_quality_bucket").default("UNKNOWN").notNull(),
    downloadQualityCeiling: text("download_quality_ceiling").default("UNKNOWN").notNull(),
    canGenerateMedium: boolean("can_generate_medium").default(false).notNull(),
    canGenerateLow: boolean("can_generate_low").default(false).notNull(),
    technicalMetadataScannedAt: timestamp("technical_metadata_scanned_at", { withTimezone: true }),
    metadataScanStatus: text("metadata_scan_status").default("PENDING").notNull(),
    metadataScanError: text("metadata_scan_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "image_assets_metadata_scan_status_check",
      sql`${table.metadataScanStatus} in ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED')`,
    ),
    check(
      "image_assets_metadata_source_quality_bucket_check",
      sql`${table.sourceQualityBucket} in ('LOW_SOURCE', 'STANDARD_SOURCE', 'HIGH_SOURCE', 'VERY_HIGH_SOURCE', 'UNKNOWN')`,
    ),
    check(
      "image_assets_metadata_download_quality_ceiling_check",
      sql`${table.downloadQualityCeiling} in ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN')`,
    ),
    uniqueIndex("image_assets_metadata_image_asset_id_uidx").on(table.imageAssetId),
    index("image_assets_metadata_metadata_scan_status_idx").on(table.metadataScanStatus),
    index("image_assets_metadata_source_quality_bucket_idx").on(table.sourceQualityBucket),
    index("image_assets_metadata_download_quality_ceiling_idx").on(table.downloadQualityCeiling),
  ],
);
