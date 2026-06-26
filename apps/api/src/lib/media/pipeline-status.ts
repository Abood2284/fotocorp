import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"

export interface VariantStatusCounts {
  ready: number
  failed: number
  missing: number
}

export interface VariantMigrationCounts {
  variant: string
  readyCurrentProfile: number
  readyStaleProfile: number
  failed: number
  missingOrNotReady: number
}

export interface PipelineFailedDerivativeRow {
  assetId: string
  legacyImageCode: string | null
  variant: string
  generationStatus: string
  watermarkProfile: string | null
  updatedAt: string | null
  storageKeyMasked: string | null
  hasErrorData: boolean
}

export interface PipelineRecentDerivativeRow {
  assetId: string
  fotokey: string | null
  legacyImageCode: string | null
  variant: string
  generationStatus: string
  watermarkProfile: string | null
  isWatermarked: boolean
  width: number | null
  height: number | null
  sizeBytes: number | null
  profileMatchesPolicy: boolean
  updatedAt: string | null
  generatedAt: string | null
}

/** Expected `image_derivatives.watermark_profile` per variant for READY/missing counts. */
export interface DerivativeProfilePolicyInput {
  thumbProfile: string
  cardProfile: string
  detailProfile: string
}

export interface MediaPipelineStatusOptions {
  /** Set to 0 to skip the failed-derivatives sample query. */
  failedSampleLimit?: number
  /** Recent derivative row updates (R2 upload / DB upsert activity). */
  recentActivityLimit?: number
}

export interface MediaPipelineStatus {
  watermarkProfile: string
  derivativeProfiles: DerivativeProfilePolicyInput
  generatedAt: string
  totalImageAssets: number
  assetsWithOriginalStorageKey: number
  assetsWithR2ExistsTrue: number
  assetsWithR2ExistsFalse: number
  assetsWithR2ExistsNull: number
  assetsMissingOriginalOrR2Mapping: number
  derivativeByVariant: Record<string, VariantStatusCounts>
  migrationByVariant: VariantMigrationCounts[]
  verifiedAssetsWithOriginal: number
  verifiedAssetsRemainingMigration: number
  assetsWithAllCurrentProfilesReady: number
  migrationPercentComplete: number
  assetsReadyForPublicListing: number
  assetsCurrentlyVisibleInPublicApi: number
  assetsEligibleForPublicListing: number
  assetsVisibleThroughCurrentPublicApiConditions: number
  latestFailedDerivatives: PipelineFailedDerivativeRow[]
  recentDerivativeUpdates: PipelineRecentDerivativeRow[]
}

interface SummaryRow {
  total_image_assets: number | string
  assets_with_original_storage_key: number | string
  assets_with_r2_exists_true: number | string
  assets_with_r2_exists_false: number | string
  assets_with_r2_exists_null: number | string
  assets_missing_original_or_r2_mapping: number | string
  assets_eligible_for_public_listing: number | string
  assets_visible_through_current_public_api_conditions: number | string
  verified_assets_with_original: number | string
  assets_with_all_current_profiles_ready: number | string
}

interface VariantRow {
  variant: string
  ready_count: number | string
  failed_count: number | string
  missing_count: number | string
  ready_stale_profile_count: number | string
}

interface FailedRow {
  asset_id: string
  legacy_imagecode: string | null
  variant: string
  generation_status: string
  watermark_profile: string | null
  updated_at: string | Date | null
  storage_key: string | null
}

interface RecentRow {
  asset_id: string
  fotokey: string | null
  legacy_image_code: string | null
  variant: string
  generation_status: string
  watermark_profile: string | null
  is_watermarked: boolean
  width: number | null
  height: number | null
  size_bytes: number | string | null
  profile_matches_policy: boolean
  updated_at: string | Date | null
  generated_at: string | Date | null
}

const LEGACY_VARIANTS = ["thumb", "card", "detail"] as const

function normalizeOptions(options: number | MediaPipelineStatusOptions): MediaPipelineStatusOptions {
  if (typeof options === "number") {
    return { failedSampleLimit: options, recentActivityLimit: 25 }
  }
  return {
    failedSampleLimit: options.failedSampleLimit ?? 20,
    recentActivityLimit: options.recentActivityLimit ?? 25,
  }
}

export async function getRecentDerivativeUpdates(
  db: DrizzleClient,
  limit = 20,
): Promise<PipelineRecentDerivativeRow[]> {
  if (limit <= 0) return []
  const recentRows = await executeRows<RecentRow>(
    db,
    buildPipelineRecentDerivativeUpdatesQuery(limit),
  )
  return mapRecentDerivativeRows(recentRows)
}

