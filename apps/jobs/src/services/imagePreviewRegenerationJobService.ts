import type { PoolClient, QueryResultRow } from "../db/client"
import { getJobsPool, withJobsTransaction } from "../db/client"
import type { CatalogPreviewVariant, GeneratedCatalogPreviewDerivative } from "../media/regenerateCatalogPreviewDerivatives"
import { expectedWatermarkProfile, variantIsWatermarked } from "../lib/watermarkProfile"
import { toLowerPreviewVariant, type PreviewVariant } from "@fotocorp/media-preview/profiles"

export interface ImagePreviewRegenerationJobRow {
  id: string
  imageAssetId: string
  status: string
  requestedByStaffId: string | null
  failureCode: string | null
  failureMessage: string | null
  createdAt: Date
  startedAt: Date | null
  updatedAt: Date
}

export interface ImageAssetRegenerationRow {
  id: string
  legacyImageCode: string | null
  originalStorageKey: string
  status: string
  visibility: string
}

interface RawJobRow extends QueryResultRow {
  id: string
  image_asset_id: string
  status: string
  requested_by_staff_id: string | null
  failure_code: string | null
  failure_message: string | null
  created_at: Date | string
  started_at: Date | string | null
  updated_at: Date | string
}

interface RawAssetRow extends QueryResultRow {
  id: string
  legacy_image_code: string | null
  original_storage_key: string
  status: string
  visibility: string
}

interface RawDerivativeRow extends QueryResultRow {
  variant: string
  generation_status: string | null
  is_watermarked: boolean | null
  watermark_profile: string | null
  width: number | null
  height: number | null
  mime_type: string | null
}

export class ImagePreviewRegenerationJobService {
  constructor(private readonly databaseUrl: string) {}

