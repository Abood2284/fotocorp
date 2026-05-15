import { sql } from "drizzle-orm";
import type { Env } from "../../../appTypes";
import { createHttpDb, type DrizzleClient } from "../../../db";
import { AppError } from "../../../lib/errors";
import type { StaffPublicProfile } from "../auth/service";

type UserSort = "newest" | "oldest";
type UserStatus = "ACTIVE" | "SUSPENDED";
type SubscriptionStatus = "NONE" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";

interface UsersQuery {
  q?: string;
  status?: UserStatus;
  isSubscriber?: boolean;
  hasDownloads?: boolean;
  limit: number;
  sort: UserSort;
}

export async function listCustomerUsers(db: DrizzleClient, search: URLSearchParams) {
  const query = parseUsersQuery(search);
  const where: Array<ReturnType<typeof sql>> = [];

  if (query.q) {
    const term = `%${escapeLike(query.q)}%`;
    where.push(
      sql`(
        lower(aup.email) like lower(${term}) escape '\\'
        or lower(coalesce(aup.display_name, '')) like lower(${term}) escape '\\'
        or aup.auth_user_id::text like ${term} escape '\\'
      )`,
    );
  }

  if (query.status) where.push(sql`aup.status = ${query.status}`);
  if (query.isSubscriber !== undefined) where.push(sql`aup.is_subscriber = ${query.isSubscriber}`);
  if (query.hasDownloads !== undefined) {
    if (query.hasDownloads) {
      where.push(sql`aup.download_quota_used > 0`);
    } else {
      where.push(sql`aup.download_quota_used = 0`);
    }
  }

  const order = query.sort === "oldest"
    ? sql`order by aup.created_at asc, aup.auth_user_id asc`
    : sql`order by aup.created_at desc, aup.auth_user_id desc`;

  const rows = await db.execute<{
    id: string;
    auth_user_id: string;
    email: string;
    display_name: string | null;
    status: UserStatus;
    is_subscriber: boolean;
    subscription_status: SubscriptionStatus;
    subscription_plan_id: string | null;
    download_quota_limit: number | null;
    download_quota_used: number;
    created_at: Date;
    updated_at: Date;
    company_name: string | null;
    job_title: string | null;
  }>(sql`
    select
      aup.id,
      aup.auth_user_id,
      aup.email,
      aup.display_name,
      aup.status,
      aup.is_subscriber,
      aup.subscription_status,
      aup.subscription_plan_id,
      aup.download_quota_limit,
      aup.download_quota_used,
      aup.created_at,
      aup.updated_at,
      fp.company_name,
      fp.job_title
    from app_user_profiles aup
    left join fotocorp_user_profiles fp on fp.user_id = aup.auth_user_id
    ${where.length ? sql`where ${sql.join(where, sql` and `)}` : sql``}
    ${order}
    limit ${query.limit}
  `);

  return {
    items: rows.rows.map((row) => ({
      id: row.id,
      authUserId: row.auth_user_id,
      email: row.email,
      displayName: row.display_name,
      companyName: row.company_name,
      jobTitle: row.job_title,
      status: row.status,
      isSubscriber: row.is_subscriber,
      subscriptionStatus: row.subscription_status,
      subscriptionPlanId: row.subscription_plan_id,
      downloadQuotaLimit: row.download_quota_limit,
      downloadQuotaUsed: row.download_quota_used,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    })),
  };
}

