import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../db";
import { ASSET_AUDIT_ACTION } from "../audit/actions";
import { AppError } from "../errors";
import { createPreviewUrl } from "../media/preview-token";
import { getR2Object } from "../r2";

type AdminSort =
  | "newest"
  | "oldest"
  | "imageDateDesc"
  | "imageDateAsc"
  | "recentlyUpdated"
  | "missingR2"
  | "missingPreview";
type DerivativeFilter = "READY" | "FAILED" | "PROCESSING" | "MISSING";
type DerivativeState = "READY" | "FAILED" | "PROCESSING" | "MISSING";
type PreviewStateFilter = "all" | "ready" | "partial" | "missing";
type Visibility = "PRIVATE" | "PUBLIC" | "UNLISTED";
type CleanAssetStatus = "DRAFT" | "ACTIVE" | "ARCHIVED" | "DELETED" | "MISSING_ORIGINAL" | "UNKNOWN";
type CleanDerivativeVariant = "THUMB" | "CARD" | "DETAIL";

interface CursorPayload {
  sort: AdminSort;
  createdAt: string;
  updatedAt?: string;
  id: string;
  imageSortAt?: string;
  groupRank?: number;
}

interface AdminAssetQuery {
  q?: string;
  status?: string;
  visibility?: Visibility;
  categoryId?: string;
  eventId?: string;
  contributorId?: string;
  r2Exists?: boolean;
  derivativeStatus?: DerivativeFilter;
  previewState: PreviewStateFilter;
  hasPreview?: boolean;
  cursor?: string;
  limit: number;
  sort: AdminSort;
}

interface AdminAssetRow {
  id: string;
  legacy_imagecode: string | null;
  title: string | null;
  caption: string | null;
  headline: string | null;
  description: string | null;
  keywords: string | null;
  status: string;
  visibility: string;
  r2_exists: boolean;
  r2_checked_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  image_date: Date | string | null;
  category_id: string | null;
  category_name: string | null;
  event_id: string | null;
  event_name: string | null;
  event_date: Date | string | null;
  contributor_id: string | null;
  contributor_name: string | null;
  thumb_status: string | null;
  thumb_width: number | null;
  thumb_height: number | null;
  thumb_watermarked: boolean | null;
  thumb_mime_type: string | null;
  thumb_updated_at: Date | string | null;
  card_status: string | null;
  card_width: number | null;
  card_height: number | null;
  card_watermarked: boolean | null;
  card_mime_type: string | null;
  card_updated_at: Date | string | null;
  detail_status: string | null;
  detail_width: number | null;
  detail_height: number | null;
  detail_watermarked: boolean | null;
  detail_mime_type: string | null;
  detail_updated_at: Date | string | null;
  image_sort_at: Date | string;
  sort_group_rank: number;
}

interface AdminStatsRow {
  total_assets: number | string;
  approved_public_assets: number | string;
  private_assets: number | string;
  missing_r2_count: number | string;
  ready_card_preview_count: number | string;
  missing_card_preview_count: number | string;
  failed_derivative_count: number | string;
  imported_today: number | string;
  imported_month: number | string;
}

interface ScalarRow {
  total_categories?: number | string;
  total_events?: number | string;
  total_contributors?: number | string;
}

interface FilterRow {
  id: string;
  name: string | null;
  asset_count: number | string;
  event_date?: Date | string | null;
}

interface AssetDetailResponse {
  asset: Awaited<ReturnType<typeof mapAdminAssetRow>>;
}

interface UpdateEditorialInput {
  caption: string | null;
  headline: string | null;
  description: string | null;
  keywords: string[] | null;
  categoryId: string | null;
  eventId: string | null;
  contributorId: string | null;
}

interface UpdatePublishInput {
  status: "APPROVED" | "REVIEW" | "REJECTED";
  visibility: "PUBLIC" | "PRIVATE";
}

interface AdminActor {
  authUserId: string | null;
  email: string | null;
}

interface InternalAdminOriginalAssetRow {
  id: string;
  media_type: string;
  r2_exists: boolean;
  r2_original_key: string | null;
}

export async function listInternalAdminAssets(
  db: DrizzleClient,
  request: Request,
  secret: string | undefined,
  ttlSeconds: number,
) {
  const query = parseAdminAssetQuery(new URL(request.url).searchParams);
  const rows = await executeRows<AdminAssetRow>(db, buildAdminAssetsSql(query));
  const pageRows = rows.slice(0, query.limit);
  const items = await Promise.all(pageRows.map((row) => mapAdminAssetRow(row, secret, ttlSeconds)));
  const last = pageRows.at(-1);
  const nextCursor = rows.length > query.limit && last ? encodeCursor(toCursor(last, query.sort)) : null;

  return { items, nextCursor };
}

