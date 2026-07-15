import { sql } from "drizzle-orm"
import type { DrizzleClient } from "../../../db"
import { AppError } from "../../../lib/errors"
import {
  decodeStaffProductivityActivityCursor,
  encodeStaffProductivityActivityCursor,
  type StaffProductivityActivityQuery,
  type StaffProductivityExportQuery,
  type StaffProductivityQuery,
} from "./validators"

export interface StaffProductivityFieldSaves {
  caption: number
  whoIsInPicture: number
  keywords: number
  headline: number
  description: number
}

export interface StaffProductivitySummary {
  uniqueAssetsTouched: number
  saves: number
  fieldSaves: StaffProductivityFieldSaves
  uploadsApproved: number
  uploadsRejected: number
  activeStaffCount: number
}

export interface StaffProductivityMember {
  staffMemberId: string
  displayName: string
  username: string | null
  role: string
  status: string
  uniqueAssetsTouched: number
  saves: number
  fieldSaves: StaffProductivityFieldSaves
  uniqueAssetsByField: StaffProductivityFieldSaves
  uploadsApproved: number
  uploadsRejected: number
  lastActivityAt: string | null
}

export interface StaffProductivityActivityDay {
  date: string
  uniqueAssetsTouched: number
  saves: number
  fieldSaves: StaffProductivityFieldSaves
}

export interface StaffProductivityDefinitions {
  uniqueAssetsTouched: string
  saves: string
  fieldSaves: string
  uniqueAssetsByField: string
  reliableFrom: string
}

export interface StaffProductivityResult {
  summary: StaffProductivitySummary
  members: StaffProductivityMember[]
  activityByDay: StaffProductivityActivityDay[]
  definitions: StaffProductivityDefinitions
}

interface StaffProductivityRow {
  staff_member_id: string
  display_name: string
  username: string | null
  role: string
  status: string
  unique_assets_touched: number | string | null
  saves: number | string | null
  caption_saves: number | string | null
  who_saves: number | string | null
  keywords_saves: number | string | null
  headline_saves: number | string | null
  description_saves: number | string | null
  unique_caption: number | string | null
  unique_who: number | string | null
  unique_keywords: number | string | null
  unique_headline: number | string | null
  unique_description: number | string | null
  uploads_approved: number | string | null
  uploads_rejected: number | string | null
  last_activity_at: Date | string | null
}

interface ActivityDayRow {
  day: Date | string
  unique_assets_touched: number | string | null
  saves: number | string | null
  caption_saves: number | string | null
  who_saves: number | string | null
  keywords_saves: number | string | null
  headline_saves: number | string | null
  description_saves: number | string | null
}

interface TeamUniqueRow {
  unique_assets_touched: number | string | null
}

export const STAFF_PRODUCTIVITY_DEFINITIONS: StaffProductivityDefinitions = {
  uniqueAssetsTouched:
    "Distinct assets where at least one tracked metadata field changed in the selected range (primary KPI).",
  saves: "Save events that changed at least one tracked metadata field. Editing the same asset twice counts as two saves.",
  fieldSaves:
    "Save events that changed that specific field (caption, who-is-in-picture, keywords, headline, description).",
  uniqueAssetsByField: "Distinct assets that had that specific field changed in the selected range.",
  reliableFrom:
    "Catalog/captions audit reliability from ~2026-04-30; contributor-upload review audits from ~2026-06-10; staff upload-wizard metadata audits from deploy of this revision.",
}

