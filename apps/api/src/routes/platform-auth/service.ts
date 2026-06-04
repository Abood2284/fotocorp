import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import {
  generatePlatformSessionToken,
  FOTOCORP_SESSION_TTL_SECONDS,
  hashPlatformSessionToken,
} from "../../lib/auth/platform-session"
import {
  hashPhotographerPortalPassword,
  validatePhotographerPortalPasswordStrength,
  verifyPhotographerPortalPassword,
} from "../../lib/auth/contributor-password"
import { AppError } from "../../lib/errors"
import { createPlatformUser } from "../../lib/users/platform-user"
import type { ValidatedRegistrationProfile } from "../auth/services/fotocorp-registration-profile"

export type PlatformOwnerType = "USER" | "CONTRIBUTOR"

export interface PlatformLoginInput {
  identifier: string
  password: string
}

export interface PlatformSignUpInput {
  profile: ValidatedRegistrationProfile
  email: string
  password: string
  displayName?: string | null
  avatarUrl?: string | null
}

export interface RequestMeta {
  ip: string | null
  userAgent: string | null
}

export interface PlatformLoginResult {
  ownerType: PlatformOwnerType
  rawSessionToken: string
  sessionExpiresAt: Date
  cookieMaxAgeSeconds: number
  user: PlatformUserPayload | null
  contributor: PlatformContributorPayload | null
}

export interface PlatformUserPayload {
  id: string
  email: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  role: string
  status: string
  isSubscriber: boolean
  subscriptionStatus: string
}

export interface PlatformContributorPayload {
  id: string
  legacyPhotographerId: number | null
  displayName: string
  email: string | null
  status: string
  username: string
  mustResetPassword: boolean
  portalRole: string
}

export interface PlatformSessionResult {
  ownerType: PlatformOwnerType
  user: PlatformUserPayload | null
  contributor: PlatformContributorPayload | null
}

interface CredentialRow {
  id: string
  owner_type: PlatformOwnerType
  owner_id: string
  login_identifier: string
  identifier_type: string
  password_hash: string
  status: string
  must_reset_password: boolean
}

export async function loginPlatformAuth(
  db: DrizzleClient,
  input: PlatformLoginInput,
  meta: RequestMeta,
  options?: { ownerTypes?: PlatformOwnerType[] },
): Promise<PlatformLoginResult> {
  const identifier = input.identifier.trim()
  const password = input.password
  if (!identifier || !password) throw invalidCredentialsError()

  const credential = await findCredential(db, identifier, options?.ownerTypes)
  if (!credential || credential.status !== "ACTIVE") throw invalidCredentialsError()

  const passwordMatches = await verifyPhotographerPortalPassword(password, credential.password_hash)
  if (!passwordMatches) throw invalidCredentialsError()

  await assertOwnerCanLogin(db, credential.owner_type, credential.owner_id)

  const session = await createAuthSession(db, credential, meta)

  return {
    ownerType: credential.owner_type,
    rawSessionToken: session.rawSessionToken,
    sessionExpiresAt: session.expiresAt,
    cookieMaxAgeSeconds: FOTOCORP_SESSION_TTL_SECONDS,
    user: credential.owner_type === "USER" ? await loadUserPayload(db, credential.owner_id) : null,
    contributor:
      credential.owner_type === "CONTRIBUTOR" ? await loadContributorPayload(db, credential) : null,
  }
}

export async function signUpPlatformUser(
  db: DrizzleClient,
  input: PlatformSignUpInput,
  meta: RequestMeta,
): Promise<PlatformLoginResult> {
  const email = input.email.trim().toLowerCase()
  const passwordHash = await hashPhotographerPortalPassword(input.password)

  const existing = await executeRows<{ id: string }>(db, sql`
    select id from users
    where lower(email) = ${email}
       or lower(username) = ${input.profile.username.toLowerCase()}
    limit 1
  `)
  if (existing[0]) {
    throw new AppError(409, "USER_ALREADY_EXISTS", "An account with this email or username already exists.")
  }

  const user = await createPlatformUser(db, input.profile, {
    email,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl,
  })

  if (!user) throw new AppError(500, "USER_CREATE_FAILED", "Account could not be created.")

  await db.execute(sql`
    insert into auth_credentials (
      owner_type, owner_id, login_identifier, identifier_type,
      password_hash, status, must_reset_password, updated_at
    ) values
      ('USER', ${user.id}::uuid, ${email}, 'EMAIL', ${passwordHash}, 'ACTIVE', false, now()),
      ('USER', ${user.id}::uuid, ${input.profile.username.toLowerCase()}, 'USERNAME', ${passwordHash}, 'ACTIVE', false, now())
    on conflict do nothing
  `)

  const credentialRows = await executeRows<CredentialRow>(db, sql`
    select id, owner_type, owner_id, login_identifier, identifier_type, password_hash, status, must_reset_password
    from auth_credentials
    where owner_type = 'USER' and owner_id = ${user.id}::uuid and identifier_type = 'EMAIL'
    limit 1
  `)

  const credential = credentialRows[0]
  if (!credential) throw new AppError(500, "CREDENTIAL_CREATE_FAILED", "Account credentials could not be created.")

  const session = await createAuthSession(db, credential, meta)

  return {
    ownerType: "USER",
    rawSessionToken: session.rawSessionToken,
    sessionExpiresAt: session.expiresAt,
    cookieMaxAgeSeconds: FOTOCORP_SESSION_TTL_SECONDS,
    user: await loadUserPayload(db, user.id),
    contributor: null,
  }
}

