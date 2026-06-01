import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../../db"
import {
  generatePlatformSessionToken,
  hashPlatformSessionToken,
} from "../../../lib/auth/platform-session"
import { verifyStaffPassword, validateStaffPasswordLength } from "../../../lib/auth/staff-password"
import { AppError } from "../../../lib/errors"

export const STAFF_SESSION_COOKIE = "fotocorp_staff_session"
export const STAFF_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

export const STAFF_AUDIT_ACTION = {
  LOGIN_SUCCESS: "STAFF_LOGIN_SUCCESS",
  LOGIN_FAILED: "STAFF_LOGIN_FAILED",
  LOGOUT: "STAFF_LOGOUT",
} as const

interface LoginInput {
  username: string
  password: string
}

interface RequestMeta {
  ip: string | null
  userAgent: string | null
}

interface StaffMemberRow {
  id: string
  username: string
  password_hash: string
  display_name: string
  role: string
  status: string
  credential_id: string
}

interface SessionContextRow extends StaffMemberRow {
  session_id: string
}

export interface StaffPublicProfile {
  id: string
  username: string
  displayName: string
  role: string
  status: string
}

export interface StaffSessionResult {
  sessionId: string
  staff: StaffPublicProfile
}

export interface StaffLoginResult extends StaffSessionResult {
  rawSessionToken: string
  sessionExpiresAt: Date
  cookieMaxAgeSeconds: number
}

