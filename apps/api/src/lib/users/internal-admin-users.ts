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
  cursor?: UserCursor;
}

interface UserCursor {
  createdAt: string;
  id: string;
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

interface AdminUserWithProfileRow extends AdminUserRow {
  profile_first_name: string | null;
  profile_last_name: string | null;
  profile_username: string | null;
  profile_company_type: string | null;
  profile_company_name: string | null;
  profile_job_title: string | null;
  profile_custom_job_title: string | null;
  profile_company_email: string | null;
  profile_company_email_domain: string | null;
  profile_email_validation_decision: string | null;
  profile_phone_country_code: string | null;
  profile_phone_number: string | null;
  profile_interested_asset_types: string[] | null;
  profile_image_quantity_range: string | null;
  profile_image_quality_preference: string | null;
  profile_created_at: Date | string | null;
  profile_updated_at: Date | string | null;
}

export async function listInternalAdminUsers(db: DrizzleClient, request: Request) {
  const query = parseUsersQuery(new URL(request.url).searchParams);
  const rows = await db.execute<AdminUserRow>(buildListUsersSql(query));
  const items = rows.rows.map(mapUserRow);
  const last = rows.rows.length === query.limit ? rows.rows[rows.rows.length - 1] : null;
  const nextCursor = last ? encodeCursor({ createdAt: toIso(last.created_at) ?? "", id: last.id, sort: query.sort }) : null;
  return { items, nextCursor };
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
      update users
      set
        is_subscriber = true,
        subscription_status = 'ACTIVE',
        subscription_started_at = coalesce(subscription_started_at, now()),
        subscription_ends_at = null,
        download_quota_limit = coalesce(download_quota_limit, 100),
        updated_at = now()
      where id = ${authUserId}::uuid
    `);
  } else {
    await db.execute(sql`
      update users
      set
        is_subscriber = false,
        subscription_status = 'CANCELLED',
        updated_at = now()
      where id = ${authUserId}::uuid
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

  const cursorRaw = search.get("cursor");
  const cursor: UserCursor | undefined = cursorRaw ? (decodeCursor(cursorRaw) ?? undefined) : undefined;
  if (cursor && cursor.sort !== sort) {
    throw new AppError(400, "INVALID_CURSOR", "Cursor is invalid for the current sort order.");
  }

  return {
    q: compact(search.get("q")),
    role: isUserRole(roleRaw) ? roleRaw : undefined,
    status: isUserStatus(statusRaw) ? statusRaw : undefined,
    isSubscriber:
      isSubscriberRaw === "true" ? true : isSubscriberRaw === "false" ? false : undefined,
    limit,
    sort,
    cursor,
  };
}

function buildListUsersSql(query: AdminUsersQuery) {
  const where: Array<ReturnType<typeof sql>> = [];
  if (query.q) {
    const term = `%${escapeLike(query.q)}%`;
    where.push(
      sql`(
        lower(u.email) like lower(${term}) escape '\\'
        or lower(coalesce(u.display_name, '')) like lower(${term}) escape '\\'
        or u.id::text like ${term} escape '\\'
      )`,
    );
  }
  if (query.role) where.push(sql`u.role = ${query.role}`);
  if (query.status) where.push(sql`u.status = ${query.status}`);
  if (query.isSubscriber !== undefined) where.push(sql`u.is_subscriber = ${query.isSubscriber}`);
  if (query.cursor) {
    where.push(cursorPredicate(query.cursor));
  }

  const order = query.sort === "oldest"
    ? sql`order by u.created_at asc, u.id asc`
    : sql`order by u.created_at desc, u.id desc`;

  return sql`
    select
      u.id,
      u.id as auth_user_id,
      u.email,
      u.display_name,
      u.role,
      u.status,
      u.is_subscriber,
      u.subscription_status,
      u.subscription_plan_id,
      u.subscription_started_at,
      u.subscription_ends_at,
      u.download_quota_limit,
      u.download_quota_used,
      u.created_at,
      u.updated_at
    from users u
    ${where.length ? sql`where ${sql.join(where, sql` and `)}` : sql``}
    ${order}
    limit ${query.limit}
  `;
}

async function getUserByAuthId(db: DrizzleClient, authUserId: string) {
  const result = await db.execute<AdminUserRow>(sql`
    select
      id,
      id as auth_user_id,
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
    from users
    where id = ${authUserId}::uuid
    limit 1
  `);
  return result.rows[0] ?? null;
}

async function getUserWithProfileByAuthId(db: DrizzleClient, authUserId: string) {
  const result = await db.execute<AdminUserWithProfileRow>(sql`
    select
      u.id,
      u.id as auth_user_id,
      u.email,
      u.display_name,
      u.role,
      u.status,
      u.is_subscriber,
      u.subscription_status,
      u.subscription_plan_id,
      u.subscription_started_at,
      u.subscription_ends_at,
      u.download_quota_limit,
      u.download_quota_used,
      u.created_at,
      u.updated_at,
      u.first_name as profile_first_name,
      u.last_name as profile_last_name,
      u.username as profile_username,
      u.company_type as profile_company_type,
      u.company_name as profile_company_name,
      u.job_title as profile_job_title,
      u.custom_job_title as profile_custom_job_title,
      u.company_email as profile_company_email,
      u.company_email_domain as profile_company_email_domain,
      u.email_validation_decision as profile_email_validation_decision,
      u.phone_country_code as profile_phone_country_code,
      u.phone_number as profile_phone_number,
      u.interested_asset_types as profile_interested_asset_types,
      u.image_quantity_range as profile_image_quantity_range,
      u.image_quality_preference as profile_image_quality_preference,
      u.created_at as profile_created_at,
      u.updated_at as profile_updated_at
    from users u
    where u.id = ${authUserId}::uuid
    limit 1
  `);
  return result.rows[0] ?? null;
}

export async function getInternalAdminUser(db: DrizzleClient, authUserId: string) {
  if (!authUserId.trim()) {
    throw new AppError(400, "INVALID_AUTH_USER_ID", "User id is invalid.");
  }

  const row = await getUserWithProfileByAuthId(db, authUserId);
  if (!row) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  return { user: mapUserWithProfileRow(row) };
}

export async function updateInternalAdminUserRole(
  db: DrizzleClient,
  authUserId: string,
  role: UserRole,
  actor: AdminActor,
) {
  if (!authUserId.trim()) {
    throw new AppError(400, "INVALID_AUTH_USER_ID", "User id is invalid.");
  }

  const before = await getUserByAuthId(db, authUserId);
  if (!before) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  await db.execute(sql`
    update users
    set role = ${role}, updated_at = now()
    where id = ${authUserId}::uuid
  `);

  const after = await getUserByAuthId(db, authUserId);
  if (!after) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  try {
    await insertUserAuditLogWithAction(db, {
      authUserId,
      actor,
      action: USER_AUDIT_ACTION.roleUpdated,
      before: { role: before.role },
      after: { role: after.role },
    });
  } catch (error) {
    console.warn("[internal-admin-users] role updated without audit log", {
      authUserId,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  return { user: mapUserRow(after) };
}

export async function updateInternalAdminUserStatus(
  db: DrizzleClient,
  authUserId: string,
  status: UserStatus,
  actor: AdminActor,
) {
  if (!authUserId.trim()) {
    throw new AppError(400, "INVALID_AUTH_USER_ID", "User id is invalid.");
  }

  const before = await getUserByAuthId(db, authUserId);
  if (!before) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  await db.execute(sql`
    update users
    set status = ${status}, updated_at = now()
    where id = ${authUserId}::uuid
  `);

  const after = await getUserByAuthId(db, authUserId);
  if (!after) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  try {
    await insertUserAuditLogWithAction(db, {
      authUserId,
      actor,
      action: USER_AUDIT_ACTION.statusUpdated,
      before: { status: before.status },
      after: { status: after.status },
    });
  } catch (error) {
    console.warn("[internal-admin-users] status updated without audit log", {
      authUserId,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  return { user: mapUserRow(after) };
}

async function insertUserAuditLogWithAction(
  db: DrizzleClient,
  input: {
    authUserId: string;
    actor: AdminActor;
    action: string;
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
      ${input.action},
      ${input.actor.authUserId},
      ${input.actor.email},
      ${JSON.stringify(input.before)}::jsonb,
      ${JSON.stringify(input.after)}::jsonb
    )
  `);
}

export async function updateInternalAdminUserSubscriptionDetail(
  db: DrizzleClient,
  authUserId: string,
  payload: {
    subscriptionPlanId?: string | null;
    subscriptionEndsAt?: string | null;
    downloadQuotaLimit?: number | null;
  },
  actor: AdminActor,
) {
  if (!authUserId.trim()) {
    throw new AppError(400, "INVALID_AUTH_USER_ID", "User id is invalid.");
  }

  const before = await getUserByAuthId(db, authUserId);
  if (!before) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  const sets: Array<ReturnType<typeof sql>> = [sql`updated_at = now()`];

  if (payload.subscriptionPlanId !== undefined) {
    sets.push(sql`subscription_plan_id = ${payload.subscriptionPlanId || null}`);
  }
  if (payload.subscriptionEndsAt !== undefined) {
    const endsAt = payload.subscriptionEndsAt ? new Date(payload.subscriptionEndsAt) : null;
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw new AppError(400, "INVALID_DATE", "subscriptionEndsAt is not a valid date.");
    }
    sets.push(sql`subscription_ends_at = ${endsAt ? endsAt.toISOString() : null}::timestamptz`);
  }
  if (payload.downloadQuotaLimit !== undefined) {
    sets.push(sql`download_quota_limit = ${payload.downloadQuotaLimit}`);
  }

  await db.execute(sql`
    update users
    set ${sql.join(sets, sql`, `)}
    where id = ${authUserId}::uuid
  `);

  const after = await getUserByAuthId(db, authUserId);
  if (!after) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  try {
    await insertUserAuditLogWithAction(db, {
      authUserId,
      actor,
      action: USER_AUDIT_ACTION.subscriptionUpdated,
      before: {
        subscriptionPlanId: before.subscription_plan_id,
        subscriptionEndsAt: toIso(before.subscription_ends_at),
        downloadQuotaLimit: before.download_quota_limit,
      },
      after: {
        subscriptionPlanId: after.subscription_plan_id,
        subscriptionEndsAt: toIso(after.subscription_ends_at),
        downloadQuotaLimit: after.download_quota_limit,
      },
    });
  } catch (error) {
    console.warn("[internal-admin-users] subscription detail updated without audit log", {
      authUserId,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  return { user: mapUserRow(after) };
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

function mapUserWithProfileRow(row: AdminUserWithProfileRow) {
  const base = mapUserRow(row);
  const hasProfile = row.profile_first_name !== null;
  return {
    ...base,
    profile: hasProfile
      ? {
          firstName: row.profile_first_name,
          lastName: row.profile_last_name,
          username: row.profile_username,
          companyType: row.profile_company_type,
          companyName: row.profile_company_name,
          jobTitle: row.profile_job_title,
          customJobTitle: row.profile_custom_job_title,
          companyEmail: row.profile_company_email,
          companyEmailDomain: row.profile_company_email_domain,
          emailValidationDecision: row.profile_email_validation_decision,
          phoneCountryCode: row.profile_phone_country_code,
          phoneNumber: row.profile_phone_number,
          interestedAssetTypes: row.profile_interested_asset_types,
          imageQuantityRange: row.profile_image_quantity_range,
          imageQualityPreference: row.profile_image_quality_preference,
          createdAt: toIso(row.profile_created_at),
          updatedAt: toIso(row.profile_updated_at),
        }
      : null,
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

function encodeCursor(cursor: UserCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(raw: string): UserCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed.createdAt === "string" &&
      typeof parsed.id === "string" &&
      typeof parsed.sort === "string"
    ) {
      return { createdAt: parsed.createdAt, id: parsed.id, sort: parsed.sort as UserSort };
    }
    return null;
  } catch {
    return null;
  }
}

function cursorPredicate(cursor: UserCursor) {
  if (cursor.sort === "oldest") {
    return sql`(u.created_at, u.id) > (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
  }
  return sql`(u.created_at, u.id) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
}
