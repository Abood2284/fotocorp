import { sql } from "drizzle-orm"
import type { DrizzleClient } from "../../../db"
import type { StaffProductivityQuery } from "./validators"

export interface StaffProductivitySummary {
  captionsEdited: number
  uniqueAssetsCaptioned: number
  metadataEdits: number
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
  captionsEdited: number
  uniqueAssetsCaptioned: number
  metadataEdits: number
  uploadsApproved: number
  uploadsRejected: number
  lastActivityAt: string | null
}

export interface StaffProductivityResult {
  summary: StaffProductivitySummary
  members: StaffProductivityMember[]
}

interface StaffProductivityRow {
  staff_member_id: string
  display_name: string
  username: string | null
  role: string
  status: string
  captions_edited: number | string | null
  unique_assets_captioned: number | string | null
  metadata_edits: number | string | null
  uploads_approved: number | string | null
  uploads_rejected: number | string | null
  last_activity_at: Date | string | null
}

export async function getStaffProductivity(
  db: DrizzleClient,
  query: StaffProductivityQuery,
): Promise<StaffProductivityResult> {
  const from = query.from ?? null
  const to = query.to ?? null
  const result = await db.execute(sql`
    with caption_events as (
      select
        l.actor_auth_user_id as staff_member_id,
        l.asset_id::text as asset_id,
        l.created_at
      from asset_admin_audit_logs l
      where l.actor_auth_user_id is not null
        and l.action = 'ASSET_METADATA_UPDATED'
        and l.after ? 'caption'
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)

      union all

      select
        l.staff_account_id::text as staff_member_id,
        l.entity_id as asset_id,
        l.created_at
      from staff_audit_logs l
      where l.staff_account_id is not null
        and l.action = 'CONTRIBUTOR_UPLOAD_METADATA_SAVED'
        and exists (
          select 1
          from jsonb_array_elements_text(coalesce(l.metadata_json->'changedFields', '[]'::jsonb)) as changed(field)
          where changed.field = 'caption'
        )
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)
    ),
    metadata_edit_events as (
      select
        l.actor_auth_user_id as staff_member_id,
        l.asset_id::text as asset_id,
        l.created_at
      from asset_admin_audit_logs l
      where l.actor_auth_user_id is not null
        and l.action = 'ASSET_METADATA_UPDATED'
        and (${from}::timestamptz is null or l.created_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or l.created_at <= ${to}::timestamptz)

      union all

      select
        l.staff_account_id::text as staff_member_id,
        l.entity_id as asset_id,
        l.created_at
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
    staff_activity as (
      select staff_member_id, created_at from caption_events
      union all
      select staff_member_id, created_at from metadata_edit_events
      union all
      select staff_member_id, last_upload_activity_at as created_at from upload_actions
    ),
    caption_counts as (
      select
        staff_member_id,
        count(*)::int as captions_edited,
        count(distinct asset_id)::int as unique_assets_captioned
      from caption_events
      group by staff_member_id
    ),
    metadata_counts as (
      select
        staff_member_id,
        count(*)::int as metadata_edits
      from metadata_edit_events
      group by staff_member_id
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
      coalesce(cc.captions_edited, 0)::int as captions_edited,
      coalesce(cc.unique_assets_captioned, 0)::int as unique_assets_captioned,
      coalesce(mc.metadata_edits, 0)::int as metadata_edits,
      coalesce(ua.uploads_approved, 0)::int as uploads_approved,
      coalesce(ua.uploads_rejected, 0)::int as uploads_rejected,
      la.last_activity_at
    from staff_members sm
    left join auth_credentials ac
      on ac.owner_id = sm.id
      and ac.owner_type = 'STAFF'
      and ac.identifier_type = 'USERNAME'
    left join caption_counts cc on cc.staff_member_id = sm.id::text
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
      coalesce(la.last_activity_at, 'epoch'::timestamptz) desc,
      lower(sm.display_name) asc
  `)

  const rows = readRows<StaffProductivityRow>(result)
  const members = rows.map(serializeRow)

  return {
    summary: {
      captionsEdited: sum(members, "captionsEdited"),
      uniqueAssetsCaptioned: sum(members, "uniqueAssetsCaptioned"),
      metadataEdits: sum(members, "metadataEdits"),
      uploadsApproved: sum(members, "uploadsApproved"),
      uploadsRejected: sum(members, "uploadsRejected"),
      activeStaffCount: members.filter((member) => member.lastActivityAt !== null).length,
    },
    members,
  }
}

function serializeRow(row: StaffProductivityRow): StaffProductivityMember {
  return {
    staffMemberId: row.staff_member_id,
    displayName: row.display_name,
    username: row.username,
    role: row.role,
    status: row.status,
    captionsEdited: toNumber(row.captions_edited),
    uniqueAssetsCaptioned: toNumber(row.unique_assets_captioned),
    metadataEdits: toNumber(row.metadata_edits),
    uploadsApproved: toNumber(row.uploads_approved),
    uploadsRejected: toNumber(row.uploads_rejected),
    lastActivityAt: toIso(row.last_activity_at),
  }
}

function sum(members: StaffProductivityMember[], key: keyof Pick<
  StaffProductivityMember,
  "captionsEdited" | "uniqueAssetsCaptioned" | "metadataEdits" | "uploadsApproved" | "uploadsRejected"
>) {
  return members.reduce((total, member) => total + member[key], 0)
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

function readRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown[] }).rows)) {
    return (result as { rows: T[] }).rows
  }
  return []
}
