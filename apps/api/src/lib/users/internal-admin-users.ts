import { sql } from "drizzle-orm";
import type { DrizzleClient } from "../../db";
import { USER_AUDIT_ACTION } from "../audit/actions";
import { AppError } from "../errors";

type UserSort = "newest" | "oldest";
type UserStatus = "ACTIVE" | "SUSPENDED";
type UserRole = "USER" | "PHOTOGRAPHER" | "ADMIN" | "SUPER_ADMIN";
type SubscriptionStatus = "NONE" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";

interface AdminActor {
  authUserId: string | null;
  email: string | null;
}

interface AdminUsersQuery {
  q?: string;
  role?: UserRole;
  status?: UserStatus;
  isSubscriber?: boolean;
  limit: number;
  sort: UserSort;
}

interface AdminUserRow {
  [key: string]: unknown;
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  status: UserStatus;
  is_subscriber: boolean;
  subscription_status: SubscriptionStatus;
  subscription_plan_id: string | null;
  subscription_started_at: Date | string | null;
  subscription_ends_at: Date | string | null;
  download_quota_limit: number | null;
  download_quota_used: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export async function listInternalAdminUsers(db: DrizzleClient, request: Request) {
  const query = parseUsersQuery(new URL(request.url).searchParams);
  const rows = await db.execute<AdminUserRow>(buildListUsersSql(query));
  return { items: rows.rows.map(mapUserRow) };
}

export async function updateInternalAdminUserSubscription(
  db: DrizzleClient,
  authUserId: string,
  isSubscriber: boolean,
  actor: AdminActor,
) {
  if (!authUserId.trim()) {
    throw new AppError(400, "INVALID_AUTH_USER_ID", "User id is invalid.");
  }

  const before = await getUserByAuthId(db, authUserId);
  if (!before) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  if (isSubscriber) {
    await db.execute(sql`
      update app_user_profiles
      set
        is_subscriber = true,
        subscription_status = 'ACTIVE',
        subscription_started_at = coalesce(subscription_started_at, now()),
        subscription_ends_at = null,
        download_quota_limit = coalesce(download_quota_limit, 100),
        updated_at = now()
      where auth_user_id = ${authUserId}
    `);
  } else {
    await db.execute(sql`
      update app_user_profiles
      set
        is_subscriber = false,
        subscription_status = 'CANCELLED',
        updated_at = now()
      where auth_user_id = ${authUserId}
    `);
  }

  const after = await getUserByAuthId(db, authUserId);
  if (!after) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  try {
    await insertUserAuditLog(db, {
      authUserId,
      actor,
      before: {
        isSubscriber: before.is_subscriber,
        subscriptionStatus: before.subscription_status,
        subscriptionStartedAt: toIso(before.subscription_started_at),
        subscriptionEndsAt: toIso(before.subscription_ends_at),
        downloadQuotaLimit: before.download_quota_limit,
      },
      after: {
        isSubscriber: after.is_subscriber,
        subscriptionStatus: after.subscription_status,
        subscriptionStartedAt: toIso(after.subscription_started_at),
        subscriptionEndsAt: toIso(after.subscription_ends_at),
        downloadQuotaLimit: after.download_quota_limit,
      },
    });
  } catch (error) {
    console.warn("[internal-admin-users] subscription updated without audit log", {
      authUserId,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  return { user: mapUserRow(after) };
}

function parseUsersQuery(search: URLSearchParams): AdminUsersQuery {
  const limitRaw = Number(search.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.trunc(limitRaw))) : 50;
  const sortRaw = search.get("sort");
  const sort: UserSort = sortRaw === "oldest" ? "oldest" : "newest";

  const roleRaw = search.get("role");
  const statusRaw = search.get("status");
  const isSubscriberRaw = search.get("isSubscriber");

  return {
    q: compact(search.get("q")),
    role: isUserRole(roleRaw) ? roleRaw : undefined,
    status: isUserStatus(statusRaw) ? statusRaw : undefined,
    isSubscriber:
      isSubscriberRaw === "true" ? true : isSubscriberRaw === "false" ? false : undefined,
    limit,
    sort,
  };
}

function buildListUsersSql(query: AdminUsersQuery) {
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
  if (query.role) where.push(sql`aup.role = ${query.role}`);
  if (query.status) where.push(sql`aup.status = ${query.status}`);
  if (query.isSubscriber !== undefined) where.push(sql`aup.is_subscriber = ${query.isSubscriber}`);

  const order = query.sort === "oldest"
    ? sql`order by aup.created_at asc, aup.auth_user_id asc`
    : sql`order by aup.created_at desc, aup.auth_user_id desc`;

  return sql`
    select
      aup.id,
      aup.auth_user_id,
      aup.email,
      aup.display_name,
      aup.role,
      aup.status,
      aup.is_subscriber,
      aup.subscription_status,
      aup.subscription_plan_id,
      aup.subscription_started_at,
      aup.subscription_ends_at,
      aup.download_quota_limit,
      aup.download_quota_used,
      aup.created_at,
      aup.updated_at
    from app_user_profiles aup
    ${where.length ? sql`where ${sql.join(where, sql` and `)}` : sql``}
    ${order}
    limit ${query.limit}
  `;
}

async function getUserByAuthId(db: DrizzleClient, authUserId: string) {
  const result = await db.execute<AdminUserRow>(sql`
    select
      id,
      auth_user_id,
      email,
      display_name,
      role,
      status,
      is_subscriber,
      subscription_status,
      subscription_plan_id,
      subscription_started_at,
      subscription_ends_at,
      download_quota_limit,
      download_quota_used,
      created_at,
      updated_at
    from app_user_profiles
    where auth_user_id = ${authUserId}
    limit 1
  `);
  return result.rows[0] ?? null;
}

async function insertUserAuditLog(
  db: DrizzleClient,
  input: {
    authUserId: string;
    actor: AdminActor;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
) {
  await db.execute(sql`
    insert into admin_user_audit_logs (
      target_auth_user_id,
      action,
      actor_auth_user_id,
      actor_email,
      before,
      after
    )
    values (
      ${input.authUserId},
      ${USER_AUDIT_ACTION.subscriptionUpdated},
      ${input.actor.authUserId},
      ${input.actor.email},
      ${JSON.stringify(input.before)}::jsonb,
      ${JSON.stringify(input.after)}::jsonb
    )
  `);
}

function mapUserRow(row: AdminUserRow) {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    isSubscriber: row.is_subscriber,
    subscriptionStatus: row.subscription_status,
    subscriptionPlanId: row.subscription_plan_id,
    subscriptionStartedAt: toIso(row.subscription_started_at),
    subscriptionEndsAt: toIso(row.subscription_ends_at),
    downloadQuotaLimit: row.download_quota_limit,
    downloadQuotaUsed: row.download_quota_used,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function isUserRole(value: string | null): value is UserRole {
  return value === "USER" || value === "PHOTOGRAPHER" || value === "ADMIN" || value === "SUPER_ADMIN";
}

function isUserStatus(value: string | null): value is UserStatus {
  return value === "ACTIVE" || value === "SUSPENDED";
}

function compact(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