export async function getStaffProductivity(
  db: DrizzleClient,
  query: StaffProductivityQuery,
): Promise<StaffProductivityResult> {
  const from = query.from ?? null
  const to = query.to ?? null

  const membersResult = await db.execute(sql`
    with metadata_events as (
      select
        l.actor_auth_user_id as staff_member_id,
        l.asset_id::text as asset_id,
        l.created_at,
        (l.after ? 'caption') as ch_caption,
        (l.after ? 'who_is_in_picture') as ch_who,
        (l.after ? 'keywords') as ch_keywords,
        (l.after ? 'headline') as ch_headline,
        (l.after ? 'description') as ch_description
      from asset_admin_audit_logs l
      where l.actor_auth_user_id is not null
        and l.action = 'ASSET_METADATA_UPDATED'
        and l.after is not null
        and l.after <> '{}'::jsonb
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)

      union all

      select
        l.staff_account_id::text as staff_member_id,
        l.entity_id as asset_id,
        l.created_at,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'caption'
        ) as ch_caption,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'whoIsInPicture'
        ) as ch_who,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'keywords'
        ) as ch_keywords,
        false as ch_headline,
        false as ch_description
      from staff_audit_logs l
      where l.staff_account_id is not null
        and l.action = 'CONTRIBUTOR_UPLOAD_METADATA_SAVED'
        and jsonb_array_length(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) > 0
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)
    ),
    upload_actions as (
      select
        l.staff_account_id::text as staff_member_id,
        sum(
          case
            when l.action = 'CONTRIBUTOR_UPLOAD_APPROVED'
              then coalesce((l.metadata_json->>'approvedCount')::int, 0)
            else 0
          end
        )::int as uploads_approved,
        sum(
          case
            when l.action = 'CONTRIBUTOR_UPLOAD_REJECTED'
              then coalesce((l.metadata_json->>'rejectedCount')::int, 0)
            else 0
          end
        )::int as uploads_rejected,
        max(l.created_at) as last_upload_activity_at
      from staff_audit_logs l
      where l.staff_account_id is not null
        and l.action in ('CONTRIBUTOR_UPLOAD_APPROVED', 'CONTRIBUTOR_UPLOAD_REJECTED')
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)
      group by l.staff_account_id
    ),
    metadata_counts as (
      select
        staff_member_id,
        count(*)::int as saves,
        count(distinct asset_id)::int as unique_assets_touched,
        count(*) filter (where ch_caption)::int as caption_saves,
        count(*) filter (where ch_who)::int as who_saves,
        count(*) filter (where ch_keywords)::int as keywords_saves,
        count(*) filter (where ch_headline)::int as headline_saves,
        count(*) filter (where ch_description)::int as description_saves,
        count(distinct asset_id) filter (where ch_caption)::int as unique_caption,
        count(distinct asset_id) filter (where ch_who)::int as unique_who,
        count(distinct asset_id) filter (where ch_keywords)::int as unique_keywords,
        count(distinct asset_id) filter (where ch_headline)::int as unique_headline,
        count(distinct asset_id) filter (where ch_description)::int as unique_description,
        max(created_at) as last_metadata_at
      from metadata_events
      group by staff_member_id
    ),
    staff_activity as (
      select staff_member_id, created_at from metadata_events
      union all
      select staff_member_id, last_upload_activity_at as created_at from upload_actions
    ),
    last_activity as (
      select staff_member_id, max(created_at) as last_activity_at
      from staff_activity
      where created_at is not null
      group by staff_member_id
    )
    select
      sm.id::text as staff_member_id,
      sm.display_name,
      ac.login_identifier as username,
      sm.role,
      sm.status,
      coalesce(mc.unique_assets_touched, 0)::int as unique_assets_touched,
      coalesce(mc.saves, 0)::int as saves,
      coalesce(mc.caption_saves, 0)::int as caption_saves,
      coalesce(mc.who_saves, 0)::int as who_saves,
      coalesce(mc.keywords_saves, 0)::int as keywords_saves,
      coalesce(mc.headline_saves, 0)::int as headline_saves,
      coalesce(mc.description_saves, 0)::int as description_saves,
      coalesce(mc.unique_caption, 0)::int as unique_caption,
      coalesce(mc.unique_who, 0)::int as unique_who,
      coalesce(mc.unique_keywords, 0)::int as unique_keywords,
      coalesce(mc.unique_headline, 0)::int as unique_headline,
      coalesce(mc.unique_description, 0)::int as unique_description,
      coalesce(ua.uploads_approved, 0)::int as uploads_approved,
      coalesce(ua.uploads_rejected, 0)::int as uploads_rejected,
      la.last_activity_at
    from staff_members sm
    left join auth_credentials ac
      on ac.owner_id = sm.id
      and ac.owner_type = 'STAFF'
      and ac.identifier_type = 'USERNAME'
    left join metadata_counts mc on mc.staff_member_id = sm.id::text
    left join upload_actions ua on ua.staff_member_id = sm.id::text
    left join last_activity la on la.staff_member_id = sm.id::text
    where sm.role = 'CAPTION_WRITER'
      or exists (
        select 1
        from staff_activity a
        where a.staff_member_id = sm.id::text
      )
    order by
      coalesce(mc.unique_assets_touched, 0) desc,
      coalesce(la.last_activity_at, 'epoch'::timestamptz) desc,
      lower(sm.display_name) asc
  `)

  const teamUniqueResult = await db.execute(sql`
    with metadata_events as (
      select l.asset_id::text as asset_id
      from asset_admin_audit_logs l
      where l.actor_auth_user_id is not null
        and l.action = 'ASSET_METADATA_UPDATED'
        and l.after is not null
        and l.after <> '{}'::jsonb
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)

      union

      select l.entity_id as asset_id
      from staff_audit_logs l
      where l.staff_account_id is not null
        and l.action = 'CONTRIBUTOR_UPLOAD_METADATA_SAVED'
        and jsonb_array_length(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) > 0
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)
    )
    select count(distinct asset_id)::int as unique_assets_touched
    from metadata_events
  `)

  const activityResult = await db.execute(sql`
    with metadata_events as (
      select
        l.asset_id::text as asset_id,
        l.created_at,
        (l.after ? 'caption') as ch_caption,
        (l.after ? 'who_is_in_picture') as ch_who,
        (l.after ? 'keywords') as ch_keywords,
        (l.after ? 'headline') as ch_headline,
        (l.after ? 'description') as ch_description
      from asset_admin_audit_logs l
      where l.actor_auth_user_id is not null
        and l.action = 'ASSET_METADATA_UPDATED'
        and l.after is not null
        and l.after <> '{}'::jsonb
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)

      union all

      select
        l.entity_id as asset_id,
        l.created_at,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'caption'
        ) as ch_caption,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'whoIsInPicture'
        ) as ch_who,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'keywords'
        ) as ch_keywords,
        false as ch_headline,
        false as ch_description
      from staff_audit_logs l
      where l.staff_account_id is not null
        and l.action = 'CONTRIBUTOR_UPLOAD_METADATA_SAVED'
        and jsonb_array_length(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) > 0
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)
    )
    select
      (created_at at time zone 'UTC')::date as day,
      count(distinct asset_id)::int as unique_assets_touched,
      count(*)::int as saves,
      count(*) filter (where ch_caption)::int as caption_saves,
      count(*) filter (where ch_who)::int as who_saves,
      count(*) filter (where ch_keywords)::int as keywords_saves,
      count(*) filter (where ch_headline)::int as headline_saves,
      count(*) filter (where ch_description)::int as description_saves
    from metadata_events
    group by 1
    order by 1 asc
  `)

  const members = readRows<StaffProductivityRow>(membersResult).map(serializeMember)
  const teamUnique = toNumber(readRows<TeamUniqueRow>(teamUniqueResult)[0]?.unique_assets_touched)
  const activityByDay = readRows<ActivityDayRow>(activityResult).map(serializeActivityDay)

  return {
    summary: {
      uniqueAssetsTouched: teamUnique,
      saves: sum(members, (member) => member.saves),
      fieldSaves: {
        caption: sum(members, (member) => member.fieldSaves.caption),
        whoIsInPicture: sum(members, (member) => member.fieldSaves.whoIsInPicture),
        keywords: sum(members, (member) => member.fieldSaves.keywords),
        headline: sum(members, (member) => member.fieldSaves.headline),
        description: sum(members, (member) => member.fieldSaves.description),
      },
      uploadsApproved: sum(members, (member) => member.uploadsApproved),
      uploadsRejected: sum(members, (member) => member.uploadsRejected),
      activeStaffCount: members.filter((member) => member.lastActivityAt !== null).length,
    },
    members,
    activityByDay,
    definitions: STAFF_PRODUCTIVITY_DEFINITIONS,
  }
}