export async function getInternalAdminAssetPreview(
  db: DrizzleClient,
  bucket: R2Bucket,
  assetId: string,
  variant: "thumb" | "card" | "detail",
) {
  if (!isUuid(assetId)) {
    throw new AppError(400, "INVALID_ASSET_ID", "Asset id is invalid.");
  }

  const rows = await executeRows<{
    id: string;
    media_type: string;
    generation_status: string | null;
    is_watermarked: boolean | null;
    mime_type: string | null;
    width: number | null;
    height: number | null;
    r2_key: string | null;
  }>(db, sql`
    select
      a.id,
      a.media_type,
      d.generation_status,
      d.is_watermarked,
      d.mime_type,
      d.width,
      d.height,
      d.storage_key as r2_key
    from image_assets a
    left join image_derivatives d
      on d.image_asset_id = a.id
      and d.variant = ${toCleanDerivativeVariant(variant)}
    where a.id = ${assetId}::uuid
    limit 1
  `);
  const row = rows[0];
  if (!row) {
    throw new AppError(404, "ASSET_NOT_FOUND", "Asset was not found.");
  }
  if (row.media_type !== "IMAGE") {
    throw new AppError(409, "PREVIEW_NOT_AVAILABLE", "Preview is not available.");
  }
  if (
    !row.r2_key ||
    row.generation_status !== "READY" ||
    row.is_watermarked !== true ||
    !row.mime_type ||
    row.width === null ||
    row.height === null
  ) {
    throw new AppError(409, "PREVIEW_NOT_AVAILABLE", "Preview is not available.");
  }

  let object: Awaited<ReturnType<typeof getR2Object>> | null = null;
  try {
    object = await getR2Object(bucket, row.r2_key);
  } catch {
    throw new AppError(502, "R2_ERROR", "Preview service is unavailable.");
  }
  if (!object?.body) {
    throw new AppError(409, "PREVIEW_NOT_AVAILABLE", "Preview is not available.");
  }

  return { object, mimeType: row.mime_type };
}

export async function getInternalAdminAssetById(
  db: DrizzleClient,
  assetId: string,
  secret: string | undefined,
  ttlSeconds: number,
): Promise<AssetDetailResponse> {
  if (!isUuid(assetId)) {
    throw new AppError(400, "INVALID_ASSET_ID", "Asset id is invalid.");
  }

  const rows = await executeRows<AdminAssetRow>(db, sql`
    ${adminSelectSql("newest")}
    ${adminFromSql()}
    where a.id = ${assetId}
    limit 1
  `);

  const row = rows[0];
  if (!row) {
    throw new AppError(404, "ASSET_NOT_FOUND", "Asset was not found.");
  }

  return { asset: await mapAdminAssetRow(row, secret, ttlSeconds) };
}

export async function updateInternalAdminAssetEditorial(
  db: DrizzleClient,
  assetId: string,
  payload: UpdateEditorialInput,
  actor: AdminActor,
  secret: string | undefined,
  ttlSeconds: number,
) {
  if (!isUuid(assetId)) {
    throw new AppError(400, "INVALID_ASSET_ID", "Asset id is invalid.");
  }

  const before = await getAuditSnapshot(db, assetId);
  if (!before) throw new AppError(404, "ASSET_NOT_FOUND", "Asset was not found.");
  await assertForeignKeysExist(db, payload);
  const normalizedKeywords = payload.keywords ? payload.keywords.join(", ") : null;

  await db.execute(sql`
    update image_assets
    set
      caption = ${payload.caption},
      headline = ${payload.headline},
      description = ${payload.description},
      keywords = ${normalizedKeywords},
      category_id = ${payload.categoryId},
      event_id = ${payload.eventId},
      contributor_id = ${payload.contributorId},
      updated_at = now()
    where id = ${assetId}::uuid
  `);

  const after = await getAuditSnapshot(db, assetId);
  if (after) {
    const beforeDelta = diffSnapshot(before, after);
    const afterDelta = diffSnapshot(after, before);
    if (Object.keys(afterDelta).length > 0) {
      await insertAuditLog(db, {
        assetId,
        action: ASSET_AUDIT_ACTION.metadataUpdated,
        actor,
        before: beforeDelta,
        after: afterDelta,
      });
    }
  }

  return getInternalAdminAssetById(db, assetId, secret, ttlSeconds);
}