  async countPendingJobs(): Promise<number> {
    const pool = getJobsPool(this.databaseUrl)
    const result = await pool.query<{ count: string }>(
      `select count(*)::text as count from image_preview_regeneration_jobs where status = 'QUEUED'`,
    )
    return Number.parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async claimNextPendingJob(): Promise<ImagePreviewRegenerationJobRow | null> {
    return withJobsTransaction(this.databaseUrl, async (client) => {
      const claimed = await client.query<RawJobRow>(
        `
          select
            id,
            image_asset_id,
            status,
            requested_by_staff_id,
            failure_code,
            failure_message,
            created_at,
            started_at,
            updated_at
          from image_preview_regeneration_jobs
          where status = 'QUEUED'
          order by created_at asc
          for update skip locked
          limit 1
        `,
      )

      const row = claimed.rows[0]
      if (!row) return null

      await client.query(
        `
          update image_preview_regeneration_jobs
          set status = 'RUNNING', started_at = coalesce(started_at, now()), updated_at = now()
          where id = $1::uuid
        `,
        [row.id],
      )

      return mapJobRow(row)
    })
  }

  async loadAssetForJob(client: PoolClient, assetId: string): Promise<ImageAssetRegenerationRow | null> {
    const result = await client.query<RawAssetRow>(
      `
        select
          id,
          legacy_image_code,
          original_storage_key,
          status,
          visibility
        from image_assets
        where id = $1::uuid
          and media_type = 'IMAGE'
          and original_exists_in_storage = true
          and original_storage_key is not null
          and trim(original_storage_key) <> ''
        limit 1
      `,
      [assetId],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      id: row.id,
      legacyImageCode: row.legacy_image_code,
      originalStorageKey: row.original_storage_key,
      status: row.status,
      visibility: row.visibility,
    }
  }

  async loadDerivativesForAsset(client: PoolClient, assetId: string) {
    const result = await client.query<RawDerivativeRow>(
      `
        select variant, generation_status, is_watermarked, watermark_profile, width, height, mime_type
        from image_derivatives
        where image_asset_id = $1::uuid
          and variant in ('THUMB', 'CARD', 'DETAIL')
      `,
      [assetId],
    )
    return result.rows.map((row) => ({
      variant: row.variant as CatalogPreviewVariant,
      generationStatus: row.generation_status,
      isWatermarked: row.is_watermarked,
      watermarkProfile: row.watermark_profile,
      width: row.width,
      height: row.height,
      mimeType: row.mime_type,
    }))
  }

  async markJobCompleted(jobId: string): Promise<void> {
    const pool = getJobsPool(this.databaseUrl)
    await pool.query(
      `
        update image_preview_regeneration_jobs
        set status = 'COMPLETED', completed_at = now(), updated_at = now()
        where id = $1::uuid
      `,
      [jobId],
    )
  }

  async markJobFailed(jobId: string, input: { failureCode: string; failureMessage: string }): Promise<void> {
    const pool = getJobsPool(this.databaseUrl)
    await pool.query(
      `
        update image_preview_regeneration_jobs
        set
          status = 'FAILED',
          failure_code = $2,
          failure_message = $3,
          completed_at = now(),
          updated_at = now()
        where id = $1::uuid
      `,
      [jobId, input.failureCode, input.failureMessage.slice(0, 2000)],
    )
  }

  async upsertDerivativeReady(
    client: PoolClient,
    assetId: string,
    derivative: GeneratedCatalogPreviewDerivative,
  ): Promise<void> {
    const previewVariant = toLowerPreviewVariant(derivative.variant) as PreviewVariant
    const isWatermarked = variantIsWatermarked(previewVariant)
    const watermarkProfile = expectedWatermarkProfile(previewVariant)

    await client.query(
      `
        insert into image_derivatives (
          image_asset_id,
          variant,
          storage_key,
          mime_type,
          width,
          height,
          size_bytes,
          checksum,
          is_watermarked,
          watermark_profile,
          generation_status,
          generated_at,
          source,
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
          $8,
          $9,
          $10,
          'READY',
          now(),
          'GENERATED',
          now()
        )
        on conflict (image_asset_id, variant) do update set
          storage_key = excluded.storage_key,
          mime_type = excluded.mime_type,
          width = excluded.width,
          height = excluded.height,
          size_bytes = excluded.size_bytes,
          checksum = excluded.checksum,
          is_watermarked = excluded.is_watermarked,
          watermark_profile = excluded.watermark_profile,
          generation_status = 'READY',
          generated_at = now(),
          source = 'GENERATED',
          updated_at = now()
      `,
      [
        assetId,
        derivative.variant,
        derivative.storageKey,
        "image/webp",
        derivative.width,
        derivative.height,
        derivative.byteSize,
        derivative.checksum,
        isWatermarked,
        watermarkProfile,
      ],
    )
  }

  async markDerivativeFailed(
    client: PoolClient,
    assetId: string,
    variant: CatalogPreviewVariant,
    storageKey: string,
  ): Promise<void> {
    const previewVariant = toLowerPreviewVariant(variant) as PreviewVariant
    await client.query(
      `
        insert into image_derivatives (
          image_asset_id,
          variant,
          storage_key,
          mime_type,
          is_watermarked,
          watermark_profile,
          generation_status,
          source,
          updated_at
        )
        values ($1::uuid, $2, $3, $4, $5, $6, 'FAILED', 'GENERATED', now())
        on conflict (image_asset_id, variant) do update set
          generation_status = 'FAILED',
          updated_at = now()
      `,
      [
        assetId,
        variant,
        storageKey,
        "image/webp",
        variantIsWatermarked(previewVariant),
        expectedWatermarkProfile(previewVariant),
      ],
    )
  }

  withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return withJobsTransaction(this.databaseUrl, fn)
  }
}

function mapJobRow(row: RawJobRow): ImagePreviewRegenerationJobRow {
  return {
    id: row.id,
    imageAssetId: row.image_asset_id,
    status: row.status,
    requestedByStaffId: row.requested_by_staff_id,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : null,
    updatedAt: new Date(row.updated_at),
  }
}