function serializeMember(row: StaffProductivityRow): StaffProductivityMember {
  return {
    staffMemberId: row.staff_member_id,
    displayName: row.display_name,
    username: row.username,
    role: row.role,
    status: row.status,
    uniqueAssetsTouched: toNumber(row.unique_assets_touched),
    saves: toNumber(row.saves),
    fieldSaves: {
      caption: toNumber(row.caption_saves),
      whoIsInPicture: toNumber(row.who_saves),
      keywords: toNumber(row.keywords_saves),
      headline: toNumber(row.headline_saves),
      description: toNumber(row.description_saves),
    },
    uniqueAssetsByField: {
      caption: toNumber(row.unique_caption),
      whoIsInPicture: toNumber(row.unique_who),
      keywords: toNumber(row.unique_keywords),
      headline: toNumber(row.unique_headline),
      description: toNumber(row.unique_description),
    },
    uploadsApproved: toNumber(row.uploads_approved),
    uploadsRejected: toNumber(row.uploads_rejected),
    lastActivityAt: toIso(row.last_activity_at),
  }
}

function serializeActivityDay(row: ActivityDayRow): StaffProductivityActivityDay {
  return {
    date: toDateOnly(row.day),
    uniqueAssetsTouched: toNumber(row.unique_assets_touched),
    saves: toNumber(row.saves),
    fieldSaves: {
      caption: toNumber(row.caption_saves),
      whoIsInPicture: toNumber(row.who_saves),
      keywords: toNumber(row.keywords_saves),
      headline: toNumber(row.headline_saves),
      description: toNumber(row.description_saves),
    },
  }
}