export async function updateInternalAdminAssetPublish(
  db: DrizzleClient,
  assetId: string,
  payload: UpdatePublishInput,
  actor: AdminActor,
  secret: string | undefined,
  ttlSeconds: number,
) {
  if (!isUuid(assetId)) {
    throw new AppError(400, "INVALID_ASSET_ID", "Asset id is invalid.");
  }

  const before = await getAuditSnapshot(db, assetId);
  if (!before) throw new AppError(404, "ASSET_NOT_FOUND", "Asset was not found.");

  await db.execute(sql`
    update image_assets
    set
      status = ${toCleanAssetStatus(payload.status)},
      visibility = ${payload.visibility},
      updated_at = now()
    where id = ${assetId}::uuid
  `);

  const after = await getAuditSnapshot(db, assetId);
  if (after) {
    const beforeDelta = diffSnapshot(before, after);
    const afterDelta = diffSnapshot(after, before);
    if (Object.keys(afterDelta).length > 0) {
      await insertAuditLog(db, {
        assetId,
        action: ASSET_AUDIT_ACTION.publishStateUpdated,
        actor,
        before: beforeDelta,
        after: afterDelta,
      });
    }
  }

  return getInternalAdminAssetById(db, assetId, secret, ttlSeconds);
}

export async function getInternalAdminPublishEligibility(db: DrizzleClient, assetId: string) {
  if (!isUuid(assetId)) {
    throw new AppError(400, "INVALID_ASSET_ID", "Asset id is invalid.");
  }
  return getPublishEligibility(db, assetId);
}

export async function getInternalAdminAssetOriginal(
  db: DrizzleClient,
  bucket: R2Bucket,
  assetId: string,
  actor: AdminActor,
) {
  if (!isUuid(assetId)) {
    throw new AppError(400, "INVALID_ASSET_ID", "Asset id is invalid.");
  }

  const rows = await executeRows<InternalAdminOriginalAssetRow>(db, sql`
    select
      id,
      media_type,
      original_exists_in_storage as r2_exists,
      original_storage_key as r2_original_key
    from image_assets
    where id = ${assetId}::uuid
    limit 1
  `);
  const asset = rows[0];
  if (!asset) {
    throw new AppError(404, "ASSET_NOT_FOUND", "Asset was not found.");
  }

  if (asset.media_type !== "IMAGE" || !asset.r2_exists || !asset.r2_original_key) {
    throw new AppError(409, "ORIGINAL_NOT_AVAILABLE", "Original image is not available.");
  }

  let object: Awaited<ReturnType<typeof getR2Object>> | null = null;
  try {
    object = await getR2Object(bucket, asset.r2_original_key);
  } catch {
    throw new AppError(502, "R2_ERROR", "Original image service is unavailable.");
  }

  if (!object?.body) {
    throw new AppError(409, "ORIGINAL_NOT_AVAILABLE", "Original image is not available.");
  }

  await insertAuditLog(db, {
    assetId,
    action: ASSET_AUDIT_ACTION.originalViewed,
    actor,
    before: {},
    after: {},
  });

  return object;
}

export async function getInternalAdminCatalogStats(db: DrizzleClient) {
  const statsRows = await executeRows<AdminStatsRow>(db, sql`
    select
      count(*)::bigint as total_assets,
      count(*) filter (where a.status = 'ACTIVE' and a.visibility = 'PUBLIC')::bigint as approved_public_assets,
      count(*) filter (where a.visibility = 'PRIVATE')::bigint as private_assets,
      count(*) filter (where a.original_exists_in_storage = false)::bigint as missing_r2_count,
      count(*) filter (
        where card.generation_status = 'READY'
          and card.is_watermarked = true
      )::bigint as ready_card_preview_count,
      count(*) filter (
        where card.id is null
          or card.generation_status <> 'READY'
          or card.is_watermarked = false
      )::bigint as missing_card_preview_count,
      count(*) filter (
        where thumb.generation_status = 'FAILED'
           or card.generation_status = 'FAILED'
           or detail.generation_status = 'FAILED'
      )::bigint as failed_derivative_count,
      count(*) filter (where a.created_at >= date_trunc('day', now()))::bigint as imported_today,
      count(*) filter (where a.created_at >= date_trunc('month', now()))::bigint as imported_month
    from image_assets a
    left join image_derivatives thumb
      on thumb.image_asset_id = a.id and thumb.variant = 'THUMB'
    left join image_derivatives card
      on card.image_asset_id = a.id and card.variant = 'CARD'
    left join image_derivatives detail
      on detail.image_asset_id = a.id and detail.variant = 'DETAIL'
  `);

  const totalsRows = await executeRows<ScalarRow>(db, sql`
    select
      (select count(*)::bigint from asset_categories) as total_categories,
      (select count(*)::bigint from photo_events) as total_events,
      (select count(*)::bigint from contributors) as total_contributors
  `);

  const stats = statsRows[0];
  const totals = totalsRows[0];

  return {
    totalAssets: Number(stats?.total_assets ?? 0),
    approvedPublicAssets: Number(stats?.approved_public_assets ?? 0),
    privateAssets: Number(stats?.private_assets ?? 0),
    missingR2Count: Number(stats?.missing_r2_count ?? 0),
    readyCardPreviewCount: Number(stats?.ready_card_preview_count ?? 0),
    missingCardPreviewCount: Number(stats?.missing_card_preview_count ?? 0),
    failedDerivativeCount: Number(stats?.failed_derivative_count ?? 0),
    totalCategories: Number(totals?.total_categories ?? 0),
    totalEvents: Number(totals?.total_events ?? 0),
    totalContributors: Number(totals?.total_contributors ?? 0),
    importedToday: Number(stats?.imported_today ?? 0),
    importedMonth: Number(stats?.imported_month ?? 0),
  };
}

