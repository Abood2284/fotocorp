import "server-only"

import { getPgPool } from "@/lib/db"

export const APP_ROLES = ["USER", "PHOTOGRAPHER", "ADMIN", "SUPER_ADMIN"] as const
export const APP_USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const
export const SUBSCRIPTION_STATUSES = ["NONE", "ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED"] as const

export type AppRole = (typeof APP_ROLES)[number]
export type AppUserStatus = (typeof APP_USER_STATUSES)[number]
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export interface AppUserProfile {
  id: string
  authUserId: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: AppRole
  status: AppUserStatus
  isSubscriber: boolean
  subscriptionStatus: SubscriptionStatus
  subscriptionPlanId: string | null
  subscriptionStartedAt: Date | null
  subscriptionEndsAt: Date | null
  downloadQuotaLimit: number | null
  downloadQuotaUsed: number
  createdAt: Date
  updatedAt: Date
}

export interface AuthUserProfileInput {
  id: string
  email: string
  name?: string | null
  image?: string | null
}

export async function upsertAppUserProfile(authUser: AuthUserProfileInput) {
  const profile = await getAppUserProfileById(authUser.id)
  if (!profile) return null

  if (
    authUser.name !== profile.displayName ||
    authUser.image !== profile.avatarUrl ||
    authUser.email !== profile.email
  ) {
    await getPgPool().query(
      `
        update users
        set
          email = $2,
          display_name = coalesce($3, display_name),
          avatar_url = coalesce($4, avatar_url),
          updated_at = now()
        where id = $1::uuid
      `,
      [authUser.id, authUser.email, authUser.name ?? null, authUser.image ?? null],
    )
    return getAppUserProfileById(authUser.id)
  }

  return profile
}

export async function upsertAppUserProfileByAuthUserId(authUserId: string) {
  return getAppUserProfileById(authUserId)
}

export async function listAppUsers() {
  const result = await getPgPool().query<UserRow>(
    `
      select
        id,
        email,
        display_name,
        avatar_url,
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
      order by created_at desc
    `,
  )

  return result.rows.map(mapAppUserProfile)
}

export async function updateAppUserRolePlaceholder() {
  throw new Error("Role updates are not implemented in this PR.")
}

export interface SubscriberEntitlementRow {
  id: string
  assetType: string
  allowedDownloads: number | null
  downloadsUsed: number
  qualityAccess: string
  status: string
  validFrom: Date | null
  validUntil: Date | null
}

export async function listSubscriberEntitlements(authUserId: string): Promise<SubscriberEntitlementRow[]> {
  const result = await getPgPool().query<{
    id: string
    asset_type: string
    allowed_downloads: number | null
    downloads_used: number
    quality_access: string
    status: string
    valid_from: Date | null
    valid_until: Date | null
  }>(
    `
      select
        id,
        asset_type,
        allowed_downloads,
        downloads_used,
        quality_access,
        status,
        valid_from,
        valid_until
      from subscriber_entitlements
      where user_id = $1::uuid
      order by
        case asset_type
          when 'IMAGE' then 1
          when 'VIDEO' then 2
          when 'CARICATURE' then 3
          else 4
        end,
        status,
        created_at
    `,
    [authUserId],
  )

  return result.rows.map((row) => ({
    id: row.id,
    assetType: row.asset_type,
    allowedDownloads: row.allowed_downloads,
    downloadsUsed: Number(row.downloads_used),
    qualityAccess: row.quality_access,
    status: row.status,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
  }))
}

export function isEntitlementCurrentlyValid(row: SubscriberEntitlementRow, now = new Date()): boolean {
  if (row.status !== "ACTIVE") return false
  if (row.validFrom && row.validFrom > now) return false
  if (row.validUntil && row.validUntil <= now) return false
  return true
}

export async function getActiveSubscriberEntitlementQuota(authUserId: string): Promise<{ used: number; limit: number } | null> {
  const result = await getPgPool().query<{
    total_used: number
    total_allowed: number
    row_count: number
  }>(
    `
      select
        coalesce(sum(downloads_used), 0)::int as total_used,
        coalesce(sum(allowed_downloads), 0)::int as total_allowed,
        count(*)::int as row_count
      from subscriber_entitlements
      where user_id = $1
        and status = 'ACTIVE'
        and allowed_downloads is not null
        and (valid_until is null or valid_until > now())
        and (valid_from is null or valid_from <= now())
    `,
    [authUserId],
  )

  const row = result.rows[0]
  if (!row || row.row_count === 0) return null

  return { used: Number(row.total_used), limit: Number(row.total_allowed) }
}

export function formatDownloadQuotaLabel(used: number, limit: number | null) {
  return `${used} / ${limit === null ? "Unlimited" : limit}`
}

async function getAppUserProfileById(userId: string) {
  const result = await getPgPool().query<UserRow>(
    `
      select
        id,
        email,
        display_name,
        avatar_url,
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
      where id = $1::uuid
      limit 1
    `,
    [userId],
  )

  const row = result.rows[0]
  if (!row) return null

  return mapAppUserProfile(row)
}

function mapAppUserProfile(row: UserRow): AppUserProfile {
  return {
    id: row.id,
    authUserId: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: normalizeAppRole(row.role, row.email),
    status: row.status as AppUserStatus,
    isSubscriber: row.is_subscriber,
    subscriptionStatus: row.subscription_status as SubscriptionStatus,
    subscriptionPlanId: row.subscription_plan_id,
    subscriptionStartedAt: row.subscription_started_at,
    subscriptionEndsAt: row.subscription_ends_at,
    downloadQuotaLimit: row.download_quota_limit,
    downloadQuotaUsed: row.download_quota_used,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeAppRole(role: string, email: string): AppRole {
  const superAdminEmail = process.env.FOTOCORP_SUPER_ADMIN_EMAIL?.trim().toLowerCase()
  if (superAdminEmail && email.trim().toLowerCase() === superAdminEmail) return "SUPER_ADMIN"
  if (role === "ADMIN" || role === "SUPER_ADMIN" || role === "USER") return role as AppRole
  return "USER"
}

interface UserRow {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role: string
  status: string
  is_subscriber: boolean
  subscription_status: string
  subscription_plan_id: string | null
  subscription_started_at: Date | null
  subscription_ends_at: Date | null
  download_quota_limit: number | null
  download_quota_used: number
  created_at: Date
  updated_at: Date
}