function sum(members: StaffProductivityMember[], pick: (member: StaffProductivityMember) => number) {
  return members.reduce((total, member) => total + pick(member), 0)
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

function toDateOnly(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const raw = String(value)
  return raw.length >= 10 ? raw.slice(0, 10) : raw
}

function readRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown[] }).rows)) {
    return (result as { rows: T[] }).rows
  }
  return []
}

export interface StaffProductivityDetailResult {
  member: StaffProductivityMember
  activityByDay: StaffProductivityActivityDay[]
  definitions: StaffProductivityDefinitions
}

export interface StaffProductivityActivityItem {
  id: string
  source: "asset" | "staff"
  createdAt: string
  action: string
  assetId: string | null
  assetLabel: string | null
  changedFields: string[]
  summary: string
  entityHref: string | null
}

export interface StaffProductivityActivityResult {
  items: StaffProductivityActivityItem[]
  nextCursor: string | null
}

interface ActivityLogRow {
  source: "asset" | "staff"
  log_id: string
  created_at: Date | string
  action: string
  asset_id: string | null
  after_payload: Record<string, unknown> | null
  changed_fields: unknown
  approved_count: number | string | null
  rejected_count: number | string | null
}

export async function getStaffProductivityDetail(
  db: DrizzleClient,
  staffMemberId: string,
  query: StaffProductivityQuery,
): Promise<StaffProductivityDetailResult> {
  const member = await loadStaffMemberMetrics(db, staffMemberId, query)
  if (!member) {
    throw new AppError(404, "STAFF_MEMBER_NOT_FOUND", "Staff member was not found.")
  }

  const from = query.from ?? null
  const to = query.to ?? null
  const activityResult = await db.execute(sql`
    with metadata_events as (
      select
        l.asset_id::text as asset_id,
        l.created_at,
        (l.after ? 'caption') as ch_caption,
        (l.after ? 'who_is_in_picture') as ch_who,
        (l.after ? 'keywords') as ch_keywords,
        (l.after ? 'headline') as ch_headline,
        (l.after ? 'description') as ch_description
      from asset_admin_audit_logs l
      where l.actor_auth_user_id = ${staffMemberId}
        and l.action = 'ASSET_METADATA_UPDATED'
        and l.after is not null
        and l.after <> '{}'::jsonb
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)

      union all

      select
        l.entity_id as asset_id,
        l.created_at,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'caption'
        ) as ch_caption,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'whoIsInPicture'
        ) as ch_who,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'keywords'
        ) as ch_keywords,
        false as ch_headline,
        false as ch_description
      from staff_audit_logs l
      where l.staff_account_id = ${staffMemberId}::uuid
        and l.action = 'CONTRIBUTOR_UPLOAD_METADATA_SAVED'
        and jsonb_array_length(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) > 0
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)
    )
    select
      (created_at at time zone 'UTC')::date as day,
      count(distinct asset_id)::int as unique_assets_touched,
      count(*)::int as saves,
      count(*) filter (where ch_caption)::int as caption_saves,
      count(*) filter (where ch_who)::int as who_saves,
      count(*) filter (where ch_keywords)::int as keywords_saves,
      count(*) filter (where ch_headline)::int as headline_saves,
      count(*) filter (where ch_description)::int as description_saves
    from metadata_events
    group by 1
    order by 1 asc
  `)

  return {
    member,
    activityByDay: readRows<ActivityDayRow>(activityResult).map(serializeActivityDay),
    definitions: STAFF_PRODUCTIVITY_DEFINITIONS,
  }
}

