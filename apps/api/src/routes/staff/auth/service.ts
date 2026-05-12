import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import { validateStaffPasswordLength, verifyStaffPassword } from "../../../lib/auth/staff-password";
import { AppError } from "../../../lib/errors";

export const STAFF_SESSION_COOKIE = "fotocorp_staff_session";
export const STAFF_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const STAFF_AUDIT_ACTION = {
  LOGIN_SUCCESS: "STAFF_LOGIN_SUCCESS",
  LOGIN_FAILED: "STAFF_LOGIN_FAILED",
  LOGOUT: "STAFF_LOGOUT",
} as const;

interface LoginInput {
  username: string;
  password: string;
}

interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

interface StaffAccountRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: string;
  status: string;
}

interface SessionRow extends StaffAccountRow {
  session_id: string;
}

export interface StaffPublicProfile {
  id: string;
  username: string;
  displayName: string;
  role: string;
  status: string;
}

export interface StaffSessionResult {
  sessionId: string;
  staff: StaffPublicProfile;
}

export interface StaffLoginResult extends StaffSessionResult {
  rawSessionToken: string;
  sessionExpiresAt: Date;
  cookieMaxAgeSeconds: number;
}

export async function loginStaff(
  db: DrizzleClient,
  input: LoginInput,
  meta: RequestMeta,
): Promise<StaffLoginResult> {
  const username = input.username.trim().toLowerCase();
  if (!username || !input.password) {
    await insertStaffAuditLog(db, {
      staffAccountId: null,
      action: STAFF_AUDIT_ACTION.LOGIN_FAILED,
      entityType: "staff_auth",
      entityId: null,
      metadata: { reason: "missing_fields" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw invalidCredentialsError();
  }

  if (validateStaffPasswordLength(input.password)) {
    await insertStaffAuditLog(db, {
      staffAccountId: null,
      action: STAFF_AUDIT_ACTION.LOGIN_FAILED,
      entityType: "staff_auth",
      entityId: null,
      metadata: { reason: "weak_password_attempt" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw invalidCredentialsError();
  }

  const rows = await executeRows<StaffAccountRow>(db, sql`
    select id, username, password_hash, display_name, role, status
    from staff_accounts
    where lower(username) = ${username}
    limit 1
  `);

  const account = rows[0];
  if (!account || account.status !== "ACTIVE") {
    await insertStaffAuditLog(db, {
      staffAccountId: null,
      action: STAFF_AUDIT_ACTION.LOGIN_FAILED,
      entityType: "staff_auth",
      entityId: null,
      metadata: { reason: "unknown_or_inactive" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw invalidCredentialsError();
  }

  const passwordMatches = await verifyStaffPassword(input.password, account.password_hash);
  if (!passwordMatches) {
    await insertStaffAuditLog(db, {
      staffAccountId: account.id,
      action: STAFF_AUDIT_ACTION.LOGIN_FAILED,
      entityType: "staff_auth",
      entityId: account.id,
      metadata: { reason: "bad_password" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw invalidCredentialsError();
  }

  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + STAFF_SESSION_TTL_SECONDS * 1000);

  const sessionRows = await executeRows<{ id: string }>(db, sql`
    insert into staff_sessions (
      staff_account_id,
      session_token_hash,
      expires_at,
      last_seen_at,
      ip_address,
      user_agent
    )
    values (
      ${account.id}::uuid,
      ${tokenHash},
      ${expiresAt},
      now(),
      ${meta.ip},
      ${meta.userAgent}
    )
    returning id
  `);

  await db.execute(sql`
    update staff_accounts
    set last_login_at = now(), updated_at = now()
    where id = ${account.id}::uuid
  `);

  await insertStaffAuditLog(db, {
    staffAccountId: account.id,
    action: STAFF_AUDIT_ACTION.LOGIN_SUCCESS,
    entityType: "staff_session",
    entityId: sessionRows[0]?.id ?? null,
    metadata: null,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    sessionId: sessionRows[0]?.id ?? "",
    staff: toPublicProfile(account),
    rawSessionToken: token,
    sessionExpiresAt: expiresAt,
    cookieMaxAgeSeconds: STAFF_SESSION_TTL_SECONDS,
  };
}

export async function logoutStaff(db: DrizzleClient, token: string | undefined): Promise<void> {
  if (!token) return;
  const tokenHash = await hashSessionToken(token);
  const rows = await executeRows<{ staff_account_id: string }>(db, sql`
    select staff_account_id
    from staff_sessions
    where session_token_hash = ${tokenHash}
      and revoked_at is null
      and expires_at > now()
    limit 1
  `);
  const staffAccountId = rows[0]?.staff_account_id ?? null;

  await db.execute(sql`
    update staff_sessions
    set revoked_at = now()
    where session_token_hash = ${tokenHash}
      and revoked_at is null
  `);

  if (staffAccountId) {
    await insertStaffAuditLog(db, {
      staffAccountId,
      action: STAFF_AUDIT_ACTION.LOGOUT,
      entityType: "staff_auth",
      entityId: staffAccountId,
      metadata: null,
      ip: null,
      userAgent: null,
    });
  }
}

export async function getCurrentStaffSession(
  db: DrizzleClient,
  token: string | undefined,
): Promise<StaffSessionResult | null> {
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);

  const rows = await executeRows<SessionRow>(db, sql`
    select
      s.id as session_id,
      a.id,
      a.username,
      a.password_hash,
      a.display_name,
      a.role,
      a.status
    from staff_sessions s
    join staff_accounts a on a.id = s.staff_account_id
    where s.session_token_hash = ${tokenHash}
      and s.revoked_at is null
      and s.expires_at > now()
      and a.status = 'ACTIVE'
    limit 1
  `);

  const row = rows[0];
  if (!row) return null;

  await db.execute(sql`
    update staff_sessions
    set last_seen_at = now()
    where id = ${row.session_id}::uuid
  `);

  return {
    sessionId: row.session_id,
    staff: toPublicProfile(row),
  };
}

export async function requireStaffSession(db: DrizzleClient, token: string | undefined): Promise<StaffSessionResult> {
  const session = await getCurrentStaffSession(db, token);
  if (!session) throw new AppError(401, "STAFF_AUTH_REQUIRED", "Staff authentication is required.");
  return session;
}

interface InsertStaffAuditLogInput {
  staffAccountId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
}

async function insertStaffAuditLog(db: DrizzleClient, input: InsertStaffAuditLogInput): Promise<void> {
  if (input.metadata === null) {
    await db.execute(sql`
      insert into staff_audit_logs (
        staff_account_id,
        action,
        entity_type,
        entity_id,
        metadata_json,
        ip_address,
        user_agent
      )
      values (
        ${input.staffAccountId},
        ${input.action},
        ${input.entityType},
        ${input.entityId},
        null,
        ${input.ip},
        ${input.userAgent}
      )
    `);
    return;
  }

  const serialized = JSON.stringify(input.metadata);
  await db.execute(sql`
    insert into staff_audit_logs (
      staff_account_id,
      action,
      entity_type,
      entity_id,
      metadata_json,
      ip_address,
      user_agent
    )
    values (
      ${input.staffAccountId},
      ${input.action},
      ${input.entityType},
      ${input.entityId},
      ${serialized}::jsonb,
      ${input.ip},
      ${input.userAgent}
    )
  `);
}

function toPublicProfile(row: StaffAccountRow): StaffPublicProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
  };
}

function invalidCredentialsError(): AppError {
  return new AppError(401, "INVALID_CREDENTIALS", "Invalid username or password");
}

async function hashSessionToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}