export async function getMediaPipelineStatus(
  db: DrizzleClient,
  policy: DerivativeProfilePolicyInput,
  options: number | MediaPipelineStatusOptions = {},
): Promise<MediaPipelineStatus> {
  const normalized = normalizeOptions(options)
  const failedLimit = normalized.failedSampleLimit ?? 0
  const recentLimit = normalized.recentActivityLimit ?? 25

  const [summaryRows, variantRows, failedRows, recentRows] = await Promise.all([
    executeRows<SummaryRow>(db, buildSummaryQuery(policy)),
    executeRows<VariantRow>(db, buildVariantCountsQuery(policy)),
    failedLimit > 0
      ? executeRows<FailedRow>(db, buildLatestFailedRowsQuery(failedLimit))
      : Promise.resolve([]),
    recentLimit > 0
      ? executeRows<RecentRow>(db, buildRecentDerivativeUpdatesQuery(policy, recentLimit))
      : Promise.resolve([]),
  ])

  const summary = summaryRows[0]
  const variantMap: Record<string, VariantStatusCounts> = {}
  const migrationByVariant: VariantMigrationCounts[] = []

  for (const variant of LEGACY_VARIANTS) {
    variantMap[variant] = { ready: 0, failed: 0, missing: 0 }
  }

  for (const row of variantRows) {
    const ready = toInt(row.ready_count)
    variantMap[row.variant] = {
      ready,
      failed: toInt(row.failed_count),
      missing: toInt(row.missing_count),
    }
    migrationByVariant.push({
      variant: row.variant,
      readyCurrentProfile: ready,
      readyStaleProfile: toInt(row.ready_stale_profile_count),
      failed: toInt(row.failed_count),
      missingOrNotReady: toInt(row.missing_count),
    })
  }

  migrationByVariant.sort((a, b) => a.variant.localeCompare(b.variant))

  const verifiedAssetsWithOriginal = toInt(summary?.verified_assets_with_original)
  const assetsWithAllCurrentProfilesReady = toInt(summary?.assets_with_all_current_profiles_ready)
  const migrationPercentComplete =
    verifiedAssetsWithOriginal > 0
      ? Math.round((assetsWithAllCurrentProfilesReady / verifiedAssetsWithOriginal) * 10000) / 100
      : 0

  return {
    watermarkProfile: policy.detailProfile,
    derivativeProfiles: policy,
    generatedAt: new Date().toISOString(),
    totalImageAssets: toInt(summary?.total_image_assets),
    assetsWithOriginalStorageKey: toInt(summary?.assets_with_original_storage_key),
    assetsWithR2ExistsTrue: toInt(summary?.assets_with_r2_exists_true),
    assetsWithR2ExistsFalse: toInt(summary?.assets_with_r2_exists_false),
    assetsWithR2ExistsNull: toInt(summary?.assets_with_r2_exists_null),
    assetsMissingOriginalOrR2Mapping: toInt(summary?.assets_missing_original_or_r2_mapping),
    derivativeByVariant: variantMap,
    migrationByVariant,
    verifiedAssetsWithOriginal,
    verifiedAssetsRemainingMigration: Math.max(verifiedAssetsWithOriginal - assetsWithAllCurrentProfilesReady, 0),
    assetsWithAllCurrentProfilesReady,
    migrationPercentComplete,
    assetsReadyForPublicListing: toInt(summary?.assets_eligible_for_public_listing),
    assetsCurrentlyVisibleInPublicApi: toInt(summary?.assets_visible_through_current_public_api_conditions),
    assetsEligibleForPublicListing: toInt(summary?.assets_eligible_for_public_listing),
    assetsVisibleThroughCurrentPublicApiConditions: toInt(
      summary?.assets_visible_through_current_public_api_conditions,
    ),
    latestFailedDerivatives: failedRows.map((row) => ({
      assetId: row.asset_id,
      legacyImageCode: row.legacy_imagecode,
      variant: row.variant,
      generationStatus: row.generation_status,
      watermarkProfile: row.watermark_profile,
      updatedAt: toIso(row.updated_at),
      storageKeyMasked: maskStorageKey(row.storage_key),
      hasErrorData: false,
    })),
    recentDerivativeUpdates: mapRecentDerivativeRows(recentRows),
  }
}