export async function listStaffProductivityActivity(
  db: DrizzleClient,
  staffMemberId: string,
  query: StaffProductivityActivityQuery,
): Promise<StaffProductivityActivityResult> {
  const memberExists = await staffMemberExists(db, staffMemberId)
  if (!memberExists) {
    throw new AppError(404, "STAFF_MEMBER_NOT_FOUND", "Staff member was not found.")
  }

  const from = query.from ?? null
  const to = query.to ?? null
  const cursor = query.cursor ? decodeStaffProductivityActivityCursor(query.cursor) : null
  if (query.cursor && !cursor) {
    throw new AppError(400, "INVALID_CURSOR", "Activity cursor is invalid.")
  }

  const cursorClause = cursor
    ? sql`and (
        u.created_at < ${cursor.createdAt}::timestamptz
        or (u.created_at = ${cursor.createdAt}::timestamptz and u.log_id < ${cursor.id})
      )`
    : sql``

  const fetchLimit = query.limit + 1
  const result = await db.execute(sql`
    with unified as (
      select
        'asset'::text as source,
        l.id::text as log_id,
        l.created_at,
        l.action,
        l.asset_id::text as asset_id,
        l.after as after_payload,
        null::jsonb as changed_fields,
        null::int as approved_count,
        null::int as rejected_count
      from asset_admin_audit_logs l
      where l.actor_auth_user_id = ${staffMemberId}
        and l.action = 'ASSET_METADATA_UPDATED'
        and l.after is not null
        and l.after <> '{}'::jsonb
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)

      union all

      select
        'staff'::text as source,
        l.id::text as log_id,
        l.created_at,
        l.action,
        l.entity_id as asset_id,
        null::jsonb as after_payload,
        coalesce(l.metadata_json->'changedFields', '[]'::jsonb) as changed_fields,
        case
          when l.action = 'CONTRIBUTOR_UPLOAD_APPROVED'
            then coalesce((l.metadata_json->>'approvedCount')::int, 0)
          else null
        end as approved_count,
        case
          when l.action = 'CONTRIBUTOR_UPLOAD_REJECTED'
            then coalesce((l.metadata_json->>'rejectedCount')::int, 0)
          else null
        end as rejected_count
      from staff_audit_logs l
      where l.staff_account_id = ${staffMemberId}::uuid
        and l.action in (
          'CONTRIBUTOR_UPLOAD_METADATA_SAVED',
          'CONTRIBUTOR_UPLOAD_APPROVED',
          'CONTRIBUTOR_UPLOAD_REJECTED'
        )
        and (
          l.action in ('CONTRIBUTOR_UPLOAD_APPROVED', 'CONTRIBUTOR_UPLOAD_REJECTED')
          or jsonb_array_length(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) > 0
        )
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)
    )
    select *
    from unified u
    where true
      ${cursorClause}
    order by u.created_at desc, u.log_id desc
    limit ${fetchLimit}
  `)

  const rows = readRows<ActivityLogRow>(result)
  const hasMore = rows.length > query.limit
  const page = hasMore ? rows.slice(0, query.limit) : rows
  const labelByAssetId = await loadAssetLabels(
    db,
    page.map((row) => row.asset_id).filter((value): value is string => Boolean(value)),
  )
  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeStaffProductivityActivityCursor({
          createdAt: toIso(last.created_at) ?? "",
          id: last.log_id,
        })
      : null

  return {
    items: page.map((row) =>
      serializeActivityItem(row, row.asset_id ? labelByAssetId.get(row.asset_id) ?? null : null),
    ),
    nextCursor,
  }
}

