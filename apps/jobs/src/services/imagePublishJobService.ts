/**
 * DB-backed publish-job service for `apps/jobs`.
 *
 * Reads/writes `image_publish_jobs` and `image_publish_job_items` directly via
 * `pg` (matching the shape used by `apps/api/scripts/media/process-image-publish-jobs.ts`).
 *
 * Status vocabulary follows the schema enums:
 *   image_publish_jobs.status      ∈ QUEUED | RUNNING | COMPLETED | FAILED | PARTIAL_FAILED
 *   image_publish_job_items.status ∈ QUEUED | RUNNING | COMPLETED | FAILED
 *
 * The PR-16F brief refers to "PENDING/PROCESSING" generically; we keep the schema's
 * own `QUEUED`/`RUNNING` values to avoid introducing incompatible enum strings.
 *
 * Safety:
 *   - All claim/update work happens inside an explicit transaction with
 *     `FOR UPDATE SKIP LOCKED` so concurrent workers cannot claim the same job.
 *   - PR-16G: `completeSuccessfulPublishItem` updates `image_assets` + `image_derivatives`
 *     only after the worker has persisted all required preview objects to R2.
 */
import { PREVIEW_MIME_TYPE } from "../media/publishImageDerivatives"
import { CURRENT_WATERMARK_PROFILE } from "../lib/watermarkProfile"
import type { PoolClient, QueryResultRow } from "../db/client"
import { getJobsPool, withJobsTransaction } from "../db/client"

export interface PublishJobRow {
  id: string
  status: string
  jobType: string
  totalItems: number
  completedItems: number
  failedItems: number
  createdAt: Date
  startedAt: Date | null
  updatedAt: Date
}

export interface PublishJobItemRow {
  id: string
  jobId: string
  imageAssetId: string
  status: string
  fotokey: string
  canonicalOriginalKey: string
  sourceBucket: string
  sourceStorageKey: string
  failureCode: string | null
  failureMessage: string | null
  createdAt: Date
  startedAt: Date | null
}

export interface ClaimedPublishJob {
  job: PublishJobRow
  items: PublishJobItemRow[]
}

export interface AssetPublishGateRow {
  id: string
  mediaType: string
  status: string
  visibility: string
  source: string
  fotokey: string | null
  originalStorageKey: string | null
  hasContributorUploadItem: boolean
}

export interface PublishDerivativeRowInput {
  variant: string
  storageKey: string
  width: number
  height: number
  byteSize: number
  checksum: string
}

export interface CompletePublishItemInput {
  itemId: string
  imageAssetId: string
  derivatives: PublishDerivativeRowInput[]
}

export interface MarkFailureInput {
  failureCode: string
  failureMessage: string
}

interface RawJobRow extends QueryResultRow {
  id: string
  status: string
  job_type: string
  total_items: string | number
  completed_items: string | number
  failed_items: string | number
  created_at: Date | string
  started_at: Date | string | null
  updated_at: Date | string
}

interface RawJobItemRow extends QueryResultRow {
  id: string
  job_id: string
  image_asset_id: string
  status: string
  fotokey: string
  canonical_original_key: string
  source_bucket: string
  source_storage_key: string
  failure_code: string | null
  failure_message: string | null
  created_at: Date | string
  started_at: Date | string | null
}

