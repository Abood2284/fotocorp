create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_user_profiles'
      and column_name = 'id'
      and data_type = 'text'
  ) then
    alter table app_user_profiles
      alter column id drop default,
      alter column id type uuid using id::uuid,
      alter column id set default gen_random_uuid();
  end if;
end $$;

create table if not exists asset_categories (
  id uuid primary key default gen_random_uuid(),
  legacy_category_code integer unique,
  name text not null,
  parent_legacy_category_code integer,
  include_file text,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists asset_events (
  id uuid primary key default gen_random_uuid(),
  legacy_event_id bigint unique,
  name text,
  event_date timestamptz,
  country text,
  state text,
  city text,
  location text,
  keywords text,
  photo_count bigint,
  photo_count_unpublished bigint,
  small_image_1 text,
  small_image_2 text,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists photographer_profiles (
  id uuid primary key default gen_random_uuid(),
  legacy_photographer_id bigint unique,
  display_name text not null,
  email text,
  phone text,
  city text,
  state text,
  country text,
  profile_source text not null default 'LEGACY_IMPORT'
    check (profile_source in ('LEGACY_IMPORT', 'ADMIN_CREATED', 'SELF_REGISTERED')),
  status text not null default 'LEGACY_ONLY'
    check (status in ('LEGACY_ONLY', 'ACTIVE', 'INACTIVE', 'BLOCKED')),
  app_user_profile_id uuid null references app_user_profiles(id) on delete set null,
  linked_at timestamptz,
  linked_by_app_user_profile_id uuid null references app_user_profiles(id) on delete set null,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  legacy_source text not null default 'fotocorp_images',
  legacy_srno bigint,
  legacy_event_id bigint,
  legacy_imagecode text not null,
  r2_original_key text,
  original_filename text,
  original_ext text,
  r2_exists boolean not null default false,
  r2_checked_at timestamptz,
  title text,
  caption text,
  headline text,
  keywords text,
  event_keywords text,
  image_location text,
  search_text text,
  image_date timestamptz,
  uploaded_at timestamptz,
  legacy_status integer,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'REVIEW', 'APPROVED', 'READY', 'PUBLISHED', 'ARCHIVED', 'REJECTED')),
  visibility text not null default 'PRIVATE'
    check (visibility in ('PRIVATE', 'PUBLIC', 'UNLISTED')),
  media_type text not null default 'IMAGE'
    check (media_type in ('IMAGE', 'VIDEO', 'OTHER')),
  source text not null default 'LEGACY_IMPORT'
    check (source in ('LEGACY_IMPORT', 'ADMIN_UPLOAD', 'PHOTOGRAPHER_UPLOAD')),
  category_id uuid null references asset_categories(id) on delete set null,
  photographer_profile_id uuid null references photographer_profiles(id) on delete set null,
  event_id uuid null references asset_events(id) on delete set null,
  uploaded_by_app_user_profile_id uuid null references app_user_profiles(id) on delete set null,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legacy_source, legacy_srno)
);

create table if not exists asset_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_table text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_rows bigint not null default 0,
  inserted_rows bigint not null default 0,
  updated_rows bigint not null default 0,
  r2_matched_rows bigint not null default 0,
  r2_missing_rows bigint not null default 0,
  duplicate_imagecode_rows bigint not null default 0,
  failed_rows bigint not null default 0,
  status text not null default 'RUNNING'
    check (status in ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_ISSUES', 'FAILED', 'CANCELLED')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists asset_import_issues (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references asset_import_batches(id) on delete cascade,
  legacy_source text not null,
  legacy_srno bigint,
  legacy_imagecode text,
  issue_type text not null
    check (issue_type in (
      'MISSING_R2_OBJECT',
      'DUPLICATE_IMAGECODE',
      'MISSING_EVENT',
      'MISSING_CATEGORY',
      'MISSING_PHOTOGRAPHER',
      'INVALID_DATE',
      'UNKNOWN_STATUS',
      'IMPORT_ERROR'
    )),
  severity text not null default 'WARNING'
    check (severity in ('INFO', 'WARNING', 'ERROR')),
  message text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists assets_legacy_imagecode_idx on assets (legacy_imagecode);
create index if not exists assets_r2_original_key_idx on assets (r2_original_key);
create index if not exists assets_r2_exists_idx on assets (r2_exists);
create index if not exists assets_status_idx on assets (status);
create index if not exists assets_visibility_idx on assets (visibility);
create index if not exists assets_source_idx on assets (source);
create index if not exists assets_legacy_status_idx on assets (legacy_status);
create index if not exists assets_event_id_idx on assets (event_id);
create index if not exists assets_category_id_idx on assets (category_id);
create index if not exists assets_photographer_profile_id_idx on assets (photographer_profile_id);
create index if not exists assets_image_date_idx on assets (image_date);
create index if not exists assets_uploaded_at_idx on assets (uploaded_at);

create index if not exists photographer_profiles_app_user_profile_id_idx on photographer_profiles (app_user_profile_id);
create index if not exists photographer_profiles_status_idx on photographer_profiles (status);
create index if not exists photographer_profiles_profile_source_idx on photographer_profiles (profile_source);

create index if not exists asset_events_legacy_event_id_idx on asset_events (legacy_event_id);
create index if not exists asset_events_event_date_idx on asset_events (event_date);

create index if not exists asset_categories_parent_legacy_category_code_idx
  on asset_categories (parent_legacy_category_code);

create index if not exists asset_import_batches_status_idx on asset_import_batches (status);
create index if not exists asset_import_batches_source_table_idx on asset_import_batches (source_table);
create index if not exists asset_import_issues_batch_id_idx on asset_import_issues (batch_id);
create index if not exists asset_import_issues_issue_type_idx on asset_import_issues (issue_type);
create index if not exists asset_import_issues_legacy_imagecode_idx on asset_import_issues (legacy_imagecode);