export async function exportStaffProductivityActivityCsv(
  db: DrizzleClient,
  staffMemberId: string,
  query: StaffProductivityExportQuery,
): Promise<string> {
  const result = await listStaffProductivityActivity(db, staffMemberId, {
    from: query.from,
    to: query.to,
    limit: Math.min(query.limit, 5000),
  })

  const header = ["created_at", "source", "action", "asset_id", "asset_label", "changed_fields", "summary"]
  const lines = [header.join(",")]
  for (const item of result.items) {
    lines.push(
      [
        csvEscape(item.createdAt),
        csvEscape(item.source),
        csvEscape(item.action),
        csvEscape(item.assetId ?? ""),
        csvEscape(item.assetLabel ?? ""),
        csvEscape(item.changedFields.join("|")),
        csvEscape(item.summary),
      ].join(","),
    )
  }
  return `${lines.join("\n")}\n`
}

async function loadStaffMemberMetrics(
  db: DrizzleClient,
  staffMemberId: string,
  query: StaffProductivityQuery,
): Promise<StaffProductivityMember | null> {
  const from = query.from ?? null
  const to = query.to ?? null
  const result = await db.execute(sql`
    with metadata_events as (
      select
        l.actor_auth_user_id as staff_member_id,
        l.asset_id::text as asset_id,
        l.created_at,
        (l.after ? 'caption') as ch_caption,
        (l.after ? 'who_is_in_picture') as ch_who,
        (l.after ? 'keywords') as ch_keywords,
        (l.after ? 'headline') as ch_headline,
        (l.after ? 'description') as ch_description
      from asset_admin_audit_logs l
      where l.actor_auth_user_id = ${staffMemberId}
        and l.action = 'ASSET_METADATA_UPDATED'
        and l.after is not null
        and l.after <> '{}'::jsonb
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)

      union all

      select
        l.staff_account_id::text as staff_member_id,
        l.entity_id as asset_id,
        l.created_at,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'caption'
        ) as ch_caption,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'whoIsInPicture'
        ) as ch_who,
        exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'keywords'
        ) as ch_keywords,
        false as ch_headline,
        false as ch_description
      from staff_audit_logs l
      where l.staff_account_id = ${staffMemberId}::uuid
        and l.action = 'CONTRIBUTOR_UPLOAD_METADATA_SAVED'
        and jsonb_array_length(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) > 0
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)
    ),
    upload_actions as (
      select
        l.staff_account_id::text as staff_member_id,
        sum(
          case
            when l.action = 'CONTRIBUTOR_UPLOAD_APPROVED'
              then coalesce((l.metadata_json->>'approvedCount')::int, 0)
            else 0
          end
        )::int as uploads_approved,
        sum(
          case
            when l.action = 'CONTRIBUTOR_UPLOAD_REJECTED'
              then coalesce((l.metadata_json->>'rejectedCount')::int, 0)
            else 0
          end
        )::int as uploads_rejected,
        max(l.created_at) as last_upload_activity_at
      from staff_audit_logs l
      where l.staff_account_id = ${staffMemberId}::uuid
        and l.action in ('CONTRIBUTOR_UPLOAD_APPROVED', 'CONTRIBUTOR_UPLOAD_REJECTED')
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)
      group by l.staff_account_id
    ),
    metadata_counts as (
      select
        staff_member_id,
        count(*)::int as saves,
        count(distinct asset_id)::int as unique_assets_touched,
        count(*) filter (where ch_caption)::int as caption_saves,
        count(*) filter (where ch_who)::int as who_saves,
        count(*) filter (where ch_keywords)::int as keywords_saves,
        count(*) filter (where ch_headline)::int as headline_saves,
        count(*) filter (where ch_description)::int as description_saves,
        count(distinct asset_id) filter (where ch_caption)::int as unique_caption,
        count(distinct asset_id) filter (where ch_who)::int as unique_who,
        count(distinct asset_id) filter (where ch_keywords)::int as unique_keywords,
        count(distinct asset_id) filter (where ch_headline)::int as unique_headline,
        count(distinct asset_id) filter (where ch_description)::int as unique_description,
        max(created_at) as last_metadata_at
      from metadata_events
      group by staff_member_id
    )
    select
      sm.id::text as staff_member_id,
      sm.display_name,
      ac.login_identifier as username,
      sm.role,
      sm.status,
      coalesce(mc.unique_assets_touched, 0)::int as unique_assets_touched,
      coalesce(mc.saves, 0)::int as saves,
      coalesce(mc.caption_saves, 0)::int as caption_saves,
      coalesce(mc.who_saves, 0)::int as who_saves,
      coalesce(mc.keywords_saves, 0)::int as keywords_saves,
      coalesce(mc.headline_saves, 0)::int as headline_saves,
      coalesce(mc.description_saves, 0)::int as description_saves,
      coalesce(mc.unique_caption, 0)::int as unique_caption,
      coalesce(mc.unique_who, 0)::int as unique_who,
      coalesce(mc.unique_keywords, 0)::int as unique_keywords,
      coalesce(mc.unique_headline, 0)::int as unique_headline,
      coalesce(mc.unique_description, 0)::int as unique_description,
      coalesce(ua.uploads_approved, 0)::int as uploads_approved,
      coalesce(ua.uploads_rejected, 0)::int as uploads_rejected,
      coalesce(mc.last_metadata_at, ua.last_upload_activity_at) as last_activity_at
    from staff_members sm
    left join auth_credentials ac
      on ac.owner_id = sm.id
      and ac.owner_type = 'STAFF'
      and ac.identifier_type = 'USERNAME'
    left join metadata_counts mc on mc.staff_member_id = sm.id::text
    left join upload_actions ua on ua.staff_member_id = sm.id::text
    where sm.id = ${staffMemberId}::uuid
    limit 1
  `)

  const row = readRows<StaffProductivityRow>(result)[0]
  return row ? serializeMember(row) : null
}

