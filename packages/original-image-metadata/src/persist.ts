import type { OriginalImageMetadataRow } from "./types"
import { truncateMetadataScanError } from "./compute"

export interface MetadataQueryClient {
  query(text: string, values?: unknown[]): Promise<unknown>
}

export async function upsertImageAssetsMetadata(
  client: MetadataQueryClient,
  computed: OriginalImageMetadataRow,
): Promise<void> {
  await client.query(
    `
      insert into image_assets_metadata (
        image_asset_id,
        original_width,
        original_height,
        display_width,
        display_height,
        original_long_edge,
        original_short_edge,
        original_megapixels,
        original_dpi,
        original_resolution_unit,
        original_format,
        original_size_bytes,
        original_color_space,
        original_channels,
        original_bit_depth,
        original_has_alpha,
        original_orientation,
        original_has_profile,
        original_has_exif,
        original_has_iptc,
        original_has_xmp,
        source_quality_bucket,
        download_quality_ceiling,
        can_generate_medium,
        can_generate_low,
        technical_metadata_scanned_at,
        metadata_scan_status,
        metadata_scan_error,
        updated_at
      )
      values (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::numeric,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        $21,
        $22,
        $23,
        $24,
        $25,
        $26::timestamptz,
        'SUCCESS',
        null,
        now()
      )
      on conflict (image_asset_id) do update set
        original_width = excluded.original_width,
        original_height = excluded.original_height,
        display_width = excluded.display_width,
        display_height = excluded.display_height,
        original_long_edge = excluded.original_long_edge,
        original_short_edge = excluded.original_short_edge,
        original_megapixels = excluded.original_megapixels,
        original_dpi = excluded.original_dpi,
        original_resolution_unit = excluded.original_resolution_unit,
        original_format = excluded.original_format,
        original_size_bytes = excluded.original_size_bytes,
        original_color_space = excluded.original_color_space,
        original_channels = excluded.original_channels,
        original_bit_depth = excluded.original_bit_depth,
        original_has_alpha = excluded.original_has_alpha,
        original_orientation = excluded.original_orientation,
        original_has_profile = excluded.original_has_profile,
        original_has_exif = excluded.original_has_exif,
        original_has_iptc = excluded.original_has_iptc,
        original_has_xmp = excluded.original_has_xmp,
        source_quality_bucket = excluded.source_quality_bucket,
        download_quality_ceiling = excluded.download_quality_ceiling,
        can_generate_medium = excluded.can_generate_medium,
        can_generate_low = excluded.can_generate_low,
        technical_metadata_scanned_at = excluded.technical_metadata_scanned_at,
        metadata_scan_status = excluded.metadata_scan_status,
        metadata_scan_error = excluded.metadata_scan_error,
        updated_at = now()
    `,
    [
      computed.imageAssetId,
      computed.originalWidth,
      computed.originalHeight,
      computed.displayWidth,
      computed.displayHeight,
      computed.originalLongEdge,
      computed.originalShortEdge,
      computed.originalMegapixels,
      computed.originalDpi,
      computed.originalResolutionUnit,
      computed.originalFormat,
      computed.originalSizeBytes,
      computed.originalColorSpace,
      computed.originalChannels,
      computed.originalBitDepth,
      computed.originalHasAlpha,
      computed.originalOrientation,
      computed.originalHasProfile,
      computed.originalHasExif,
      computed.originalHasIptc,
      computed.originalHasXmp,
      computed.sourceQualityBucket,
      computed.downloadQualityCeiling,
      computed.canGenerateMedium,
      computed.canGenerateLow,
      computed.technicalMetadataScannedAt,
    ],
  )
}

export async function upsertImageAssetsMetadataFailed(
  client: MetadataQueryClient,
  input: { imageAssetId: string; error: string },
): Promise<void> {
  await client.query(
    `
      insert into image_assets_metadata (
        image_asset_id,
        technical_metadata_scanned_at,
        metadata_scan_status,
        metadata_scan_error,
        updated_at
      )
      values ($1::uuid, now(), 'FAILED', $2, now())
      on conflict (image_asset_id) do update set
        technical_metadata_scanned_at = excluded.technical_metadata_scanned_at,
        metadata_scan_status = excluded.metadata_scan_status,
        metadata_scan_error = excluded.metadata_scan_error,
        updated_at = now()
    `,
    [input.imageAssetId, truncateMetadataScanError(input.error)],
  )
}
