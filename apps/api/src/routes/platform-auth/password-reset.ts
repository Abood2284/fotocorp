import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import type { Env } from "../../appTypes"
import {
  generatePlatformSessionToken,
  hashPlatformSessionToken,
} from "../../lib/auth/platform-session"
import {
  hashPhotographerPortalPassword,
  validatePhotographerPortalPasswordStrength,
} from "../../lib/auth/contributor-password"
import { safeSendAccessInquiryEmail, resolvePasswordResetUrl } from "../../lib/email/email-service"
import { AppError } from "../../lib/errors"

const PASSWORD_RESET_TTL_MINUTES = 60
const MAX_RESET_REQUESTS_PER_USER_PER_HOUR = 5
const MAX_RESET_REQUESTS_PER_IP_PER_HOUR = 20

export const PASSWORD_RESET_GENERIC_MESSAGE =
  "If an account exists for that email, we sent password reset instructions."

interface RequestMeta {
  ip: string | null
}

export async function requestPlatformPasswordReset(
  db: DrizzleClient,
  env: Env,
  input: { email: string },
  meta: RequestMeta,
): Promise<{ message: string }> {
  const email = input.email.trim().toLowerCase()
  if (!email) return { message: PASSWORD_RESET_GENERIC_MESSAGE }

  const rows = await executeRows<{
    user_id: string
    email: string
    first_name: string
    display_name: string | null
  }>(db, sql`
    select
      u.id as user_id,
      u.email,
      u.first_name,
      u.display_name
    from auth_credentials c
    join users u on u.id = c.owner_id
    where c.owner_type = 'USER'
      and c.identifier_type = 'EMAIL'
      and lower(c.login_identifier) = ${email}
      and c.status = 'ACTIVE'
      and u.status = 'ACTIVE'
    limit 1
  `)

  const user = rows[0]
  if (!user) return { message: PASSWORD_RESET_GENERIC_MESSAGE }

  if (await isPasswordResetRateLimited(db, user.user_id, meta.ip)) {
    return { message: PASSWORD_RESET_GENERIC_MESSAGE }
  }

  const rawToken = generatePlatformSessionToken()
  const tokenHash = await hashPlatformSessionToken(rawToken)
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000)

  await db.execute(sql`
    update password_reset_tokens
    set used_at = now()
    where user_id = ${user.user_id}::uuid
      and used_at is null
  `)

  const inserted = await executeRows<{ id: string }>(db, sql`
    insert into password_reset_tokens (user_id, token_hash, expires_at, requested_ip)
    values (${user.user_id}::uuid, ${tokenHash}, ${expiresAt}, ${meta.ip})
    returning id
  `)

  const tokenId = inserted[0]?.id
  if (!tokenId) return { message: PASSWORD_RESET_GENERIC_MESSAGE }

  const resetUrl = resolvePasswordResetUrl(env, rawToken)

  await safeSendAccessInquiryEmail(db, env, {
    templateKey: "CUSTOMER_PASSWORD_RESET",
    recipient: {
      email: user.email,
      firstName: user.first_name,
      displayName: user.display_name,
    },
    relatedEntity: { type: "password_reset", id: tokenId },
    data: {
      resetPasswordUrl: resetUrl,
      resetLinkExpiresMinutes: PASSWORD_RESET_TTL_MINUTES,
    },
  })

  return { message: PASSWORD_RESET_GENERIC_MESSAGE }
}

export async function validatePlatformPasswordResetToken(
  db: DrizzleClient,
  rawToken: string | undefined,
): Promise<{ ok: true }> {
  const row = await findActivePasswordResetToken(db, rawToken)
  if (!row) {
    throw new AppError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or has expired.")
  }
  return { ok: true }
}

export async function completePlatformPasswordReset(
  db: DrizzleClient,
  input: { token: string; newPassword: string },
): Promise<{ ok: true; message: string }> {
  const row = await findActivePasswordResetToken(db, input.token)
  if (!row) {
    throw new AppError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or has expired.")
  }

  const strengthError = validatePhotographerPortalPasswordStrength(input.newPassword)
  if (strengthError) throw new AppError(400, "WEAK_PASSWORD", strengthError)

  const newHash = await hashPhotographerPortalPassword(input.newPassword)

  await db.execute(sql`
    update auth_credentials
    set password_hash = ${newHash},
        must_reset_password = false,
        password_updated_at = now(),
        updated_at = now()
    where owner_type = 'USER'
      and owner_id = ${row.user_id}::uuid
      and status = 'ACTIVE'
  `)

  await db.execute(sql`
    update password_reset_tokens
    set used_at = now()
    where id = ${row.id}::uuid
  `)

  await db.execute(sql`
    update auth_sessions
    set revoked_at = now()
    where owner_type = 'USER'
      and owner_id = ${row.user_id}::uuid
      and revoked_at is null
  `)

  return {
    ok: true,
    message: "Your password has been reset. Sign in with your new password.",
  }
}

async function findActivePasswordResetToken(db: DrizzleClient, rawToken: string | undefined) {
  const trimmed = rawToken?.trim()
  if (!trimmed) return null

  const tokenHash = await hashPlatformSessionToken(trimmed)
  const rows = await executeRows<{ id: string; user_id: string }>(db, sql`
    select t.id, t.user_id
    from password_reset_tokens t
    where t.token_hash = ${tokenHash}
      and t.used_at is null
      and t.expires_at > now()
    limit 1
  `)

  const row = rows[0]
  if (!row) return null

  return { id: row.id, user_id: row.user_id }
}

async function isPasswordResetRateLimited(
  db: DrizzleClient,
  userId: string,
  ip: string | null,
): Promise<boolean> {
  const userRows = await executeRows<{ count: number }>(db, sql`
    select count(*)::int as count
    from password_reset_tokens
    where user_id = ${userId}::uuid
      and created_at > now() - interval '1 hour'
  `)
  if ((userRows[0]?.count ?? 0) >= MAX_RESET_REQUESTS_PER_USER_PER_HOUR) return true

  if (!ip?.trim()) return false

  const ipRows = await executeRows<{ count: number }>(db, sql`
    select count(*)::int as count
    from password_reset_tokens
    where requested_ip = ${ip.trim()}
      and created_at > now() - interval '1 hour'
  `)
  return (ipRows[0]?.count ?? 0) >= MAX_RESET_REQUESTS_PER_IP_PER_HOUR
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[]
  }
  return []
}