export async function logoutPlatformAuth(db: DrizzleClient, token: string | undefined): Promise<void> {
  if (!token) return
  const tokenHash = await hashPlatformSessionToken(token)
  await db.execute(sql`
    update auth_sessions
    set revoked_at = now()
    where session_token_hash = ${tokenHash} and revoked_at is null
  `)
}

export async function getPlatformSession(
  db: DrizzleClient,
  token: string | undefined,
): Promise<PlatformSessionResult | null> {
  if (!token) return null
  const tokenHash = await hashPlatformSessionToken(token)

  const rows = await executeRows<{
    session_id: string
    owner_type: PlatformOwnerType
    owner_id: string
    credential_id: string
    login_identifier: string
    must_reset_password: boolean
  }>(db, sql`
    select
      s.id as session_id,
      s.owner_type,
      s.owner_id,
      c.id as credential_id,
      c.login_identifier,
      c.must_reset_password
    from auth_sessions s
    join auth_credentials c on c.id = s.credential_id
    where s.session_token_hash = ${tokenHash}
      and s.revoked_at is null
      and s.expires_at > now()
      and c.status = 'ACTIVE'
    limit 1
  `)

  const row = rows[0]
  if (!row) return null

  await db.execute(sql`
    update auth_sessions set last_seen_at = now() where id = ${row.session_id}::uuid
  `)

  try {
    await assertOwnerCanLogin(db, row.owner_type, row.owner_id)
  } catch {
    return null
  }

  if (row.owner_type === "USER") {
    return {
      ownerType: "USER",
      user: await loadUserPayload(db, row.owner_id),
      contributor: null,
    }
  }

  const credential: CredentialRow = {
    id: row.credential_id,
    owner_type: "CONTRIBUTOR",
    owner_id: row.owner_id,
    login_identifier: row.login_identifier,
    identifier_type: "USERNAME",
    password_hash: "",
    status: "ACTIVE",
    must_reset_password: row.must_reset_password,
  }

  return {
    ownerType: "CONTRIBUTOR",
    user: null,
    contributor: await loadContributorPayload(db, credential),
  }
}

export async function requirePlatformSession(
  db: DrizzleClient,
  token: string | undefined,
  ownerType?: PlatformOwnerType,
): Promise<PlatformSessionResult> {
  const session = await getPlatformSession(db, token)
  if (!session) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.")
  if (ownerType && session.ownerType !== ownerType) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.")
  }
  return session
}

export interface ChangePlatformPasswordInput {
  currentPassword: string
  newPassword: string
}

export async function changePlatformUserPassword(
  db: DrizzleClient,
  token: string | undefined,
  input: ChangePlatformPasswordInput,
): Promise<PlatformSessionResult> {
  if (!token) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.")

  const tokenHash = await hashPlatformSessionToken(token)
  const rows = await executeRows<{
    session_id: string
    owner_id: string
    password_hash: string
  }>(db, sql`
    select
      s.id as session_id,
      s.owner_id,
      c.password_hash
    from auth_sessions s
    join auth_credentials c on c.id = s.credential_id
    where s.session_token_hash = ${tokenHash}
      and s.owner_type = 'USER'
      and s.revoked_at is null
      and s.expires_at > now()
      and c.status = 'ACTIVE'
    limit 1
  `)

  const row = rows[0]
  if (!row) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.")

  const currentMatches = await verifyPhotographerPortalPassword(input.currentPassword, row.password_hash)
  if (!currentMatches) throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Current password is invalid.")

  const strengthError = validatePhotographerPortalPasswordStrength(input.newPassword)
  if (strengthError) throw new AppError(400, "WEAK_PASSWORD", strengthError)

  if (input.currentPassword === input.newPassword) {
    throw new AppError(400, "PASSWORD_UNCHANGED", "Choose a password different from your current password.")
  }

  const newHash = await hashPhotographerPortalPassword(input.newPassword)

  await db.execute(sql`
    update auth_credentials
    set password_hash = ${newHash},
        must_reset_password = false,
        password_updated_at = now(),
        updated_at = now()
    where owner_type = 'USER'
      and owner_id = ${row.owner_id}::uuid
      and status = 'ACTIVE'
  `)

  await db.execute(sql`
    update auth_sessions
    set revoked_at = now()
    where owner_type = 'USER'
      and owner_id = ${row.owner_id}::uuid
      and id <> ${row.session_id}::uuid
      and revoked_at is null
  `)

  const session = await getPlatformSession(db, token)
  if (!session || session.ownerType !== "USER" || !session.user) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.")
  }

  return session
}

