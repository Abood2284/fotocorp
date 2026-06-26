import { sql, type SQL } from "drizzle-orm"
import type { Env } from "../../appTypes"
import type { DrizzleClient } from "../../db"
import {
  getRecentDerivativeUpdates,
  type PipelineRecentDerivativeRow,
} from "../media/pipeline-status"
import { buildJobsDrainWebhookUrl } from "./publish-drain-webhook"

const RECENT_DERIVATIVE_LIMIT = 20

export interface JobsPipelineQueueCounts {
  queued: number
  running: number
  failedLast24h: number
}

export interface JobsPipelineWorkerHint {
  reachable: boolean
  drainInProgress: boolean | null
}

export type JobsPipelineActiveWorkKind =
  | "catalog_preview_regen"
  | "image_publish_item"
  | "caricature_preview"

export interface JobsPipelineActiveWorkItem {
  kind: JobsPipelineActiveWorkKind
  jobId: string
  itemId: string | null
  imageAssetId: string | null
  caricatureAssetId: string | null
  fotokey: string | null
  legacyImageCode: string | null
  importFileName: string | null
  status: string
  createdAt: string | null
  startedAt: string | null
  failureCode: string | null
  failureMessage: string | null
}

export interface JobsPipelineSnapshot {
  generatedAt: string
  worker: JobsPipelineWorkerHint
  queues: {
    catalogPreviewRegen: JobsPipelineQueueCounts
    imagePublishItems: JobsPipelineQueueCounts
    caricaturePreview: JobsPipelineQueueCounts
  }
  activeWork: JobsPipelineActiveWorkItem[]
  recentDerivativeUpdates: PipelineRecentDerivativeRow[]
}

interface CountRow {
  queued: number | string
  running: number | string
  failed_last_24h: number | string
}

interface ActiveWorkRow {
  kind: JobsPipelineActiveWorkKind
  job_id: string
  item_id: string | null
  image_asset_id: string | null
  caricature_asset_id: string | null
  fotokey: string | null
  legacy_image_code: string | null
  import_file_name: string | null
  status: string
  created_at: Date | string | null
  started_at: Date | string | null
  failure_code: string | null
  failure_message: string | null
}

const ACTIVE_WORK_LIMIT = 50

export async function getJobsPipelineSnapshot(
  db: DrizzleClient,
  env: Env,
): Promise<JobsPipelineSnapshot> {
  const [
    catalogCounts,
    publishItemCounts,
    caricatureCounts,
    activeWorkRows,
    recentDerivativeUpdates,
    worker,
  ] = await Promise.all([
    fetchQueueCounts(db, buildCatalogRegenCountsQuery()),
    fetchQueueCounts(db, buildImagePublishItemCountsQuery()),
    fetchQueueCounts(db, buildCaricaturePreviewCountsQuery()),
    executeRows<ActiveWorkRow>(db, buildActiveWorkQuery(ACTIVE_WORK_LIMIT)),
    getRecentDerivativeUpdates(db, RECENT_DERIVATIVE_LIMIT),
    probeJobsWorkerHealth(env),
  ])

  return {
    generatedAt: new Date().toISOString(),
    worker,
    queues: {
      catalogPreviewRegen: catalogCounts,
      imagePublishItems: publishItemCounts,
      caricaturePreview: caricatureCounts,
    },
    activeWork: activeWorkRows.map(mapActiveWorkRow),
    recentDerivativeUpdates: recentDerivativeUpdates,
  }
}

async function fetchQueueCounts(db: DrizzleClient, query: SQL): Promise<JobsPipelineQueueCounts> {
  const rows = await executeRows<CountRow>(db, query)
  const row = rows[0]
  return {
    queued: toNumber(row?.queued),
    running: toNumber(row?.running),
    failedLast24h: toNumber(row?.failed_last_24h),
  }
}

function buildCatalogRegenCountsQuery(): SQL {
  return sql`
    select
      count(*) filter (where status = 'QUEUED') as queued,
      count(*) filter (where status = 'RUNNING') as running,
      count(*) filter (
        where status = 'FAILED'
          and updated_at >= now() - interval '24 hours'
      ) as failed_last_24h
    from image_preview_regeneration_jobs
  `
}