export async function getInternalAdminFilters(db: DrizzleClient) {
  const [statuses, categories, events, contributors] = await Promise.all([
    executeRows<{ status: string; asset_count: number | string }>(db, sql`
      select a.status, count(*)::bigint as asset_count
      from image_assets a
      group by a.status
      order by asset_count desc, a.status asc
    `),
    executeRows<FilterRow>(db, sql`
      select c.id, c.name, count(*)::bigint as asset_count
      from image_assets a
      join asset_categories c on c.id = a.category_id
      group by c.id, c.name
      order by asset_count desc, c.name asc
      limit 200
    `),
    executeRows<FilterRow>(db, sql`
      select e.id, e.name, e.event_date, count(*)::bigint as asset_count
      from image_assets a
      join photo_events e on e.id = a.event_id
      group by e.id, e.name, e.event_date
      order by asset_count desc, e.event_date desc nulls last
      limit 200
    `),
    executeRows<FilterRow>(db, sql`
      select p.id, p.display_name as name, count(*)::bigint as asset_count
      from image_assets a
      join contributors p on p.id = a.contributor_id
      group by p.id, p.display_name
      order by asset_count desc, p.display_name asc
      limit 200
    `),
  ]);

  return {
    statuses: statuses.map((row) => ({ status: row.status, assetCount: Number(row.asset_count) })),
    categories: categories.map((row) => ({
      id: row.id,
      name: row.name ?? "Untitled category",
      assetCount: Number(row.asset_count),
    })),
    events: events.map((row) => ({
      id: row.id,
      name: row.name,
      eventDate: toIso(row.event_date),
      assetCount: Number(row.asset_count),
    })),
    contributors: contributors.map((row) => ({
      id: row.id,
      displayName: row.name ?? "Unnamed contributor",
      assetCount: Number(row.asset_count),
    })),
  };
}

function parseAdminAssetQuery(params: URLSearchParams): AdminAssetQuery {
  const q = normalizeOptional(params.get("q"));
  const status = normalizeOptional(params.get("status"));
  const visibility = parseVisibility(params.get("visibility"));
  const categoryId = parseOptionalUuid(params.get("categoryId"), "categoryId");
  const eventId = parseOptionalUuid(params.get("eventId"), "eventId");
  const contributorId = parseOptionalUuid(params.get("contributorId"), "contributorId");
  const r2Exists = parseOptionalBoolean(params.get("r2Exists"), "r2Exists");
  const derivativeStatus = parseDerivativeFilter(params.get("derivativeStatus"));
  const previewState = parsePreviewState(params.get("previewState"));
  const hasPreview = parseOptionalBoolean(params.get("hasPreview"), "hasPreview");
  const cursor = normalizeOptional(params.get("cursor"));
  const limit = parseLimit(params.get("limit"));
  const sort = parseSort(params.get("sort"));

  return {
    q,
    status,
    visibility,
    categoryId,
    eventId,
    contributorId,
    r2Exists,
    derivativeStatus,
    previewState,
    hasPreview,
    cursor,
    limit,
    sort,
  };
}

function buildAdminAssetsSql(query: AdminAssetQuery): SQL {
  const where = buildWhere(query);
  const order = orderBySql(query.sort);
  const pageSize = query.limit + 1;

  return sql`
    ${adminSelectSql(query.sort)}
    ${adminFromSql()}
    where ${sql.join(where, sql` and `)}
    ${order}
    limit ${pageSize}
  `;
}

