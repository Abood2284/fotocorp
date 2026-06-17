import type { PoolClient, QueryResultRow } from "../db/client"
import { getJobsPool, withJobsTransaction } from "../db/client"

export interface CaricaturePreviewJobRow {
  id: string
  caricatureAssetId: string
  status: string
  publishOnSuccess: boolean
  requestedByStaffId: string | null
  failureCode: string | null
  failureMessage: string | null
  createdAt: Date
  startedAt: Date | null
  updatedAt: Date
}

export interface CaricatureAssetRow {
  id: string
  headline: string
  credit: string
  status: string
  visibility: string
  originalObjectKey: string | null
  publishedByStaffId: string | null
}

interface RawJobRow extends QueryResultRow {
  id: string
  caricature_asset_id: string
  status: string
  publish_on_success: boolean
  requested_by_staff_id: string | null
  failure_code: string | null
  failure_message: string | null
  created_at: Date | string
  started_at: Date | string | null
  updated_at: Date | string
}

interface RawAssetRow extends QueryResultRow {
  id: string
  headline: string
  credit: string
  status: string
  visibility: string
  original_object_key: string | null
  published_by_staff_id: string | null
}

export class CaricaturePreviewJobService {
  constructor(private readonly databaseUrl: string) {}

  async countPendingJobs(): Promise<number> {
    const pool = getJobsPool(this.databaseUrl)
    const result = await pool.query<{ count: string }>(
      `select count(*)::text as count from caricature_preview_jobs where status = 'QUEUED'`,
    )
    return Number.parseInt(result.rows[0]?.count ?? "0", 10)
  }

  async claimNextPendingJob(): Promise<CaricaturePreviewJobRow | null> {
    return withJobsTransaction(this.databaseUrl, async (client) => {
      const claimed = await client.query<RawJobRow>(
        `
          select
            id,
            caricature_asset_id,
            status,
            publish_on_success,
            requested_by_staff_id,
            failure_code,
            failure_message,
            created_at,
            started_at,
            updated_at
          from caricature_preview_jobs
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
          update caricature_preview_jobs
          set status = 'RUNNING', started_at = coalesce(started_at, now()), updated_at = now()
          where id = $1::uuid
        `,
        [row.id],
      )

      return mapJobRow(row)
    })
  }

  async loadAssetForJob(client: PoolClient, assetId: string): Promise<CaricatureAssetRow | null> {
    const result = await client.query<RawAssetRow>(
      `
        select
          id,
          headline,
          credit,
          status,
          visibility,
          original_object_key,
          published_by_staff_id::text as published_by_staff_id
        from caricature_assets
        where id = $1::uuid
          and deleted_at is null
        limit 1
      `,
      [assetId],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      id: row.id,
      headline: row.headline,
      credit: row.credit,
      status: row.status,
      visibility: row.visibility,
      originalObjectKey: row.original_object_key,
      publishedByStaffId: row.published_by_staff_id,
    }
  }

  async markJobCompleted(jobId: string): Promise<void> {
    const pool = getJobsPool(this.databaseUrl)
    await pool.query(
      `
        update caricature_preview_jobs
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
        update caricature_preview_jobs
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
    input: {
      assetId: string
      derivativeType: string
      bucket: string
      objectKey: string
      publicUrl: string | null
      width: number
      height: number
      byteSize: number
      blurVersion: string
      watermarkVersion: string
    },
  ): Promise<void> {
    await client.query(
      `
        insert into caricature_derivatives (
          caricature_id,
          derivative_type,
          bucket,
          object_key,
          public_url,
          format,
          width,
          height,
          file_size_bytes,
          blur_version,
          watermark_version,
          status,
          generated_at,
          updated_at
        )
        values (
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          'webp',
          $6,
          $7,
          $8,
          $9,
          $10,
          'READY',
          now(),
          now()
        )
        on conflict (caricature_id, derivative_type) do update set
          bucket = excluded.bucket,
          object_key = excluded.object_key,
          public_url = excluded.public_url,
          format = excluded.format,
          width = excluded.width,
          height = excluded.height,
          file_size_bytes = excluded.file_size_bytes,
          blur_version = excluded.blur_version,
          watermark_version = excluded.watermark_version,
          status = 'READY',
          error_message = null,
          generated_at = now(),
          updated_at = now()
      `,
      [
        input.assetId,
        input.derivativeType,
        input.bucket,
        input.objectKey,
        input.publicUrl,
        input.width,
        input.height,
        input.byteSize,
        input.blurVersion,
        input.watermarkVersion,
      ],
    )
  }

  async markDerivativeFailed(
    client: PoolClient,
    assetId: string,
    derivativeType: string,
    message: string,
  ): Promise<void> {
    await client.query(
      `
        update caricature_derivatives
        set status = 'FAILED', error_message = $3, updated_at = now()
        where caricature_id = $1::uuid and derivative_type = $2
      `,
      [assetId, derivativeType, message.slice(0, 2000)],
    )
  }

  async markDerivativeGenerating(client: PoolClient, assetId: string, derivativeType: string): Promise<void> {
    await client.query(
      `
        update caricature_derivatives
        set status = 'GENERATING', error_message = null, updated_at = now()
        where caricature_id = $1::uuid and derivative_type = $2
      `,
      [assetId, derivativeType],
    )
  }

  async publishCaricatureAsset(
    client: PoolClient,
    assetId: string,
    publishedByStaffId: string | null,
  ): Promise<void> {
    await client.query(
      `
        update caricature_assets
        set
          status = 'PUBLISHED',
          visibility = 'PUBLIC',
          published_by_staff_id = coalesce(published_by_staff_id, $2::uuid),
          published_record_at = coalesce(published_record_at, now()),
          updated_at = now()
        where id = $1::uuid
      `,
      [assetId, publishedByStaffId],
    )
  }

  withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return withJobsTransaction(this.databaseUrl, fn)
  }
}

function mapJobRow(row: RawJobRow): CaricaturePreviewJobRow {
  return {
    id: row.id,
    caricatureAssetId: row.caricature_asset_id,
    status: row.status,
    publishOnSuccess: row.publish_on_success,
    requestedByStaffId: row.requested_by_staff_id,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : null,
    updatedAt: new Date(row.updated_at),
  }
}