export async function getCustomerUserDetail(db: DrizzleClient, authUserId: string) {
  const userRow = await db.execute<{
    id: string;
    auth_user_id: string;
    email: string;
    display_name: string | null;
    status: UserStatus;
    is_subscriber: boolean;
    subscription_status: SubscriptionStatus;
    subscription_plan_id: string | null;
    download_quota_limit: number | null;
    download_quota_used: number;
    created_at: Date;
    updated_at: Date;
    company_name: string | null;
    company_email: string | null;
    first_name: string | null;
    last_name: string | null;
    job_title: string | null;
    company_type: string | null;
  }>(sql`
    select
      aup.id,
      aup.auth_user_id,
      aup.email,
      aup.display_name,
      aup.status,
      aup.is_subscriber,
      aup.subscription_status,
      aup.subscription_plan_id,
      aup.download_quota_limit,
      aup.download_quota_used,
      aup.created_at,
      aup.updated_at,
      fp.company_name,
      fp.company_email,
      fp.first_name,
      fp.last_name,
      fp.job_title,
      fp.company_type
    from app_user_profiles aup
    left join fotocorp_user_profiles fp on fp.user_id = aup.auth_user_id
    where aup.auth_user_id = ${authUserId}
    limit 1
  `);

  if (!userRow.rows[0]) {
    throw new AppError(404, "USER_NOT_FOUND", "Customer user was not found.");
  }
  const user = userRow.rows[0];

  const entitlements = await db.execute<{
    id: string;
    asset_type: string;
    allowed_downloads: number | null;
    downloads_used: number;
    quality_access: string;
    status: string;
    valid_from: Date | null;
    valid_until: Date | null;
    created_at: Date;
    updated_at: Date;
  }>(sql`
    select
      id, asset_type, allowed_downloads, downloads_used, quality_access, status, valid_from, valid_until, created_at, updated_at
    from subscriber_entitlements
    where user_id = ${authUserId}
    order by created_at desc
  `);

  const downloads = await db.execute<{
    id: string;
    asset_id: string;
    downloaded_size: string;
    created_at: Date;
    status: string;
  }>(sql`
    select
      id, image_asset_id as asset_id, requested_size as downloaded_size, created_at, status
    from image_download_logs
    where user_id = ${authUserId}
    order by created_at desc
    limit 10
  `);

  return {
    user: {
      id: user.id,
      authUserId: user.auth_user_id,
      email: user.email,
      displayName: user.display_name,
      companyName: user.company_name,
      companyEmail: user.company_email,
      firstName: user.first_name,
      lastName: user.last_name,
      jobTitle: user.job_title,
      companyType: user.company_type,
      status: user.status,
      isSubscriber: user.is_subscriber,
      subscriptionStatus: user.subscription_status,
      subscriptionPlanId: user.subscription_plan_id,
      downloadQuotaLimit: user.download_quota_limit,
      downloadQuotaUsed: user.download_quota_used,
      createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at,
      updatedAt: user.updated_at instanceof Date ? user.updated_at.toISOString() : user.updated_at,
    },
    entitlements: entitlements.rows.map(e => ({
      id: e.id,
      assetType: e.asset_type,
      allowedDownloads: e.allowed_downloads,
      downloadsUsed: e.downloads_used,
      qualityAccess: e.quality_access,
      status: e.status,
      validFrom: e.valid_from instanceof Date ? e.valid_from.toISOString() : e.valid_from,
      validUntil: e.valid_until instanceof Date ? e.valid_until.toISOString() : e.valid_until,
      createdAt: e.created_at instanceof Date ? e.created_at.toISOString() : e.created_at,
      updatedAt: e.updated_at instanceof Date ? e.updated_at.toISOString() : e.updated_at,
    })),
    recentDownloads: downloads.rows.map(d => ({
      id: d.id,
      assetId: d.asset_id,
      size: d.downloaded_size,
      status: d.status,
      createdAt: d.created_at instanceof Date ? d.created_at.toISOString() : d.created_at,
    })),
  };
}

export async function suspendCustomerUser(db: DrizzleClient, authUserId: string, staff: StaffPublicProfile) {
  const res = await db.execute(sql`
    update app_user_profiles
    set status = 'SUSPENDED', updated_at = now()
    where auth_user_id = ${authUserId}
    returning status
  `);
  if (!res.rows.length) throw new AppError(404, "USER_NOT_FOUND", "Customer user was not found.");
  return { status: res.rows[0].status };
}

export async function unsuspendCustomerUser(db: DrizzleClient, authUserId: string, staff: StaffPublicProfile) {
  const res = await db.execute(sql`
    update app_user_profiles
    set status = 'ACTIVE', updated_at = now()
    where auth_user_id = ${authUserId}
    returning status
  `);
  if (!res.rows.length) throw new AppError(404, "USER_NOT_FOUND", "Customer user was not found.");
  return { status: res.rows[0].status };
}

function parseUsersQuery(search: URLSearchParams): UsersQuery {
  const limitRaw = Number(search.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.trunc(limitRaw))) : 50;
  const sortRaw = search.get("sort");
  const sort: UserSort = sortRaw === "oldest" ? "oldest" : "newest";

  const statusRaw = search.get("status");
  const isSubscriberRaw = search.get("isSubscriber");
  const hasDownloadsRaw = search.get("hasDownloads");

  return {
    q: compact(search.get("q")),
    status: isUserStatus(statusRaw) ? statusRaw : undefined,
    isSubscriber: isSubscriberRaw === "true" ? true : isSubscriberRaw === "false" ? false : undefined,
    hasDownloads: hasDownloadsRaw === "true" ? true : hasDownloadsRaw === "false" ? false : undefined,
    limit,
    sort,
  };
}

function isUserStatus(value: string | null): value is UserStatus {
  return value === "ACTIVE" || value === "SUSPENDED";
}

function compact(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
