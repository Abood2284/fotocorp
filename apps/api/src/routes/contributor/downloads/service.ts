import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import type { ContributorSessionResult } from "../auth/service";

interface DownloadRow {
  image_asset_id: string;
  legacy_image_code: string | null;
  who_is_in_picture: string | null;
  headline: string | null;
  event_name: string | null;
  download_count: number | string;
  last_downloaded_at: Date | string | null;
}

export async function getPhotographerDownloads(
  db: DrizzleClient,
  session: ContributorSessionResult,
  query: {
    limit: number;
    offset: number;
    sort: "top" | "recent";
    from?: string;
    to?: string;
  },
) {
  const photographerId = session.contributor.id;

  const filters: SQL[] = [
    sql`ia.contributor_id = ${photographerId}::uuid`,
    sql`l.download_status = 'COMPLETED'`,
  ];

  if (query.from) {
    filters.push(
      sql`l.created_at >= ${`${query.from}T00:00:00Z`}::timestamptz`,
    );
  }
  if (query.to) {
    filters.push(
      sql`l.created_at < (${`${query.to}T00:00:00Z`}::timestamptz + interval '1 day')`,
    );
  }

  const filterSql =
    filters.length > 0 ? sql.join(filters, sql` and `) : sql`true`;

  const orderSql =
    query.sort === "recent"
      ? sql`order by last_downloaded_at desc nulls last, ia.created_at desc`
      : sql`order by download_count desc, ia.created_at desc`;

  const [rows, totalRows] = await Promise.all([
    executeRows<DownloadRow>(
      db,
      sql`
        select
          ia.id as image_asset_id,
          ia.legacy_image_code,
          ia.who_is_in_picture,
          ia.headline,
          pe.name as event_name,
          count(l.id)::int as download_count,
          max(l.created_at) as last_downloaded_at
        from image_assets ia
        left join photo_events pe on pe.id = ia.event_id
        inner join image_download_logs l on l.image_asset_id = ia.id
        where ${filterSql}
        group by ia.id, ia.legacy_image_code, ia.who_is_in_picture, ia.headline, pe.name, ia.created_at
        ${orderSql}
        limit ${query.limit}
        offset ${query.offset}
      `,
    ),
    executeRows<{ total: string }>(
      db,
      sql`
        select count(*)::text as total
        from (
          select ia.id
          from image_assets ia
          inner join image_download_logs l on l.image_asset_id = ia.id
          where ${filterSql}
          group by ia.id
        ) sub
      `,
    ),
  ]);

  const total = Number(totalRows[0]?.total ?? 0) || 0;

  return {
    ok: true as const,
    downloads: rows.map((row) => ({
      imageAssetId: row.image_asset_id,
      legacyImageCode: row.legacy_image_code,
      whoIsInPicture: row.who_is_in_picture,
      headline: row.headline,
      eventName: row.event_name,
      downloadCount: toInt(row.download_count),
      lastDownloadedAt: row.last_downloaded_at
        ? toIso(row.last_downloaded_at)
        : null,
    })),
    pagination: { limit: query.limit, offset: query.offset, total },
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

async function executeRows<T>(
  db: DrizzleClient,
  query: SQL,
): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray(result.rows)
  )
    return result.rows as T[];
  return [];
}
