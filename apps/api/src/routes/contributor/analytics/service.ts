import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import type { ContributorSessionResult } from "../auth/service";

interface SummaryRow {
  total_uploads: number | string;
  uploads_this_week: number | string;
  uploads_this_month: number | string;
  submissions_this_week: number | string;
  submissions_this_month: number | string;
  submitted_images: number | string;
  approved_images: number | string;
}

interface DownloadSummaryRow {
  downloads_today: number | string;
  downloads_this_month: number | string;
  downloads_all_time: number | string;
}

interface TopImageRow {
  image_asset_id: string;
  legacy_image_code: string | null;
  who_is_in_picture: string | null;
  headline: string | null;
  event_name: string | null;
  download_count: number | string;
  card_preview_available: boolean | null;
}

interface RecentUploadRow {
  image_asset_id: string;
  asset_type: string;
  legacy_image_code: string | null;
  who_is_in_picture: string | null;
  headline: string | null;
  event_name: string | null;
  category_name: string | null;
  status: string;
  visibility: string;
  created_at: Date | string;
}

export async function getPhotographerAnalyticsSummary(db: DrizzleClient, session: ContributorSessionResult) {
  const photographerId = session.contributor.id;

  const [summaryRows, downloadRows, topRows, recentRows] = await Promise.all([
    executeRows<SummaryRow>(
      db,
      sql`
        with editorial as (
          select
            ia.created_at,
            ia.status,
            ia.visibility
          from image_assets ia
          where ia.contributor_id = ${photographerId}::uuid
        ),
        caricatures as (
          select
            ca.created_at,
            ca.status,
            ca.visibility
          from caricature_assets ca
          where ca.created_by_contributor_id = ${photographerId}::uuid
            and ca.deleted_at is null
        ),
        combined as (
          select * from editorial
          union all
          select * from caricatures
        )
        select
          count(*)::int as total_uploads,
          count(*) filter (where created_at >= date_trunc('week', current_timestamp))::int as uploads_this_week,
          count(*) filter (where created_at >= date_trunc('month', current_timestamp))::int as uploads_this_month,
          count(*) filter (
            where (
              status in ('SUBMITTED', 'DRAFT', 'UNKNOWN', 'PENDING_REVIEW')
              or (visibility = 'PRIVATE' and status not in ('REJECTED', 'PUBLISHED'))
            )
              and created_at >= date_trunc('week', current_timestamp)
          )::int as submissions_this_week,
          count(*) filter (
            where (
              status in ('SUBMITTED', 'DRAFT', 'UNKNOWN', 'PENDING_REVIEW')
              or (visibility = 'PRIVATE' and status not in ('REJECTED', 'PUBLISHED'))
            )
              and created_at >= date_trunc('month', current_timestamp)
          )::int as submissions_this_month,
          count(*) filter (
            where status in ('SUBMITTED', 'DRAFT', 'UNKNOWN', 'PENDING_REVIEW')
              or (visibility = 'PRIVATE' and status not in ('REJECTED', 'PUBLISHED'))
          )::int as submitted_images,
          count(*) filter (
            where (status = 'ACTIVE' and visibility = 'PUBLIC')
              or status = 'PUBLISHED'
          )::int as approved_images
        from combined
      `,
    ),
    executeRows<DownloadSummaryRow>(
      db,
      sql`
        select
          count(*) filter (where l.created_at >= date_trunc('day', current_timestamp))::int as downloads_today,
          count(*) filter (where l.created_at >= date_trunc('month', current_timestamp))::int as downloads_this_month,
          count(*)::int as downloads_all_time
        from image_download_logs l
        inner join image_assets ia on ia.id = l.image_asset_id
        where ia.contributor_id = ${photographerId}::uuid
          and l.download_status = 'COMPLETED'
      `,
    ),
    executeRows<TopImageRow>(
      db,
      sql`
        select
          ia.id as image_asset_id,
          ia.legacy_image_code,
          ia.who_is_in_picture,
          ia.headline,
          pe.name as event_name,
          count(l.id)::int as download_count,
          exists (
            select 1
            from image_derivatives card
            where card.image_asset_id = ia.id
              and card.variant = 'CARD'
              and card.generation_status = 'READY'
          ) as card_preview_available
        from image_assets ia
        left join photo_events pe on pe.id = ia.event_id
        inner join image_download_logs l
          on l.image_asset_id = ia.id
          and l.download_status = 'COMPLETED'
        where ia.contributor_id = ${photographerId}::uuid
        group by ia.id, ia.legacy_image_code, ia.who_is_in_picture, ia.headline, pe.name, ia.created_at
        order by download_count desc, ia.created_at desc
        limit 5
      `,
    ),
    executeRows<RecentUploadRow>(
      db,
      sql`
        (
          select
            ia.id as image_asset_id,
            'IMAGE'::text as asset_type,
            ia.legacy_image_code,
            ia.who_is_in_picture,
            ia.headline,
            pe.name as event_name,
            null::text as category_name,
            ia.status,
            ia.visibility,
            ia.created_at
          from image_assets ia
          left join photo_events pe on pe.id = ia.event_id
          where ia.contributor_id = ${photographerId}::uuid
        )
        union all
        (
          select
            ca.id as image_asset_id,
            'CARICATURE'::text as asset_type,
            null::text as legacy_image_code,
            null::text as who_is_in_picture,
            ca.headline,
            null::text as event_name,
            cc.name as category_name,
            ca.status,
            ca.visibility,
            ca.created_at
          from caricature_assets ca
          join caricature_categories cc on cc.id = ca.category_id
          where ca.created_by_contributor_id = ${photographerId}::uuid
            and ca.deleted_at is null
        )
        order by created_at desc, image_asset_id desc
        limit 5
      `,
    ),
  ]);

  const summary = summaryRows[0];
  const downloads = downloadRows[0];

  return {
    ok: true as const,
    summary: {
      totalUploads: toInt(summary?.total_uploads),
      uploadsThisWeek: toInt(summary?.uploads_this_week),
      uploadsThisMonth: toInt(summary?.uploads_this_month),
      submissionsThisWeek: toInt(summary?.submissions_this_week),
      submissionsThisMonth: toInt(summary?.submissions_this_month),
      submittedImages: toInt(summary?.submitted_images),
      approvedImages: toInt(summary?.approved_images),
      downloadsToday: toInt(downloads?.downloads_today),
      downloadsThisMonth: toInt(downloads?.downloads_this_month),
      downloadsAllTime: toInt(downloads?.downloads_all_time),
    },
    topDownloadedImages: topRows.map((row) => ({
      imageAssetId: row.image_asset_id,
      legacyImageCode: row.legacy_image_code,
      whoIsInPicture: row.who_is_in_picture,
      headline: row.headline,
      eventName: row.event_name,
      downloadCount: toInt(row.download_count),
      cardPreviewAvailable: Boolean(row.card_preview_available),
    })),
    recentUploads: recentRows.map((row) => ({
      imageAssetId: row.image_asset_id,
      assetType: row.asset_type === "CARICATURE" ? ("CARICATURE" as const) : ("IMAGE" as const),
      legacyImageCode: row.legacy_image_code,
      whoIsInPicture: row.who_is_in_picture,
      headline: row.headline,
      eventName: row.event_name,
      categoryName: row.category_name,
      status: row.status,
      visibility: row.visibility,
      createdAt: toIso(row.created_at),
    })),
  };
}

function toInt(value: number | string | undefined) {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}