function mapRecentDerivativeRows(recentRows: RecentRow[]): PipelineRecentDerivativeRow[] {
  return recentRows.map((row) => ({
    assetId: row.asset_id,
    fotokey: row.fotokey,
    legacyImageCode: row.legacy_image_code,
    variant: row.variant,
    generationStatus: row.generation_status,
    watermarkProfile: row.watermark_profile,
    isWatermarked: row.is_watermarked,
    width: row.width,
    height: row.height,
    sizeBytes: toInt(row.size_bytes),
    profileMatchesPolicy: row.profile_matches_policy,
    updatedAt: toIso(row.updated_at),
    generatedAt: toIso(row.generated_at),
  }))
}

function buildSummaryQuery(policy: DerivativeProfilePolicyInput): SQL {
  return sql`
    with all_variants_ready as (
      select d.image_asset_id
      from image_derivatives d
      where (
        (d.variant = 'THUMB' and d.generation_status = 'READY' and d.is_watermarked = true and d.watermark_profile = ${policy.thumbProfile})
        or (d.variant = 'CARD' and d.generation_status = 'READY' and d.is_watermarked = true and d.watermark_profile = ${policy.cardProfile})
        or (d.variant = 'DETAIL' and d.generation_status = 'READY' and d.is_watermarked = true and d.watermark_profile = ${policy.detailProfile})
      )
      group by d.image_asset_id
      having count(distinct d.variant) = 3
    ),
    verified_base as (
      select id
      from image_assets
      where media_type = 'IMAGE'
        and original_exists_in_storage = true
        and original_storage_key is not null
        and btrim(original_storage_key) <> ''
    )
    select
      count(*) filter (where a.media_type = 'IMAGE')::bigint as total_image_assets,
      count(*) filter (where a.media_type = 'IMAGE' and a.original_storage_key is not null and btrim(a.original_storage_key) <> '')::bigint as assets_with_original_storage_key,
      count(*) filter (where a.media_type = 'IMAGE' and a.original_exists_in_storage = true)::bigint as assets_with_r2_exists_true,
      count(*) filter (where a.media_type = 'IMAGE' and a.original_exists_in_storage = false)::bigint as assets_with_r2_exists_false,
      count(*) filter (where a.media_type = 'IMAGE' and a.original_exists_in_storage is null)::bigint as assets_with_r2_exists_null,
      count(*) filter (
        where a.media_type = 'IMAGE'
          and (
            a.original_storage_key is null
            or btrim(a.original_storage_key) = ''
            or coalesce(a.original_exists_in_storage, false) = false
          )
      )::bigint as assets_missing_original_or_r2_mapping,
      (select count(*)::bigint from verified_base) as verified_assets_with_original,
      (select count(*)::bigint from verified_base vb where exists (
        select 1 from all_variants_ready avr where avr.image_asset_id = vb.id
      )) as assets_with_all_current_profiles_ready,
      count(*) filter (
        where a.media_type = 'IMAGE'
          and a.original_exists_in_storage = true
          and a.original_storage_key is not null
          and btrim(a.original_storage_key) <> ''
          and a.status = 'APPROVED'
          and a.visibility = 'PUBLIC'
          and exists (select 1 from all_variants_ready avr where avr.image_asset_id = a.id)
      )::bigint as assets_eligible_for_public_listing,
      (
        select count(*)::bigint
        from image_assets ia
        left join image_derivatives card
          on card.image_asset_id = ia.id
         and card.variant = 'CARD'
         and card.generation_status = 'READY'
         and card.is_watermarked = true
         and card.watermark_profile = ${policy.cardProfile}
        where ia.media_type = 'IMAGE'
          and ia.status = 'ACTIVE'
          and ia.visibility = 'PUBLIC'
          and ia.original_exists_in_storage = true
          and card.image_asset_id is not null
      ) as assets_visible_through_current_public_api_conditions
    from image_assets a
  `
}

function variantPolicyMatchSql(variantRef: SQL, policy: DerivativeProfilePolicyInput): SQL {
  return sql`
    (
      (${variantRef} = 'THUMB' and d.is_watermarked = true and d.watermark_profile = ${policy.thumbProfile})
      or (${variantRef} = 'CARD' and d.is_watermarked = true and d.watermark_profile = ${policy.cardProfile})
      or (${variantRef} = 'DETAIL' and d.is_watermarked = true and d.watermark_profile = ${policy.detailProfile})
    )
  `
}