function buildImagePublishItemCountsQuery(): SQL {
  return sql`
    select
      count(*) filter (where status = 'QUEUED') as queued,
      count(*) filter (where status = 'RUNNING') as running,
      count(*) filter (
        where status = 'FAILED'
          and updated_at >= now() - interval '24 hours'
      ) as failed_last_24h
    from image_publish_job_items
  `
}

function buildCaricaturePreviewCountsQuery(): SQL {
  return sql`
    select
      count(*) filter (where status = 'QUEUED') as queued,
      count(*) filter (where status = 'RUNNING') as running,
      count(*) filter (
        where status = 'FAILED'
          and updated_at >= now() - interval '24 hours'
      ) as failed_last_24h
    from caricature_preview_jobs
  `
}

function buildActiveWorkQuery(limit: number): SQL {
  return sql`
    select *
    from (
      select
        'catalog_preview_regen'::text as kind,
        j.id as job_id,
        null::uuid as item_id,
        j.image_asset_id,
        null::uuid as caricature_asset_id,
        a.fotokey,
        a.legacy_image_code,
        a.original_file_name as import_file_name,
        j.status,
        j.created_at,
        j.started_at,
        j.failure_code,
        j.failure_message
      from image_preview_regeneration_jobs j
      join image_assets a on a.id = j.image_asset_id
      where j.status in ('QUEUED', 'RUNNING')

      union all

      select
        'image_publish_item'::text as kind,
        i.job_id,
        i.id as item_id,
        i.image_asset_id,
        null::uuid as caricature_asset_id,
        i.fotokey,
        a.legacy_image_code,
        a.original_file_name as import_file_name,
        i.status,
        i.created_at,
        i.started_at,
        i.failure_code,
        i.failure_message
      from image_publish_job_items i
      left join image_assets a on a.id = i.image_asset_id
      where i.status in ('QUEUED', 'RUNNING')

      union all

      select
        'caricature_preview'::text as kind,
        j.id as job_id,
        null::uuid as item_id,
        null::uuid as image_asset_id,
        j.caricature_asset_id,
        c.slug as fotokey,
        null::text as legacy_image_code,
        c.original_filename as import_file_name,
        j.status,
        j.created_at,
        j.started_at,
        j.failure_code,
        j.failure_message
      from caricature_preview_jobs j
      join caricature_assets c on c.id = j.caricature_asset_id
      where j.status in ('QUEUED', 'RUNNING')
    ) active
    order by active.created_at desc
    limit ${limit}
  `
}

function mapActiveWorkRow(row: ActiveWorkRow): JobsPipelineActiveWorkItem {
  return {
    kind: row.kind,
    jobId: row.job_id,
    itemId: row.item_id,
    imageAssetId: row.image_asset_id,
    caricatureAssetId: row.caricature_asset_id,
    fotokey: row.fotokey,
    legacyImageCode: row.legacy_image_code,
    importFileName: row.import_file_name,
    status: row.status,
    createdAt: toIso(row.created_at),
    startedAt: toIso(row.started_at),
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
  }
}

async function probeJobsWorkerHealth(env: Env): Promise<JobsPipelineWorkerHint> {
  const healthUrl = resolveJobsHealthUrl(env.JOBS_DRAIN_WEBHOOK_URL)
  if (!healthUrl) {
    return { reachable: false, drainInProgress: null }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort("jobs_health_timeout"), 3_000)

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    if (!response.ok) {
      return { reachable: false, drainInProgress: null }
    }
    const body = (await response.json().catch(() => null)) as { drainInProgress?: unknown } | null
    return {
      reachable: true,
      drainInProgress: typeof body?.drainInProgress === "boolean" ? body.drainInProgress : null,
    }
  } catch {
    return { reachable: false, drainInProgress: null }
  } finally {
    clearTimeout(timeout)
  }
}

export function resolveJobsHealthUrl(drainWebhookUrl: string | undefined): string | null {
  const drainUrl = buildJobsDrainWebhookUrl(drainWebhookUrl)
  if (!drainUrl) return null
  try {
    const url = new URL(drainUrl)
    url.pathname = "/health"
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return null
  }
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  return result.rows as T[]
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}