async function findCredential(
  db: DrizzleClient,
  identifier: string,
  ownerTypes?: PlatformOwnerType[],
): Promise<CredentialRow | null> {
  const normalized = identifier.trim().toLowerCase()
  const identifierType = identifier.includes("@") ? "EMAIL" : "USERNAME"
  const ownerFilter =
    ownerTypes?.length === 1
      ? sql`and owner_type = ${ownerTypes[0]}`
      : ownerTypes?.length
        ? sql`and owner_type in (${sql.join(
            ownerTypes.map((ownerType) => sql.raw(`'${ownerType}'`)),
            sql`, `,
          )})`
        : sql``

  const rows = await executeRows<CredentialRow>(db, sql`
    select id, owner_type, owner_id, login_identifier, identifier_type, password_hash, status, must_reset_password
    from auth_credentials
    where identifier_type = ${identifierType}
      and lower(login_identifier) = ${normalized}
      ${ownerFilter}
    limit 1
  `)

  return rows[0] ?? null
}

async function assertOwnerCanLogin(db: DrizzleClient, ownerType: PlatformOwnerType, ownerId: string) {
  if (ownerType === "USER") {
    const rows = await executeRows<{ status: string }>(db, sql`
      select status from users where id = ${ownerId}::uuid limit 1
    `)
    if (!rows[0] || rows[0].status !== "ACTIVE") throw invalidCredentialsError()
    return
  }

  const rows = await executeRows<{ status: string }>(db, sql`
    select status from contributors where id = ${ownerId}::uuid limit 1
  `)
  if (!rows[0] || rows[0].status === "DELETED") throw invalidCredentialsError()
}

async function createAuthSession(db: DrizzleClient, credential: CredentialRow, meta: RequestMeta) {
  const token = generatePlatformSessionToken()
  const tokenHash = await hashPlatformSessionToken(token)
  const expiresAt = new Date(Date.now() + FOTOCORP_SESSION_TTL_SECONDS * 1000)

  await db.execute(sql`
    insert into auth_sessions (
      credential_id, owner_type, owner_id, session_token_hash,
      expires_at, last_seen_at, ip_address, user_agent
    ) values (
      ${credential.id}::uuid,
      ${credential.owner_type},
      ${credential.owner_id}::uuid,
      ${tokenHash},
      ${expiresAt},
      now(),
      ${meta.ip},
      ${meta.userAgent}
    )
  `)

  await db.execute(sql`
    update auth_credentials
    set last_login_at = now(), updated_at = now()
    where id = ${credential.id}::uuid
  `)

  return { rawSessionToken: token, expiresAt }
}

async function loadUserPayload(db: DrizzleClient, userId: string): Promise<PlatformUserPayload> {
  const rows = await executeRows<{
    id: string
    email: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    role: string
    status: string
    is_subscriber: boolean
    subscription_status: string
  }>(db, sql`
    select id, email, username, display_name, avatar_url, role, status, is_subscriber, subscription_status
    from users where id = ${userId}::uuid limit 1
  `)

  const row = rows[0]
  if (!row) throw new AppError(404, "USER_NOT_FOUND", "User was not found.")

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    isSubscriber: row.is_subscriber,
    subscriptionStatus: row.subscription_status,
  }
}

async function loadContributorPayload(
  db: DrizzleClient,
  credential: CredentialRow,
): Promise<PlatformContributorPayload> {
  const rows = await executeRows<{
    id: string
    legacy_photographer_id: string | null
    display_name: string
    email: string | null
    status: string
  }>(db, sql`
    select id, legacy_photographer_id::text, display_name, email, status
    from contributors where id = ${credential.owner_id}::uuid limit 1
  `)

  const row = rows[0]
  if (!row) throw new AppError(404, "CONTRIBUTOR_NOT_FOUND", "Contributor was not found.")

  return {
    id: row.id,
    legacyPhotographerId: row.legacy_photographer_id ? Number(row.legacy_photographer_id) : null,
    displayName: row.display_name,
    email: row.email,
    status: row.status,
    username: credential.login_identifier,
    mustResetPassword: credential.must_reset_password,
    portalRole: "STANDARD",
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