function buildWhere(query: AdminAssetQuery): SQL[] {
  const where: SQL[] = [sql`a.media_type = 'IMAGE'`];

  if (query.q) {
    where.push(sql`
      (
        a.legacy_image_code ilike ${`%${query.q}%`}
        or a.id::text ilike ${`%${query.q}%`}
        or coalesce(a.original_file_name, '') ilike ${`%${query.q}%`}
        or coalesce(a.caption, '') ilike ${`%${query.q}%`}
        or coalesce(a.headline, '') ilike ${`%${query.q}%`}
        or coalesce(a.keywords, '') ilike ${`%${query.q}%`}
        or coalesce(a.search_text, '') ilike ${`%${query.q}%`}
      )
    `);
  }
  if (query.status) where.push(sql`a.status = ${toCleanAssetStatusFilter(query.status)}`);
  if (query.visibility) where.push(sql`a.visibility = ${query.visibility}`);
  if (query.categoryId) where.push(sql`a.category_id = ${query.categoryId}`);
  if (query.eventId) where.push(sql`a.event_id = ${query.eventId}`);
  if (query.contributorId) where.push(sql`a.contributor_id = ${query.contributorId}`);
  if (query.r2Exists !== undefined) where.push(sql`a.original_exists_in_storage = ${query.r2Exists}`);
  if (query.hasPreview !== undefined) {
    where.push(query.hasPreview ? sql`${cardReadySql()} = true` : sql`${cardReadySql()} = false`);
  }
  if (query.derivativeStatus) {
    where.push(sql`${overallDerivativeStateSql()} = ${query.derivativeStatus}`);
  }
  if (query.previewState === "ready") {
    where.push(sql`${previewStateSql()} = 'READY'`);
  } else if (query.previewState === "partial") {
    where.push(sql`${previewStateSql()} = 'PARTIAL'`);
  } else if (query.previewState === "missing") {
    where.push(sql`${previewStateSql()} = 'MISSING'`);
  }
  if (query.cursor) {
    where.push(cursorPredicate(decodeCursor(query.cursor), query.sort));
  }

  return where;
}

function adminSelectSql(sort: AdminSort): SQL {
  return sql`
    select
      a.id,
      a.legacy_image_code as legacy_imagecode,
      a.title,
      a.caption,
      a.headline,
      a.description,
      a.keywords,
      a.status,
      a.visibility,
      a.original_exists_in_storage as r2_exists,
      a.original_storage_checked_at as r2_checked_at,
      a.created_at,
      a.updated_at,
      a.image_date,
      c.id as category_id,
      c.name as category_name,
      e.id as event_id,
      e.name as event_name,
      e.event_date,
      p.id as contributor_id,
      p.display_name as contributor_name,
      thumb.generation_status as thumb_status,
      thumb.width as thumb_width,
      thumb.height as thumb_height,
      thumb.is_watermarked as thumb_watermarked,
      thumb.mime_type as thumb_mime_type,
      thumb.updated_at as thumb_updated_at,
      card.generation_status as card_status,
      card.width as card_width,
      card.height as card_height,
      card.is_watermarked as card_watermarked,
      card.mime_type as card_mime_type,
      card.updated_at as card_updated_at,
      detail.generation_status as detail_status,
      detail.width as detail_width,
      detail.height as detail_height,
      detail.is_watermarked as detail_watermarked,
      detail.mime_type as detail_mime_type,
      detail.updated_at as detail_updated_at,
      coalesce(a.image_date, a.created_at) as image_sort_at,
      ${sortGroupRankSql(sort)} as sort_group_rank
  `;
}

function adminFromSql(): SQL {
  return sql`
    from image_assets a
    left join asset_categories c on c.id = a.category_id
    left join photo_events e on e.id = a.event_id
    left join contributors p on p.id = a.contributor_id
    left join image_derivatives thumb
      on thumb.image_asset_id = a.id and thumb.variant = 'THUMB'
    left join image_derivatives card
      on card.image_asset_id = a.id and card.variant = 'CARD'
    left join image_derivatives detail
      on detail.image_asset_id = a.id and detail.variant = 'DETAIL'
  `;
}

function orderBySql(sort: AdminSort): SQL {
  if (sort === "oldest") return sql`order by a.created_at asc, a.id asc`;
  if (sort === "imageDateDesc") return sql`order by image_sort_at desc, a.id desc`;
  if (sort === "imageDateAsc") return sql`order by image_sort_at asc, a.id asc`;
  if (sort === "recentlyUpdated") return sql`order by a.updated_at desc, a.id desc`;
  if (sort === "missingR2") return sql`order by ${sortGroupRankSql(sort)} asc, a.created_at desc, a.id desc`;
  if (sort === "missingPreview") return sql`order by ${sortGroupRankSql(sort)} asc, a.created_at desc, a.id desc`;
  return sql`order by a.created_at desc, a.id desc`;
}

