create extension if not exists pgcrypto;

create table if not exists app_user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null unique references "user" ("id") on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role text not null default 'USER' check (role in ('USER', 'PHOTOGRAPHER', 'ADMIN', 'SUPER_ADMIN')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_user_profiles_email_idx on app_user_profiles (lower(email));
create index if not exists app_user_profiles_role_idx on app_user_profiles (role);
create index if not exists app_user_profiles_status_idx on app_user_profiles (status);
