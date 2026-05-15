import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"

export interface VariantStatusCounts {
  ready: number
  failed: number
  missing: number
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

/** Expected `image_derivatives.watermark_profile` per variant for READY/missing counts. */
export interface DerivativeProfilePolicyInput {
  thumbProfile: string
  cardProfile: string
  detailProfile: string
}

export interface MediaPipelineStatus {
  /** Expected profile for the watermarked detail variant (same as `derivativeProfiles.detailProfile`). */
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
  assetsReadyForPublicListing: number
  assetsCurrentlyVisibleInPublicApi: number
  assetsEligibleForPublicListing: number
  assetsVisibleThroughCurrentPublicApiConditions: number
  latestFailedDerivatives: PipelineFailedDerivativeRow[]
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
}

interface VariantRow {
  variant: string
  ready_count: number | string
  failed_count: number | string
  missing_count: number | string
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

const LEGACY_VARIANTS = ["thumb", "card", "detail"] as const

export async function getMediaPipelineStatus(
  db: DrizzleClient,
  policy: DerivativeProfilePolicyInput,
  failedSampleLimit = 20,
): Promise<MediaPipelineStatus> {
  const [summaryRows, variantRows, failedRows] = await Promise.all([
    executeRows<SummaryRow>(db, buildSummaryQuery(policy)),
    executeRows<VariantRow>(db, buildVariantCountsQuery(policy)),
    executeRows<FailedRow>(db, buildLatestFailedRowsQuery(failedSampleLimit)),
  ])

  const summary = summaryRows[0]
  const variantMap: Record<string, VariantStatusCounts> = {}
  for (const variant of LEGACY_VARIANTS) {
    variantMap[variant] = { ready: 0, failed: 0, missing: 0 }
  }

  for (const row of variantRows) {
    variantMap[row.variant] = {
      ready: toInt(row.ready_count),
      failed: toInt(row.failed_count),
      missing: toInt(row.missing_count),
    }
  }

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
    assetsReadyForPublicListing: toInt(summary?.assets_eligible_for_public_listing),
    assetsCurrentlyVisibleInPublicApi: toInt(summary?.assets_visible_through_current_public_api_conditions),
    assetsEligibleForPublicListing: toInt(summary?.assets_eligible_for_public_listing),
    assetsVisibleThroughCurrentPublicApiConditions: toInt(summary?.assets_visible_through_current_public_api_conditions),
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
  }
}

function buildSummaryQuery(policy: DerivativeProfilePolicyInput): SQL {
  return sql`
    with all_variants_ready as (
      select d.image_asset_id
      from image_derivatives d
      where (
        (d.variant = 'THUMB' and d.generation_status = 'READY' and d.is_watermarked = false and d.watermark_profile = ${policy.thumbProfile})
        or (d.variant = 'CARD' and d.generation_status = 'READY' and d.is_watermarked = false and d.watermark_profile = ${policy.cardProfile})
        or (d.variant = 'DETAIL' and d.generation_status = 'READY' and d.is_watermarked = true and d.watermark_profile = ${policy.detailProfile})
      )
      group by d.image_asset_id
      having count(distinct d.variant) = 3
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
         and card.is_watermarked = false
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
            (v.variant = 'THUMB' and d.is_watermarked = false and d.watermark_profile = ${policy.thumbProfile})
            or (v.variant = 'CARD' and d.is_watermarked = false and d.watermark_profile = ${policy.cardProfile})
            or (v.variant = 'DETAIL' and d.is_watermarked = true and d.watermark_profile = ${policy.detailProfile})
          )
      )::bigint as ready_count,
      count(*) filter (where d.generation_status = 'FAILED')::bigint as failed_count,
      count(*) filter (
        where d.image_asset_id is null
           or d.generation_status <> 'READY'
           or (
             (v.variant = 'THUMB' and (d.is_watermarked is distinct from false or d.watermark_profile is distinct from ${policy.thumbProfile}))
             or (v.variant = 'CARD' and (d.is_watermarked is distinct from false or d.watermark_profile is distinct from ${policy.cardProfile}))
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

function toInt(value: number | string | undefined) {
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