function cursorPredicate(cursor: CursorPayload, sort: AdminSort): SQL {
  if (cursor.sort !== sort) {
    throw new AppError(400, "INVALID_CURSOR", "Cursor is invalid for this sort.");
  }

  if (sort === "oldest") {
    return sql`(a.created_at, a.id) > (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
  }
  if (sort === "imageDateDesc") {
    return sql`(coalesce(a.image_date, a.created_at), a.id) < (${cursor.imageSortAt ?? cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
  }
  if (sort === "imageDateAsc") {
    return sql`(coalesce(a.image_date, a.created_at), a.id) > (${cursor.imageSortAt ?? cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
  }
  if (sort === "recentlyUpdated") {
    return sql`(a.updated_at, a.id) < (${cursor.updatedAt ?? cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
  }
  if (sort === "missingR2" || sort === "missingPreview") {
    return sql`(
      ${sortGroupRankSql(sort)},
      a.created_at,
      a.id
    ) > (
      ${cursor.groupRank ?? 0},
      ${cursor.createdAt}::timestamptz,
      ${cursor.id}::uuid
    )`;
  }
  return sql`(a.created_at, a.id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
}

async function mapAdminAssetRow(row: AdminAssetRow, secret: string | undefined, ttlSeconds: number) {
  const thumb = derivativeSummary(row.thumb_status, row.thumb_width, row.thumb_height, row.thumb_watermarked, row.thumb_mime_type, row.thumb_updated_at);
  const card = derivativeSummary(row.card_status, row.card_width, row.card_height, row.card_watermarked, row.card_mime_type, row.card_updated_at);
  const detail = derivativeSummary(row.detail_status, row.detail_width, row.detail_height, row.detail_watermarked, row.detail_mime_type, row.detail_updated_at);
  const readyPreviewVariants = [
    ...(thumb.state === "READY" ? ["thumb"] : []),
    ...(card.state === "READY" ? ["card"] : []),
    ...(detail.state === "READY" ? ["detail"] : []),
  ] as Array<"thumb" | "card" | "detail">;
  const missingPreviewVariants = (["thumb", "card", "detail"] as const).filter((variant) => !readyPreviewVariants.includes(variant));
  const bestVariant = readyPreviewVariants.includes("card")
    ? "card"
    : readyPreviewVariants.includes("detail")
      ? "detail"
      : readyPreviewVariants.includes("thumb")
        ? "thumb"
        : null;
  const safePreviewUrl = bestVariant
    ? await createPreviewUrl(row.id, bestVariant, secret, ttlSeconds)
    : null;
  const previewReady = row.r2_exists && readyPreviewVariants.length === 3;
  const previewState = previewReady ? "READY" : readyPreviewVariants.length > 0 ? "PARTIAL" : "MISSING";
  return {
    id: row.id,
    legacyImageCode: row.legacy_imagecode,
    title: row.title,
    caption: row.caption,
    headline: row.headline,
    description: row.description,
    keywords: row.keywords,
    status: row.status,
    visibility: row.visibility,
    r2Exists: row.r2_exists,
    r2CheckedAt: toIso(row.r2_checked_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    imageDate: toIso(row.image_date),
    category: row.category_id ? { id: row.category_id, name: row.category_name ?? "Untitled category" } : null,
    event: row.event_id ? { id: row.event_id, name: row.event_name, eventDate: toIso(row.event_date) } : null,
    contributor: row.contributor_id ? { id: row.contributor_id, displayName: row.contributor_name ?? "Unnamed contributor" } : null,
    hasPreview: safePreviewUrl !== null,
    previewReady,
    previewState,
    readyPreviewVariants,
    missingPreviewVariants,
    preview: safePreviewUrl
      ? {
          url: safePreviewUrl,
          width: bestVariant === "card" ? card.width : bestVariant === "detail" ? detail.width : thumb.width,
          height: bestVariant === "card" ? card.height : bestVariant === "detail" ? detail.height : thumb.height,
        }
      : null,
    derivatives: { thumb, card, detail },
  };
}

function derivativeSummary(
  status: string | null,
  width: number | null,
  height: number | null,
  isWatermarked: boolean | null,
  mimeType: string | null,
  updatedAt: Date | string | null,
) {
  const hasCompleteMetadata = width !== null && height !== null;
  const ready = status === "READY" && isWatermarked === true && hasCompleteMetadata;
  const state = mapDerivativeState(status);
  return {
    state: ready ? "READY" : state,
    width,
    height,
    isWatermarked: isWatermarked ?? false,
    mimeType,
    updatedAt: toIso(updatedAt),
  };
}

function mapDerivativeState(status: string | null): DerivativeState {
  if (!status) return "MISSING";
  if (status === "READY") return "READY";
  if (status === "FAILED") return "FAILED";
  return "PROCESSING";
}

function overallDerivativeStateSql(): SQL {
  return sql`
    case
      when thumb.generation_status = 'FAILED'
        or card.generation_status = 'FAILED'
        or detail.generation_status = 'FAILED'
      then 'FAILED'
      when ${cardReadySql()} = true
        and ${thumbReadyOrMissingSql()} = true
        and ${detailReadyOrMissingSql()} = true
      then 'READY'
      when card.id is null and thumb.id is null and detail.id is null
      then 'MISSING'
      else 'PROCESSING'
    end
  `;
}

function previewStateSql(): SQL {
  return sql`
    case
      when ${thumbReadySql()} = true and ${cardReadySql()} = true and ${detailReadySql()} = true then 'READY'
      when ${thumbReadySql()} = true or ${cardReadySql()} = true or ${detailReadySql()} = true then 'PARTIAL'
      else 'MISSING'
    end
  `;
}

function cardReadySql(): SQL {
  return sql`(card.generation_status = 'READY' and card.is_watermarked = true and card.mime_type is not null and card.width is not null and card.height is not null)`;
}

function thumbReadySql(): SQL {
  return sql`(thumb.generation_status = 'READY' and thumb.is_watermarked = true and thumb.mime_type is not null and thumb.width is not null and thumb.height is not null)`;
}

function detailReadySql(): SQL {
  return sql`(detail.generation_status = 'READY' and detail.is_watermarked = true and detail.mime_type is not null and detail.width is not null and detail.height is not null)`;
}

function thumbReadyOrMissingSql(): SQL {
  return sql`(thumb.id is null or (thumb.generation_status = 'READY' and thumb.is_watermarked = true and thumb.mime_type is not null and thumb.width is not null and thumb.height is not null))`;
}

function detailReadyOrMissingSql(): SQL {
  return sql`(detail.id is null or (detail.generation_status = 'READY' and detail.is_watermarked = true and detail.mime_type is not null and detail.width is not null and detail.height is not null))`;
}

function sortGroupRankSql(sort: AdminSort): SQL {
  if (sort === "missingPreview") {
    return sql`
      case
        when ${cardReadySql()} = false then 0
        else 1
      end
    `;
  }

  return sql`
    case
      when a.original_exists_in_storage = false then 0
      else 1
    end
  `;
}

function toCursor(row: AdminAssetRow, sort: AdminSort): CursorPayload {
  return {
    sort,
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIso(row.updated_at) ?? undefined,
    id: row.id,
    imageSortAt: toIso(row.image_sort_at) ?? undefined,
    groupRank: Number(row.sort_group_rank),
  };
}

function parseSort(value: string | null): AdminSort {
  if (!value) return "newest";
  if (
    value === "newest"
    || value === "oldest"
    || value === "imageDateDesc"
    || value === "imageDateAsc"
    || value === "recentlyUpdated"
    || value === "missingR2"
    || value === "missingPreview"
  ) {
    return value;
  }
  throw new AppError(400, "INVALID_SORT", "Sort is invalid for this request.");
}

function parseLimit(value: string | null) {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new AppError(400, "INVALID_LIMIT", "Limit must be an integer between 1 and 100.");
  }
  return parsed;
}

function parseOptionalBoolean(value: string | null, name: string) {
  if (!value) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AppError(400, "INVALID_QUERY", `${name} must be true or false.`);
}

function parseVisibility(value: string | null): Visibility | undefined {
  if (!value) return undefined;
  if (value === "PRIVATE" || value === "PUBLIC" || value === "UNLISTED") return value;
  throw new AppError(400, "INVALID_QUERY", "visibility must be PRIVATE, PUBLIC, or UNLISTED.");
}

function toCleanAssetStatus(status: UpdatePublishInput["status"]): CleanAssetStatus {
  if (status === "APPROVED") return "ACTIVE";
  if (status === "REJECTED") return "ARCHIVED";
  return "DRAFT";
}

function toCleanAssetStatusFilter(status: string): string {
  if (status === "APPROVED") return "ACTIVE";
  if (status === "REJECTED") return "ARCHIVED";
  if (status === "REVIEW") return "DRAFT";
  return status;
}

function toCleanDerivativeVariant(variant: "thumb" | "card" | "detail"): CleanDerivativeVariant {
  return variant.toUpperCase() as CleanDerivativeVariant;
}

function parseDerivativeFilter(value: string | null): DerivativeFilter | undefined {
  if (!value) return undefined;
  if (value === "READY" || value === "FAILED" || value === "PROCESSING" || value === "MISSING") return value;
  throw new AppError(400, "INVALID_QUERY", "derivativeStatus must be READY, FAILED, PROCESSING, or MISSING.");
}

function parsePreviewState(value: string | null): PreviewStateFilter {
  if (!value || value === "all") return "all";
  if (value === "ready" || value === "partial" || value === "missing") return value;
  throw new AppError(400, "INVALID_QUERY", "previewState must be all, ready, partial, or missing.");
}

function parseOptionalUuid(value: string | null, name: string) {
  const normalized = normalizeOptional(value);
  if (!normalized) return undefined;
  if (!isUuid(normalized)) {
    throw new AppError(400, "INVALID_QUERY", `${name} is invalid.`);
  }
  return normalized;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeOptional(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function encodeCursor(cursor: CursorPayload) {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeCursor(value: string): CursorPayload {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const parsed = JSON.parse(atob(padded)) as Partial<CursorPayload>;
    if (!parsed.sort || !parsed.createdAt || !parsed.id || !isUuid(parsed.id)) {
      throw new Error("invalid cursor");
    }
    return {
      sort: parseSort(parsed.sort),
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
      id: parsed.id,
      imageSortAt: parsed.imageSortAt,
      groupRank: Number(parsed.groupRank ?? 0),
    };
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "Cursor is invalid.");
  }
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[];
  }
  return [];
}

async function getAuditSnapshot(db: DrizzleClient, assetId: string) {
  const rows = await executeRows<{
    id: string;
    caption: string | null;
    headline: string | null;
    description: string | null;
    keywords: string | null;
    category_id: string | null;
    event_id: string | null;
    contributor_id: string | null;
    status: string;
    visibility: string;
  }>(db, sql`
    select
      id, caption, headline, description, keywords, category_id, event_id, contributor_id, status, visibility
    from image_assets
    where id = ${assetId}::uuid
    limit 1
  `);
  return rows[0] ?? null;
}

function diffSnapshot(from: Record<string, unknown>, to: Record<string, unknown>) {
  const changed: Record<string, unknown> = {};
  for (const key of Object.keys(from)) {
    if (from[key] !== to[key]) changed[key] = from[key];
  }
  return changed;
}

async function insertAuditLog(
  db: DrizzleClient,
  input: {
    assetId: string;
    action: (typeof ASSET_AUDIT_ACTION)[keyof typeof ASSET_AUDIT_ACTION];
    actor: AdminActor;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
) {
  await db.execute(sql`
    insert into asset_admin_audit_logs (
      asset_id, action, actor_auth_user_id, actor_email, before, after
    ) values (
      ${input.assetId}::uuid,
      ${input.action},
      ${input.actor.authUserId},
      ${input.actor.email},
      ${JSON.stringify(input.before)}::jsonb,
      ${JSON.stringify(input.after)}::jsonb
    )
  `);
}

async function getPublishEligibility(db: DrizzleClient, assetId: string) {
  const rows = await executeRows<{
    asset_exists: boolean;
    media_type: string | null;
    r2_exists: boolean | null;
    thumb_ready: boolean | null;
    card_ready: boolean | null;
    detail_ready: boolean | null;
  }>(db, sql`
    select
      (a.id is not null) as asset_exists,
      a.media_type,
      a.original_exists_in_storage as r2_exists,
      (
        thumb.generation_status = 'READY'
        and thumb.is_watermarked = true
        and thumb.mime_type is not null
        and thumb.width is not null
        and thumb.height is not null
      ) as thumb_ready,
      (
        card.generation_status = 'READY'
        and card.is_watermarked = true
        and card.mime_type is not null
        and card.width is not null
        and card.height is not null
      ) as card_ready,
      (
        detail.generation_status = 'READY'
        and detail.is_watermarked = true
        and detail.mime_type is not null
        and detail.width is not null
        and detail.height is not null
      ) as detail_ready
    from image_assets a
    left join image_derivatives thumb on thumb.image_asset_id = a.id and thumb.variant = 'THUMB'
    left join image_derivatives card on card.image_asset_id = a.id and card.variant = 'CARD'
    left join image_derivatives detail on detail.image_asset_id = a.id and detail.variant = 'DETAIL'
    where a.id = ${assetId}::uuid
    limit 1
  `);
  const row = rows[0];
  if (!row) return { assetExists: false, eligible: false, missingVariants: ["thumb", "card", "detail"] as string[] };

  const missingVariants: string[] = [];
  if (!row.thumb_ready) missingVariants.push("thumb");
  if (!row.card_ready) missingVariants.push("card");
  if (!row.detail_ready) missingVariants.push("detail");

  const eligible = row.media_type === "IMAGE" && row.r2_exists === true && missingVariants.length === 0;
  return { assetExists: true, eligible, missingVariants };
}

async function assertAssetExists(db: DrizzleClient, assetId: string) {
  const rows = await executeRows<{ id: string }>(db, sql`
    select id from image_assets where id = ${assetId}::uuid limit 1
  `);
  if (!rows[0]) {
    throw new AppError(404, "ASSET_NOT_FOUND", "Asset was not found.");
  }
}

async function assertForeignKeysExist(db: DrizzleClient, payload: UpdateEditorialInput) {
  if (payload.categoryId) {
    const rows = await executeRows<{ id: string }>(db, sql`
      select id from asset_categories where id = ${payload.categoryId}::uuid limit 1
    `);
    if (!rows[0]) throw new AppError(400, "CATEGORY_NOT_FOUND", "Category does not exist.");
  }

  if (payload.eventId) {
    const rows = await executeRows<{ id: string }>(db, sql`
      select id from photo_events where id = ${payload.eventId}::uuid limit 1
    `);
    if (!rows[0]) throw new AppError(400, "EVENT_NOT_FOUND", "Event does not exist.");
  }

  if (payload.contributorId) {
    const rows = await executeRows<{ id: string }>(db, sql`
      select id from contributors where id = ${payload.contributorId}::uuid limit 1
    `);
    if (!rows[0]) throw new AppError(400, "CONTRIBUTOR_NOT_FOUND", "Photographer does not exist.");
  }
}
