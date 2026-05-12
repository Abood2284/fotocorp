import { sql, type SQL } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import {
  hashPhotographerPortalPassword,
  validatePhotographerPortalPasswordStrength,
  verifyPhotographerPortalPassword,
} from "../../../lib/auth/contributor-password";
import { AppError } from "../../../lib/errors";

export const CONTRIBUTOR_SESSION_COOKIE = "fc_ph_session";
export const CONTRIBUTOR_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

interface LoginInput {
  username: string;
  password: string;
}

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

interface LoginAccountRow {
  account_id: string;
  contributor_id: string;
  username: string;
  password_hash: string;
  account_status: string;
  must_change_password: boolean;
  legacy_photographer_id: number | string | null;
  display_name: string;
  email: string | null;
  contributor_status: string;
}

interface SessionRow extends LoginAccountRow {
  session_id: string;
}

export interface ContributorSessionResult {
  sessionId: string;
  account: {
    id: string;
    username: string;
    status: string;
    mustChangePassword: boolean;
  };
  contributor: {
    id: string;
    legacyPhotographerId: number | null;
    displayName: string;
    email: string | null;
    status: string;
  };
}

export interface ContributorLoginResult extends ContributorSessionResult {
  /** Raw session token for HttpOnly cookie only — never return in JSON or persist in plaintext. */
  rawSessionToken: string;
  sessionExpiresAt: Date;
  cookieMaxAgeSeconds: number;
}

export async function loginPhotographer(
  db: DrizzleClient,
  input: LoginInput,
  meta: RequestMeta,
): Promise<ContributorLoginResult> {
  const username = input.username.trim().toLowerCase();
  if (!username || !input.password) throw invalidLoginError();

  const rows = await executeRows<LoginAccountRow>(db, sql`
    select
      pa.id as account_id,
      pa.contributor_id,
      pa.username,
      pa.password_hash,
      pa.status as account_status,
      pa.must_change_password,
      p.legacy_photographer_id,
      p.display_name,
      p.email,
      p.status as contributor_status
    from contributor_accounts pa
    join contributors p on p.id = pa.contributor_id
    where lower(pa.username) = ${username}
    limit 1
  `);

  const account = rows[0];
  if (!account || account.account_status !== "ACTIVE") throw invalidLoginError();

  const passwordMatches = await verifyPhotographerPortalPassword(input.password, account.password_hash);
  if (!passwordMatches) throw invalidLoginError();

  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + CONTRIBUTOR_SESSION_TTL_SECONDS * 1000);
  const ipHash = await hashIp(meta.ip);

  const sessionRows = await executeRows<{ id: string }>(db, sql`
    insert into contributor_sessions (
      contributor_account_id,
      contributor_id,
      token_hash,
      ip_hash,
      user_agent,
      expires_at,
      last_seen_at
    )
    values (
      ${account.account_id}::uuid,
      ${account.contributor_id}::uuid,
      ${tokenHash},
      ${ipHash},
      ${meta.userAgent},
      ${expiresAt},
      now()
    )
    returning id
  `);

  return {
    ...toSessionResult({ ...account, session_id: sessionRows[0]?.id ?? "" }),
    rawSessionToken: token,
    sessionExpiresAt: expiresAt,
    cookieMaxAgeSeconds: CONTRIBUTOR_SESSION_TTL_SECONDS,
  };
}

export async function logoutPhotographer(db: DrizzleClient, token: string | undefined): Promise<void> {
  if (!token) return;
  const tokenHash = await hashSessionToken(token);
  await db.execute(sql`
    update contributor_sessions
    set revoked_at = now()
    where token_hash = ${tokenHash}
      and revoked_at is null
  `);
}