function buildVariantCountsQuery(policy: DerivativeProfilePolicyInput): SQL {
  return sql`
    with image_assets_base as (
      select id
      from image_assets
      where media_type = 'IMAGE'
        and original_exists_in_storage = true
        and original_storage_key is not null
        and btrim(original_storage_key) <> ''
    ),
    variants as (
      select unnest(array['THUMB','CARD','DETAIL']::text[]) as variant
    )
    select
      lower(v.variant) as variant,
      count(*) filter (
        where d.generation_status = 'READY'
          and (
            (v.variant = 'THUMB' and d.is_watermarked = true and d.watermark_profile = ${policy.thumbProfile})
            or (v.variant = 'CARD' and d.is_watermarked = true and d.watermark_profile = ${policy.cardProfile})
            or (v.variant = 'DETAIL' and d.is_watermarked = true and d.watermark_profile = ${policy.detailProfile})
          )
      )::bigint as ready_count,
      count(*) filter (
        where d.generation_status = 'READY'
          and (
            (v.variant = 'THUMB' and (d.is_watermarked is distinct from true or d.watermark_profile is distinct from ${policy.thumbProfile}))
            or (v.variant = 'CARD' and (d.is_watermarked is distinct from true or d.watermark_profile is distinct from ${policy.cardProfile}))
            or (v.variant = 'DETAIL' and (d.is_watermarked is distinct from true or d.watermark_profile is distinct from ${policy.detailProfile}))
          )
      )::bigint as ready_stale_profile_count,
      count(*) filter (where d.generation_status = 'FAILED')::bigint as failed_count,
      count(*) filter (
        where d.image_asset_id is null
           or d.generation_status <> 'READY'
           or (
             (v.variant = 'THUMB' and (d.is_watermarked is distinct from true or d.watermark_profile is distinct from ${policy.thumbProfile}))
             or (v.variant = 'CARD' and (d.is_watermarked is distinct from true or d.watermark_profile is distinct from ${policy.cardProfile}))
             or (v.variant = 'DETAIL' and (d.is_watermarked is distinct from true or d.watermark_profile is distinct from ${policy.detailProfile}))
           )
      )::bigint as missing_count
    from image_assets_base a
    cross join variants v
    left join image_derivatives d
      on d.image_asset_id = a.id
     and d.variant = v.variant
    group by v.variant
    order by v.variant
  `
}

function buildLatestFailedRowsQuery(limit: number): SQL {
  return sql`
    select
      a.id as asset_id,
      a.legacy_image_code as legacy_imagecode,
      d.variant,
      d.generation_status,
      d.watermark_profile,
      d.updated_at,
      d.storage_key
    from image_derivatives d
    join image_assets a on a.id = d.image_asset_id
    where d.generation_status = 'FAILED'
    order by d.updated_at desc nulls last
    limit ${limit}
  `
}

function buildRecentDerivativeUpdatesQuery(policy: DerivativeProfilePolicyInput, limit: number): SQL {
  return sql`
    select
      a.id as asset_id,
      a.fotokey,
      a.legacy_image_code,
      lower(d.variant) as variant,
      d.generation_status,
      d.watermark_profile,
      d.is_watermarked,
      d.width,
      d.height,
      d.size_bytes,
      (${variantPolicyMatchSql(sql`d.variant`, policy)}) as profile_matches_policy,
      d.updated_at,
      d.generated_at
    from image_derivatives d
    join image_assets a on a.id = d.image_asset_id
    where a.media_type = 'IMAGE'
      and a.original_exists_in_storage = true
      and d.updated_at is not null
    order by d.updated_at desc
    limit ${limit}
  `
}

/** Lightweight recent-activity query for read-only pipeline observability (no migration aggregates). */
function buildPipelineRecentDerivativeUpdatesQuery(limit: number): SQL {
  return sql`
    with recent as (
      select
        d.image_asset_id,
        d.variant,
        d.generation_status,
        d.watermark_profile,
        d.is_watermarked,
        d.width,
        d.height,
        d.size_bytes,
        d.updated_at,
        d.generated_at
      from image_derivatives d
      where d.updated_at is not null
      order by d.updated_at desc
      limit ${limit}
    )
    select
      a.id as asset_id,
      a.fotokey,
      a.legacy_image_code,
      lower(r.variant) as variant,
      r.generation_status,
      r.watermark_profile,
      r.is_watermarked,
      r.width,
      r.height,
      r.size_bytes,
      false as profile_matches_policy,
      r.updated_at,
      r.generated_at
    from recent r
    join image_assets a on a.id = r.image_asset_id
    order by r.updated_at desc
  `
}

function toInt(value: number | string | undefined | null) {
  if (value === undefined || value === null) return 0
  if (typeof value === "number") return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function maskStorageKey(value: string | null) {
  if (!value) return null
  const parts = value.split("/")
  const last = parts.at(-1) ?? ""
  if (!last) return "***"
  if (last.length <= 8) return `***${last}`
  return `***${last.slice(-8)}`
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[]
  return []
}