interface RawGateRow extends QueryResultRow {
  id: string
  media_type: string
  status: string
  visibility: string
  source: string
  fotokey: string | null
  original_storage_key: string | null
  has_contributor_upload: boolean
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function toNullableDate(value: Date | string | null): Date | null {
  if (value === null) return null
  return toDate(value)
}

function toInt(value: string | number): number {
  if (typeof value === "number") return value
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function mapJobRow(row: RawJobRow): PublishJobRow {
  return {
    id: row.id,
    status: row.status,
    jobType: row.job_type,
    totalItems: toInt(row.total_items),
    completedItems: toInt(row.completed_items),
    failedItems: toInt(row.failed_items),
    createdAt: toDate(row.created_at),
    startedAt: toNullableDate(row.started_at),
    updatedAt: toDate(row.updated_at)
  }
}

function mapItemRow(row: RawJobItemRow): PublishJobItemRow {
  return {
    id: row.id,
    jobId: row.job_id,
    imageAssetId: row.image_asset_id,
    status: row.status,
    fotokey: row.fotokey,
    canonicalOriginalKey: row.canonical_original_key,
    sourceBucket: row.source_bucket,
    sourceStorageKey: row.source_storage_key,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    createdAt: toDate(row.created_at),
    startedAt: toNullableDate(row.started_at)
  }
}

function mapGateRow(row: RawGateRow): AssetPublishGateRow {
  return {
    id: row.id,
    mediaType: row.media_type,
    status: row.status,
    visibility: row.visibility,
    source: row.source,
    fotokey: row.fotokey,
    originalStorageKey: row.original_storage_key,
    hasContributorUploadItem: Boolean(row.has_contributor_upload)
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

export class ImagePublishJobService {
  constructor(private readonly databaseUrl: string) {}

  /**
   * Count `QUEUED` (pending) jobs without claiming or mutating anything.
   * Safe for dry-run and for the read-only worker mode where processing is disabled.
   */
  async countPendingJobs(): Promise<number> {
    const pool = getJobsPool(this.databaseUrl)
    const result = await pool.query<{ count: string }>(
      `select count(*)::text as count from image_publish_jobs where status = 'QUEUED'`
    )
    return toInt(result.rows[0]?.count ?? "0")
  }

  /**
   * List a page of `QUEUED` jobs without locking or mutating. Newest jobs land at the
   * end; we order by `created_at` so worker logs/inspection match FIFO claim order.
   */
  async listPendingJobs(limit = 25): Promise<PublishJobRow[]> {
    const safeLimit = Math.max(1, Math.min(limit, 200))
    const pool = getJobsPool(this.databaseUrl)
    const result = await pool.query<RawJobRow>(
      `
        select id, status, job_type, total_items, completed_items, failed_items,
               created_at, started_at, updated_at
        from image_publish_jobs
        where status = 'QUEUED'
        order by created_at asc, id asc
        limit $1
      `,
      [safeLimit]
    )
    return result.rows.map(mapJobRow)
  }

  /**
   * Atomically claim the oldest `QUEUED` job and flip it to `RUNNING`. Returns the
   * claimed job and its items, or `null` if no job is currently pending.
   *
   * Concurrency: uses `FOR UPDATE SKIP LOCKED` so multiple worker instances can run
   * side-by-side without colliding. Each worker still processes one job at a time.
   *
   * Item statuses are intentionally not changed here. The processing placeholder (or
   * the future real processor) decides whether to mark them RUNNING/FAILED/etc.
   */
  async claimNextPendingJob(): Promise<ClaimedPublishJob | null> {
    return withJobsTransaction(this.databaseUrl, async (client) => {
      const selected = await client.query<{ id: string }>(
        `
          select id
          from image_publish_jobs
          where status = 'QUEUED'
          order by created_at asc, id asc
          for update skip locked
          limit 1
        `
      )
      const row = selected.rows[0]
      if (!row) return null

      const updated = await client.query<RawJobRow>(
        `
          update image_publish_jobs
          set status = 'RUNNING',
              started_at = coalesce(started_at, now()),
              updated_at = now()
          where id = $1::uuid
          returning id, status, job_type, total_items, completed_items, failed_items,
                    created_at, started_at, updated_at
        `,
        [row.id]
      )
      const updatedJob = updated.rows[0]
      if (!updatedJob) return null

      const items = await loadJobItems(client, row.id)
      return {
        job: mapJobRow(updatedJob),
        items
      }
    })
  }

  /** Load all items for a given job (any status). Read-only. */
  async getJobItems(jobId: string): Promise<PublishJobItemRow[]> {
    const pool = getJobsPool(this.databaseUrl)
    const result = await pool.query<RawJobItemRow>(
      `
        select id, job_id, image_asset_id, status, fotokey, canonical_original_key,
               source_bucket, source_storage_key, failure_code, failure_message,
               created_at, started_at
        from image_publish_job_items
        where job_id = $1::uuid
        order by created_at asc, id asc
      `,
      [jobId]
    )
    return result.rows.map(mapItemRow)
  }

  /**
   * Mark a single item `FAILED` with a structured failure code + message. Idempotent:
   * already-FAILED rows keep their existing `completed_at`.
   */
  async markItemFailed(itemId: string, input: MarkFailureInput): Promise<void> {
    const pool = getJobsPool(this.databaseUrl)
    await pool.query(
      `
        update image_publish_job_items
        set status = 'FAILED',
            failure_code = $2,
            failure_message = $3,
            completed_at = coalesce(completed_at, now()),
            updated_at = now()
        where id = $1::uuid
      `,
      [itemId, input.failureCode, truncate(input.failureMessage, 500)]
    )
  }

  /**
   * Mark every still-open item in `jobId` as `FAILED` with the same failure code. Used
   * by the placeholder lifecycle so all queued items finish with a controlled reason
   * instead of being left in `QUEUED` indefinitely.
   */
  async markRemainingItemsFailedForJob(
    jobId: string,
    input: MarkFailureInput
  ): Promise<number> {
    const pool = getJobsPool(this.databaseUrl)
    const result = await pool.query(
      `
        update image_publish_job_items
        set status = 'FAILED',
            failure_code = $2,
            failure_message = $3,
            completed_at = coalesce(completed_at, now()),
            updated_at = now()
        where job_id = $1::uuid
          and status in ('QUEUED', 'RUNNING')
      `,
      [jobId, input.failureCode, truncate(input.failureMessage, 500)]
    )
    return result.rowCount ?? 0
  }

  async fetchAssetPublishGate(imageAssetId: string): Promise<AssetPublishGateRow | null> {
    const pool = getJobsPool(this.databaseUrl)
    const result = await pool.query<RawGateRow>(
      `
        select
          ia.id::text as id,
          ia.media_type,
          ia.status,
          ia.visibility,
          ia.source,
          ia.fotokey,
          ia.original_storage_key,
          exists(
            select 1 from contributor_upload_items cui where cui.image_asset_id = ia.id
          ) as has_contributor_upload
        from image_assets ia
        where ia.id = $1::uuid
        limit 1
      `,
      [imageAssetId]
    )
    const row = result.rows[0]
    if (!row) return null
    return mapGateRow(row)
  }

  async markItemRunning(itemId: string): Promise<boolean> {
    const pool = getJobsPool(this.databaseUrl)
    const result = await pool.query<{ id: string }>(
      `
        update image_publish_job_items
        set status = 'RUNNING',
            started_at = coalesce(started_at, now()),
            updated_at = now()
        where id = $1::uuid
          and status = 'QUEUED'
        returning id
      `,
      [itemId]
    )
    return Boolean(result.rows[0]?.id)
  }

  async completeSuccessfulPublishItem(input: CompletePublishItemInput): Promise<void> {
    await withJobsTransaction(this.databaseUrl, async (client) => {
      for (const derivative of input.derivatives) {
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
              created_at,
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
              true,
              $9,
              $10,
              now(),
              'GENERATED',
              now(),
              now()
            )
            on conflict (image_asset_id, variant) do update
            set
              storage_key = excluded.storage_key,
              mime_type = excluded.mime_type,
              width = excluded.width,
              height = excluded.height,
              size_bytes = excluded.size_bytes,
              checksum = excluded.checksum,
              is_watermarked = true,
              watermark_profile = excluded.watermark_profile,
              generation_status = excluded.generation_status,
              generated_at = excluded.generated_at,
              source = excluded.source,
              updated_at = now()
          `,
          [
            input.imageAssetId,
            derivative.variant,
            derivative.storageKey,
            PREVIEW_MIME_TYPE,
            derivative.width,
            derivative.height,
            derivative.byteSize,
            derivative.checksum,
            CURRENT_WATERMARK_PROFILE,
            "READY"
          ]
        )
      }

      const assetUpdate = await client.query(
        `
          update image_assets
          set status = 'ACTIVE',
              visibility = 'PUBLIC',
              original_exists_in_storage = true,
              original_storage_checked_at = now(),
              updated_at = now()
          where id = $1::uuid
            and status = 'APPROVED'
            and visibility = 'PRIVATE'
            and fotokey is not null
          returning id
        `,
        [input.imageAssetId]
      )
      if ((assetUpdate.rowCount ?? 0) !== 1) {
        throw new Error("image_assets was not in APPROVED+PRIVATE state; aborted publish completion.")
      }

      const itemUpdate = await client.query(
        `
          update image_publish_job_items
          set status = 'COMPLETED',
              failure_code = null,
              failure_message = null,
              completed_at = now(),
              updated_at = now()
          where id = $1::uuid
            and status = 'RUNNING'
          returning id
        `,
        [input.itemId]
      )
      if ((itemUpdate.rowCount ?? 0) !== 1) {
        throw new Error("image_publish_job_items was not RUNNING; aborted publish completion.")
      }
    })
  }

  async reconcilePublishJobAggregate(jobId: string): Promise<void> {
    const pool = getJobsPool(this.databaseUrl)
    const result = await pool.query<{
      total: string
      completed: string
      failed: string
      queued: string
      running: string
    }>(
      `
        select
          count(*)::text as total,
          count(*) filter (where status = 'COMPLETED')::text as completed,
          count(*) filter (where status = 'FAILED')::text as failed,
          count(*) filter (where status = 'QUEUED')::text as queued,
          count(*) filter (where status = 'RUNNING')::text as running
        from image_publish_job_items
        where job_id = $1::uuid
      `,
      [jobId]
    )
    const row = result.rows[0]
    if (!row) return
    const total = Number(row.total) || 0
    const completed = Number(row.completed) || 0
    const failed = Number(row.failed) || 0
    const queued = Number(row.queued) || 0
    const running = Number(row.running) || 0

    let status: string
    if (queued > 0 || running > 0) status = "RUNNING"
    else if (failed === 0) status = "COMPLETED"
    else if (completed === 0) status = "FAILED"
    else status = "PARTIAL_FAILED"

    await pool.query(
      `
        update image_publish_jobs
        set status = $2,
            total_items = $3,
            completed_items = $4,
            failed_items = $5,
            completed_at = case when $2 in ('COMPLETED', 'FAILED', 'PARTIAL_FAILED') then coalesce(completed_at, now()) else completed_at end,
            updated_at = now()
        where id = $1::uuid
      `,
      [jobId, status, total, completed, failed]
    )
  }

  /**
   * Mark a job `FAILED` and reconcile its `total_items` / `failed_items` counts from
   * `image_publish_job_items`. Does not touch `image_assets`.
   *
   * `input.failureCode` / `input.failureMessage` are accepted for symmetry with
   * `markItemFailed` and for future use; the current `image_publish_jobs` schema has
   * no `failure_code` / `failure_message` columns, so the structured failure context
   * lives on the per-item rows.
   */
  async markJobFailed(jobId: string, input: MarkFailureInput): Promise<void> {
    await withJobsTransaction(this.databaseUrl, async (client) => {
      const aggregate = await client.query<{ total: string; failed: string }>(
        `
          select
            count(*)::text as total,
            count(*) filter (where status = 'FAILED')::text as failed
          from image_publish_job_items
          where job_id = $1::uuid
        `,
        [jobId]
      )
      const total = toInt(aggregate.rows[0]?.total ?? "0")
      const failed = toInt(aggregate.rows[0]?.failed ?? "0")

      await client.query(
        `
          update image_publish_jobs
          set status = 'FAILED',
              total_items = $2,
              failed_items = $3,
              completed_at = coalesce(completed_at, now()),
              updated_at = now()
          where id = $1::uuid
        `,
        [jobId, total, failed]
      )
    })
    console.log(
      `[fotocorp-jobs] job marked FAILED id=${jobId} failureCode=${input.failureCode} reason=${truncate(input.failureMessage, 120)}`
    )
  }
}

async function loadJobItems(client: PoolClient, jobId: string): Promise<PublishJobItemRow[]> {
  const result = await client.query<RawJobItemRow>(
    `
      select id, job_id, image_asset_id, status, fotokey, canonical_original_key,
             source_bucket, source_storage_key, failure_code, failure_message,
             created_at, started_at
      from image_publish_job_items
      where job_id = $1::uuid
      order by created_at asc, id asc
    `,
    [jobId]
  )
  return result.rows.map(mapItemRow)
}
