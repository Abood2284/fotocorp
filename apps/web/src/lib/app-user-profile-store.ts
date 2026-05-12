import "server-only"

import { randomUUID } from "crypto"
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

let profileTablePromise: Promise<void> | null = null

export async function upsertAppUserProfile(authUser: AuthUserProfileInput) {
  await ensureAppUserProfilesTable()

  const bootstrapRole = getBootstrapRole(authUser.email)
  const result = await getPgPool().query<AppUserProfileRow>(
    `
      insert into app_user_profiles (
        id,
        auth_user_id,
        email,
        display_name,
        avatar_url,
        role,
        status
      )
      values ($1, $2, $3, $4, $5, $6, 'ACTIVE')
      on conflict (auth_user_id) do update
      set
        email = excluded.email,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        role = case
          when excluded.role = 'SUPER_ADMIN' then 'SUPER_ADMIN'
          else app_user_profiles.role
        end,
        updated_at = now()
      returning
        id,
        auth_user_id,
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
    `,
    [
      randomUUID(),
      authUser.id,
      authUser.email,
      authUser.name ?? null,
      authUser.image ?? null,
      bootstrapRole,
    ],
  )

  return mapAppUserProfile(result.rows[0])
}

export async function upsertAppUserProfileByAuthUserId(authUserId: string) {
  const result = await getPgPool().query<AuthUserRow>(
    `
      select id, email, name, image
      from "user"
      where id = $1
      limit 1
    `,
    [authUserId],
  )

  const authUser = result.rows[0]
  if (!authUser) return null

  return upsertAppUserProfile(authUser)
}

export async function listAppUsers() {
  await ensureAppUserProfilesTable()

  const result = await getPgPool().query<AppUserProfileRow>(
    `
      select
        id,
        auth_user_id,
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
      from app_user_profiles
      order by created_at desc
    `,
  )

  return result.rows.map(mapAppUserProfile)
}

export async function updateAppUserRolePlaceholder() {
  throw new Error("Role updates are not implemented in this PR.")
}

function getBootstrapRole(email: string): AppRole {
  const superAdminEmail = process.env.FOTOCORP_SUPER_ADMIN_EMAIL?.trim().toLowerCase()

  if (superAdminEmail && email.trim().toLowerCase() === superAdminEmail) {
    return "SUPER_ADMIN"
  }

  return "USER"
}

function ensureAppUserProfilesTable() {
  if (!profileTablePromise) {
    profileTablePromise = getPgPool()
      .query(`
        create extension if not exists pgcrypto;

        create table if not exists app_user_profiles (
          id uuid primary key default gen_random_uuid(),
          auth_user_id text not null unique references "user" ("id") on delete cascade,
          email text not null,
          display_name text,
          avatar_url text,
          role text not null default 'USER' check (role in ('USER', 'PHOTOGRAPHER', 'ADMIN', 'SUPER_ADMIN')),
          status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED')),
          is_subscriber boolean not null default false,
          subscription_status text not null default 'NONE' check (subscription_status in ('NONE', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED')),
          subscription_plan_id text,
          subscription_started_at timestamptz,
          subscription_ends_at timestamptz,
          download_quota_limit integer,
          download_quota_used integer not null default 0 check (download_quota_used >= 0),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        alter table app_user_profiles add column if not exists is_subscriber boolean default false;
        update app_user_profiles set is_subscriber = false where is_subscriber is null;
        alter table app_user_profiles alter column is_subscriber set default false;
        alter table app_user_profiles alter column is_subscriber set not null;

        alter table app_user_profiles add column if not exists subscription_status text default 'NONE';
        update app_user_profiles set subscription_status = 'NONE' where subscription_status is null;
        alter table app_user_profiles alter column subscription_status set default 'NONE';
        alter table app_user_profiles alter column subscription_status set not null;

        alter table app_user_profiles add column if not exists subscription_plan_id text;
        alter table app_user_profiles add column if not exists subscription_started_at timestamptz;
        alter table app_user_profiles add column if not exists subscription_ends_at timestamptz;
        alter table app_user_profiles add column if not exists download_quota_limit integer;
        alter table app_user_profiles add column if not exists download_quota_used integer default 0;
        update app_user_profiles set download_quota_used = 0 where download_quota_used is null;
        alter table app_user_profiles alter column download_quota_used set default 0;
        alter table app_user_profiles alter column download_quota_used set not null;

        do $$
        begin
          if not exists (
            select 1 from pg_constraint
            where conname = 'app_user_profiles_subscription_status_check'
              and conrelid = 'app_user_profiles'::regclass
          ) then
            alter table app_user_profiles
              add constraint app_user_profiles_subscription_status_check
              check (subscription_status in ('NONE', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'));
          end if;
        end $$;

        do $$
        begin
          if not exists (
            select 1 from pg_constraint
            where conname = 'app_user_profiles_download_quota_used_check'
              and conrelid = 'app_user_profiles'::regclass
          ) then
            alter table app_user_profiles
              add constraint app_user_profiles_download_quota_used_check
              check (download_quota_used >= 0);
          end if;
        end $$;

        create index if not exists app_user_profiles_email_idx on app_user_profiles (lower(email));
        create index if not exists app_user_profiles_role_idx on app_user_profiles (role);
        create index if not exists app_user_profiles_status_idx on app_user_profiles (status);
        create index if not exists app_user_profiles_subscription_status_idx on app_user_profiles (subscription_status);
        create index if not exists app_user_profiles_is_subscriber_idx on app_user_profiles (is_subscriber);
      `)
      .then(() => undefined)
      .catch((error) => {
        profileTablePromise = null
        throw error
      })
  }

  return profileTablePromise
}

function mapAppUserProfile(row: AppUserProfileRow): AppUserProfile {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    isSubscriber: row.is_subscriber,
    subscriptionStatus: row.subscription_status,
    subscriptionPlanId: row.subscription_plan_id,
    subscriptionStartedAt: row.subscription_started_at,
    subscriptionEndsAt: row.subscription_ends_at,
    downloadQuotaLimit: row.download_quota_limit,
    downloadQuotaUsed: row.download_quota_used,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

interface AuthUserRow {
  id: string
  email: string
  name: string | null
  image: string | null
}

interface AppUserProfileRow {
  id: string
  auth_user_id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role: AppRole
  status: AppUserStatus
  is_subscriber: boolean
  subscription_status: SubscriptionStatus
  subscription_plan_id: string | null
  subscription_started_at: Date | null
  subscription_ends_at: Date | null
  download_quota_limit: number | null
  download_quota_used: number
  created_at: Date
  updated_at: Date
}