export async function getCurrentPhotographerSession(
  db: DrizzleClient,
  token: string | undefined,
): Promise<ContributorSessionResult | null> {
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);

  const rows = await executeRows<SessionRow>(db, sql`
    select
      s.id as session_id,
      pa.id as account_id,
      pa.contributor_id,
      pa.username,
      pa.password_hash,
      pa.status as account_status,
      pa.must_change_password,
      p.legacy_photographer_id,
      p.display_name,
      p.email,
      p.status as contributor_status
    from contributor_sessions s
    join contributor_accounts pa on pa.id = s.contributor_account_id
    join contributors p on p.id = s.contributor_id
    where s.token_hash = ${tokenHash}
      and s.revoked_at is null
      and s.expires_at > now()
      and pa.status = 'ACTIVE'
      and pa.contributor_id = s.contributor_id
    limit 1
  `);

  const row = rows[0];
  if (!row) return null;

  await db.execute(sql`
    update contributor_sessions
    set last_seen_at = now()
    where id = ${row.session_id}::uuid
  `);

  return toSessionResult(row);
}

export async function requirePhotographerSession(
  db: DrizzleClient,
  token: string | undefined,
): Promise<ContributorSessionResult> {
  const session = await getCurrentPhotographerSession(db, token);
  if (!session) throw new AppError(401, "CONTRIBUTOR_AUTH_REQUIRED", "Photographer authentication is required.");
  return session;
}

export async function changePhotographerPassword(
  db: DrizzleClient,
  token: string | undefined,
  input: ChangePasswordInput,
): Promise<ContributorSessionResult> {
  const tokenHash = token ? await hashSessionToken(token) : null;
  if (!tokenHash) throw new AppError(401, "CONTRIBUTOR_AUTH_REQUIRED", "Photographer authentication is required.");

  const rows = await executeRows<SessionRow>(db, sql`
    select
      s.id as session_id,
      pa.id as account_id,
      pa.contributor_id,
      pa.username,
      pa.password_hash,
      pa.status as account_status,
      pa.must_change_password,
      p.legacy_photographer_id,
      p.display_name,
      p.email,
      p.status as contributor_status
    from contributor_sessions s
    join contributor_accounts pa on pa.id = s.contributor_account_id
    join contributors p on p.id = s.contributor_id
    where s.token_hash = ${tokenHash}
      and s.revoked_at is null
      and s.expires_at > now()
      and pa.status = 'ACTIVE'
      and pa.contributor_id = s.contributor_id
    limit 1
  `);

  const session = rows[0];
  if (!session) throw new AppError(401, "CONTRIBUTOR_AUTH_REQUIRED", "Photographer authentication is required.");

  const currentMatches = await verifyPhotographerPortalPassword(input.currentPassword, session.password_hash);
  if (!currentMatches) throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Current password is invalid.");

  const strengthError = validatePhotographerPortalPasswordStrength(input.newPassword);
  if (strengthError) throw new AppError(400, "WEAK_PASSWORD", strengthError);

  const newHash = await hashPhotographerPortalPassword(input.newPassword);

  await db.execute(sql`
    update contributor_accounts
    set password_hash = ${newHash},
        must_change_password = false,
        updated_at = now()
    where id = ${session.account_id}::uuid
  `);

  await db.execute(sql`
    update contributor_sessions
    set revoked_at = now()
    where contributor_account_id = ${session.account_id}::uuid
      and id <> ${session.session_id}::uuid
      and revoked_at is null
  `);

  const updated = await getCurrentPhotographerSession(db, token);
  if (!updated) throw new AppError(401, "CONTRIBUTOR_AUTH_REQUIRED", "Photographer authentication is required.");
  return updated;
}

export async function hashSessionToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function invalidLoginError(): AppError {
  return new AppError(401, "INVALID_CONTRIBUTOR_CREDENTIALS", "Invalid username or password.");
}

function toSessionResult(row: SessionRow): ContributorSessionResult {
  return {
    sessionId: row.session_id,
    account: {
      id: row.account_id,
      username: row.username,
      status: row.account_status,
      mustChangePassword: row.must_change_password,
    },
    contributor: {
      id: row.contributor_id,
      legacyPhotographerId: row.legacy_photographer_id === null ? null : Number(row.legacy_photographer_id),
      displayName: row.display_name,
      email: row.email,
      status: row.contributor_status,
    },
  };
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
