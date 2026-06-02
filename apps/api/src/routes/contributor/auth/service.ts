import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../../db"
import {
  FOTOCORP_SESSION_COOKIE,
  FOTOCORP_SESSION_TTL_SECONDS,
  hashPlatformSessionToken,
} from "../../../lib/auth/platform-session"
import {
  hashPhotographerPortalPassword,
  validatePhotographerPortalPasswordStrength,
  verifyPhotographerPortalPassword,
} from "../../../lib/auth/contributor-password"
import { AppError } from "../../../lib/errors"
import {
  getPlatformSession,
  loginPlatformAuth,
  logoutPlatformAuth,
  requirePlatformSession,
} from "../../platform-auth/service"
/** @deprecated Use FOTOCORP_SESSION_COOKIE; kept for smoke scripts until updated. */
export const CONTRIBUTOR_SESSION_COOKIE = FOTOCORP_SESSION_COOKIE
export const CONTRIBUTOR_SESSION_TTL_SECONDS = FOTOCORP_SESSION_TTL_SECONDS

interface LoginInput {
  username: string
  password: string
}

interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

interface RequestMeta {
  ip: string | null
  userAgent: string | null
}

export interface ContributorSessionResult {
  sessionId: string
  account: {
    id: string
    username: string
    status: string
    mustChangePassword: boolean
    portalRole: "STANDARD" | "PORTAL_ADMIN"
  }
  contributor: {
    id: string
    legacyPhotographerId: number | null
    displayName: string
    email: string | null
    status: string
  }
}

export interface ContributorLoginResult extends ContributorSessionResult {
  rawSessionToken: string
  sessionExpiresAt: Date
  cookieMaxAgeSeconds: number
}

export async function loginPhotographer(
  db: DrizzleClient,
  input: LoginInput,
  meta: RequestMeta,
): Promise<ContributorLoginResult> {
  const result = await loginPlatformAuth(
    db,
    { identifier: input.username, password: input.password },
    meta,
    { ownerTypes: ["CONTRIBUTOR"] },
  )

  if (result.ownerType !== "CONTRIBUTOR" || !result.contributor) throw invalidLoginError()

  const session = toContributorSessionResult(result.contributor)
  return {
    ...session,
    rawSessionToken: result.rawSessionToken,
    sessionExpiresAt: result.sessionExpiresAt,
    cookieMaxAgeSeconds: result.cookieMaxAgeSeconds,
  }
}

export async function logoutPhotographer(db: DrizzleClient, token: string | undefined): Promise<void> {
  await logoutPlatformAuth(db, token)
}

export async function getCurrentPhotographerSession(
  db: DrizzleClient,
  token: string | undefined,
): Promise<ContributorSessionResult | null> {
  const session = await getPlatformSession(db, token)
  if (!session?.contributor || session.ownerType !== "CONTRIBUTOR") return null
  return toContributorSessionResult(session.contributor)
}

export async function requirePhotographerSession(
  db: DrizzleClient,
  token: string | undefined,
): Promise<ContributorSessionResult> {
  const session = await requirePlatformSession(db, token, "CONTRIBUTOR")
  if (!session.contributor) {
    throw new AppError(401, "CONTRIBUTOR_AUTH_REQUIRED", "Photographer authentication is required.")
  }
  return toContributorSessionResult(session.contributor)
}

export async function changePhotographerPassword(
  db: DrizzleClient,
  token: string | undefined,
  input: ChangePasswordInput,
): Promise<ContributorSessionResult> {
  if (!token) throw new AppError(401, "CONTRIBUTOR_AUTH_REQUIRED", "Photographer authentication is required.")

  const tokenHash = await hashPlatformSessionToken(token)
  const rows = await executeRows<{
    session_id: string
    credential_id: string
    password_hash: string
    contributor_id: string
    username: string
    must_reset_password: boolean
    legacy_photographer_id: string | null
    display_name: string
    email: string | null
    contributor_status: string
  }>(db, sql`
    select
      s.id as session_id,
      c.id as credential_id,
      c.password_hash,
      s.owner_id as contributor_id,
      c.login_identifier as username,
      c.must_reset_password,
      p.legacy_photographer_id::text,
      p.display_name,
      p.email,
      p.status as contributor_status
    from auth_sessions s
    join auth_credentials c on c.id = s.credential_id
    join contributors p on p.id = s.owner_id
    where s.session_token_hash = ${tokenHash}
      and s.owner_type = 'CONTRIBUTOR'
      and s.revoked_at is null
      and s.expires_at > now()
      and c.status = 'ACTIVE'
    limit 1
  `)

  const row = rows[0]
  if (!row) throw new AppError(401, "CONTRIBUTOR_AUTH_REQUIRED", "Photographer authentication is required.")

  const currentMatches = await verifyPhotographerPortalPassword(input.currentPassword, row.password_hash)
  if (!currentMatches) throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Current password is invalid.")

  const strengthError = validatePhotographerPortalPasswordStrength(input.newPassword)
  if (strengthError) throw new AppError(400, "WEAK_PASSWORD", strengthError)

  const newHash = await hashPhotographerPortalPassword(input.newPassword)

  await db.execute(sql`
    update auth_credentials
    set password_hash = ${newHash},
        must_reset_password = false,
        updated_at = now()
    where id = ${row.credential_id}::uuid
  `)

  await db.execute(sql`
    update auth_sessions
    set revoked_at = now()
    where credential_id = ${row.credential_id}::uuid
      and id <> ${row.session_id}::uuid
      and revoked_at is null
  `)

  const updated = await getCurrentPhotographerSession(db, token)
  if (!updated) throw new AppError(401, "CONTRIBUTOR_AUTH_REQUIRED", "Photographer authentication is required.")
  return updated
}

export async function hashSessionToken(token: string): Promise<string> {
  return hashPlatformSessionToken(token)
}

function toContributorSessionResult(contributor: {
  id: string
  legacyPhotographerId: number | null
  displayName: string
  email: string | null
  status: string
  username: string
  mustResetPassword: boolean
  portalRole: string
}): ContributorSessionResult {
  const portalRole = contributor.portalRole === "PORTAL_ADMIN" ? "PORTAL_ADMIN" : "STANDARD"
  return {
    sessionId: "",
    account: {
      id: contributor.id,
      username: contributor.username,
      status: "ACTIVE",
      mustChangePassword: contributor.mustResetPassword,
      portalRole,
    },
    contributor: {
      id: contributor.id,
      legacyPhotographerId: contributor.legacyPhotographerId,
      displayName: contributor.displayName,
      email: contributor.email,
      status: contributor.status,
    },
  }
}

function invalidLoginError(): AppError {
  return new AppError(401, "INVALID_CONTRIBUTOR_CREDENTIALS", "Invalid credentials.")
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[]
  }
  return []
}