export async function loginStaff(
  db: DrizzleClient,
  input: LoginInput,
  meta: RequestMeta,
): Promise<StaffLoginResult> {
  const username = input.username.trim().toLowerCase()
  if (!username || !input.password) {
    await insertStaffAuditLog(db, {
      staffMemberId: null,
      action: STAFF_AUDIT_ACTION.LOGIN_FAILED,
      entityType: "staff_auth",
      entityId: null,
      metadata: { reason: "missing_fields" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    throw invalidCredentialsError()
  }

  if (validateStaffPasswordLength(input.password)) {
    await insertStaffAuditLog(db, {
      staffMemberId: null,
      action: STAFF_AUDIT_ACTION.LOGIN_FAILED,
      entityType: "staff_auth",
      entityId: null,
      metadata: { reason: "weak_password_attempt" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    throw invalidCredentialsError()
  }

  const account = await findStaffCredential(db, username)
  if (!account || account.status !== "ACTIVE") {
    await insertStaffAuditLog(db, {
      staffMemberId: account?.id ?? null,
      action: STAFF_AUDIT_ACTION.LOGIN_FAILED,
      entityType: "staff_auth",
      entityId: account?.id ?? null,
      metadata: { reason: "unknown_or_inactive" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    throw invalidCredentialsError()
  }

  const passwordMatches = await verifyStaffPassword(input.password, account.password_hash)
  if (!passwordMatches) {
    await insertStaffAuditLog(db, {
      staffMemberId: account.id,
      action: STAFF_AUDIT_ACTION.LOGIN_FAILED,
      entityType: "staff_auth",
      entityId: account.id,
      metadata: { reason: "bad_password" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    throw invalidCredentialsError()
  }

  const token = generatePlatformSessionToken()
  const tokenHash = await hashPlatformSessionToken(token)
  const expiresAt = new Date(Date.now() + STAFF_SESSION_TTL_SECONDS * 1000)

  const sessionRows = await executeRows<{ id: string }>(db, sql`
    insert into auth_sessions (
      credential_id, owner_type, owner_id, session_token_hash,
      expires_at, last_seen_at, ip_address, user_agent
    ) values (
      ${account.credential_id}::uuid,
      'STAFF',
      ${account.id}::uuid,
      ${tokenHash},
      ${expiresAt},
      now(),
      ${meta.ip},
      ${meta.userAgent}
    )
    returning id
  `)

  await db.execute(sql`
    update staff_members
    set last_login_at = now(), updated_at = now()
    where id = ${account.id}::uuid
  `)

  await db.execute(sql`
    update auth_credentials
    set last_login_at = now(), updated_at = now()
    where id = ${account.credential_id}::uuid
  `)

  await insertStaffAuditLog(db, {
    staffMemberId: account.id,
    action: STAFF_AUDIT_ACTION.LOGIN_SUCCESS,
    entityType: "staff_session",
    entityId: sessionRows[0]?.id ?? null,
    metadata: null,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return {
    sessionId: sessionRows[0]?.id ?? "",
    staff: toPublicProfile(account),
    rawSessionToken: token,
    sessionExpiresAt: expiresAt,
    cookieMaxAgeSeconds: STAFF_SESSION_TTL_SECONDS,
  }
}

export async function logoutStaff(db: DrizzleClient, token: string | undefined): Promise<void> {
  if (!token) return
  const tokenHash = await hashPlatformSessionToken(token)

  const rows = await executeRows<{ owner_id: string }>(db, sql`
    select owner_id
    from auth_sessions
    where session_token_hash = ${tokenHash}
      and owner_type = 'STAFF'
      and revoked_at is null
      and expires_at > now()
    limit 1
  `)

  const staffMemberId = rows[0]?.owner_id ?? null

  await db.execute(sql`
    update auth_sessions
    set revoked_at = now()
    where session_token_hash = ${tokenHash}
      and owner_type = 'STAFF'
      and revoked_at is null
  `)

  if (staffMemberId) {
    await insertStaffAuditLog(db, {
      staffMemberId,
      action: STAFF_AUDIT_ACTION.LOGOUT,
      entityType: "staff_auth",
      entityId: staffMemberId,
      metadata: null,
      ip: null,
      userAgent: null,
    })
  }
}

export async function getCurrentStaffSession(
  db: DrizzleClient,
  token: string | undefined,
): Promise<StaffSessionResult | null> {
  if (!token) return null
  const tokenHash = await hashPlatformSessionToken(token)

  const rows = await executeRows<SessionContextRow>(db, sql`
    select
      s.id as session_id,
      m.id,
      c.login_identifier as username,
      c.password_hash,
      m.display_name,
      m.role,
      m.status,
      c.id as credential_id
    from auth_sessions s
    join auth_credentials c on c.id = s.credential_id
    join staff_members m on m.id = s.owner_id
    where s.session_token_hash = ${tokenHash}
      and s.owner_type = 'STAFF'
      and s.revoked_at is null
      and s.expires_at > now()
      and c.status = 'ACTIVE'
      and m.status = 'ACTIVE'
    limit 1
  `)

  const row = rows[0]
  if (!row) return null

  await db.execute(sql`
    update auth_sessions set last_seen_at = now() where id = ${row.session_id}::uuid
  `)

  return {
    sessionId: row.session_id,
    staff: toPublicProfile(row),
  }
}

export async function requireStaffSession(db: DrizzleClient, token: string | undefined): Promise<StaffSessionResult> {
  const session = await getCurrentStaffSession(db, token)
  if (!session) throw new AppError(401, "STAFF_AUTH_REQUIRED", "Staff authentication is required.")
  return session
}

async function findStaffCredential(db: DrizzleClient, username: string): Promise<StaffMemberRow | null> {
  const rows = await executeRows<StaffMemberRow>(db, sql`
    select
      m.id,
      c.login_identifier as username,
      c.password_hash,
      m.display_name,
      m.role,
      m.status,
      c.id as credential_id
    from auth_credentials c
    join staff_members m on m.id = c.owner_id
    where c.owner_type = 'STAFF'
      and c.identifier_type = 'USERNAME'
      and lower(c.login_identifier) = ${username}
    limit 1
  `)

  return rows[0] ?? null
}

interface InsertStaffAuditLogInput {
  staffMemberId: string | null
  action: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  userAgent: string | null
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
      ) values (
        ${input.staffMemberId},
        ${input.action},
        ${input.entityType},
        ${input.entityId},
        null,
        ${input.ip},
        ${input.userAgent}
      )
    `)
    return
  }

  const serialized = JSON.stringify(input.metadata)
  await db.execute(sql`
    insert into staff_audit_logs (
      staff_account_id,
      action,
      entity_type,
      entity_id,
      metadata_json,
      ip_address,
      user_agent
    ) values (
      ${input.staffMemberId},
      ${input.action},
      ${input.entityType},
      ${input.entityId},
      ${serialized}::jsonb,
      ${input.ip},
      ${input.userAgent}
    )
  `)
}

function toPublicProfile(row: StaffMemberRow): StaffPublicProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
  }
}

function invalidCredentialsError(): AppError {
  return new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials.")
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[]
  }
  return []
}