async function staffMemberExists(db: DrizzleClient, staffMemberId: string) {
  const result = await db.execute(sql`
    select 1 as ok
    from staff_members
    where id = ${staffMemberId}::uuid
    limit 1
  `)
  return readRows<{ ok: number }>(result).length > 0
}

async function loadAssetLabels(db: DrizzleClient, assetIds: string[]) {
  const uniqueIds = [...new Set(assetIds.filter((id) => UUID_RE.test(id)))]
  const labels = new Map<string, string>()
  if (uniqueIds.length === 0) return labels

  const result = await db.execute(sql`
    select
      id::text as asset_id,
      coalesce(fotokey, legacy_image_code, left(coalesce(who_is_in_picture, ''), 48)) as asset_label
    from image_assets
    where id in (${sql.join(uniqueIds.map((id) => sql`${id}::uuid`), sql`, `)})
  `)

  for (const row of readRows<{ asset_id: string; asset_label: string | null }>(result)) {
    if (row.asset_label) labels.set(row.asset_id, row.asset_label)
  }
  return labels
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function serializeActivityItem(
  row: ActivityLogRow,
  assetLabel: string | null,
): StaffProductivityActivityItem {
  const changedFields =
    row.source === "asset"
      ? Object.keys(row.after_payload ?? {}).sort()
      : normalizeChangedFields(row.changed_fields)
  const approvedCount = toNumber(row.approved_count)
  const rejectedCount = toNumber(row.rejected_count)
  let summary = "Metadata save"
  if (row.action === "CONTRIBUTOR_UPLOAD_APPROVED") summary = `Approved ${approvedCount} upload(s)`
  else if (row.action === "CONTRIBUTOR_UPLOAD_REJECTED") summary = `Rejected ${rejectedCount} upload(s)`
  else if (changedFields.length > 0) summary = `Edited ${changedFields.map(humanizeField).join(", ")}`
  else summary = row.action.replaceAll("_", " ").toLowerCase()

  return {
    id: row.log_id,
    source: row.source,
    createdAt: toIso(row.created_at) ?? "",
    action: row.action,
    assetId: row.asset_id,
    assetLabel,
    changedFields,
    summary,
    entityHref: row.asset_id && UUID_RE.test(row.asset_id) ? `/staff/catalog/${row.asset_id}` : null,
  }
}

function normalizeChangedFields(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => String(entry))
    .map((field) => {
      if (field === "whoIsInPicture") return "who_is_in_picture"
      return field
    })
    .filter(Boolean)
}

function humanizeField(field: string) {
  switch (field) {
    case "who_is_in_picture":
      return "who is in picture"
    case "category_id":
      return "category"
    case "event_id":
      return "event"
    case "contributor_id":
      return "contributor"
    default:
      return field.replaceAll("_", " ")
  }
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}
