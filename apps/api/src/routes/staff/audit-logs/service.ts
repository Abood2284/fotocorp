import { sql, type SQL } from "drizzle-orm"
import type { DrizzleClient } from "../../../db"
import { AppError } from "../../../lib/errors"
import { buildAuditSummary, sanitizeAuditMetadata } from "./sanitize"
import {
  decodeStaffAuditLogCursor,
  encodeStaffAuditLogCursor,
  type AuditLogSource,
} from "./validators"

export interface StaffAuditLogListItem {
  id: string
  source: AuditLogSource
  createdAt: string
  action: string
  entityType: string | null
  entityId: string | null
  actorLabel: string | null
  actorId: string | null
  targetLabel: string | null
  summary: string
  metadata: Record<string, unknown> | null
  entityHref: string | null
}

export interface ListStaffAuditLogsInput {
  source?: AuditLogSource
  action?: string
  entityType?: string
  from?: string
  to?: string
  limit: number
  cursor?: string
}

interface UnifiedAuditRow {
  source: AuditLogSource
  log_id: string
  created_at: Date | string
  action: string
  entity_type: string | null
  entity_id: string | null
  actor_staff_id: string | null
  actor_email: string | null
  actor_display_name: string | null
  actor_username: string | null
  target_label: string | null
  payload: Record<string, unknown> | null
}

export async function listStaffAuditLogs(db: DrizzleClient, input: ListStaffAuditLogsInput) {
  const cursor = input.cursor ? decodeStaffAuditLogCursor(input.cursor) : null
  if (input.cursor && !cursor) {
    throw new AppError(400, "INVALID_CURSOR", "Audit log cursor is invalid.")
  }

  const filters: SQL[] = []
  if (input.source) filters.push(sql`u.source = ${input.source}`)
  if (input.action) filters.push(sql`u.action ilike ${`%${input.action}%`}`)
  if (input.entityType) filters.push(sql`u.entity_type ilike ${input.entityType}`)
  if (input.from) filters.push(sql`u.created_at >= ${input.from}::timestamptz`)
  if (input.to) filters.push(sql`u.created_at <= ${input.to}::timestamptz`)

  if (cursor) {
    filters.push(sql`(
      u.created_at < ${cursor.createdAt}::timestamptz
      or (
        u.created_at = ${cursor.createdAt}::timestamptz
        and u.source > ${cursor.source}
      )
      or (
        u.created_at = ${cursor.createdAt}::timestamptz
        and u.source = ${cursor.source}
        and u.log_id < ${cursor.id}
      )
    )`)
  }

  const whereClause = filters.length > 0 ? sql`where ${sql.join(filters, sql` and `)}` : sql``
  const fetchLimit = input.limit + 1

  const result = await db.execute(sql`
    with unified as (
      select
        'staff'::text as source,
        l.id::text as log_id,
        l.created_at,
        l.action,
        l.entity_type,
        l.entity_id,
        l.staff_account_id::text as actor_staff_id,
        null::text as actor_email,
        sm.display_name as actor_display_name,
        ac.login_identifier as actor_username,
        null::text as target_label,
        l.metadata_json as payload
      from staff_audit_logs l
      left join staff_members sm on sm.id = l.staff_account_id
      left join auth_credentials ac
        on ac.owner_id = l.staff_account_id
        and ac.owner_type = 'STAFF'
        and ac.identifier_type = 'USERNAME'

      union all

      select
        'asset'::text as source,
        l.id::text as log_id,
        l.created_at,
        l.action,
        'image_asset'::text as entity_type,
        l.asset_id::text as entity_id,
        l.actor_auth_user_id as actor_staff_id,
        l.actor_email as actor_email,
        null::text as actor_display_name,
        null::text as actor_username,
        coalesce(ia.fotokey, ia.legacy_image_code, ia.who_is_in_picture) as target_label,
        jsonb_build_object('before', l.before, 'after', l.after) as payload
      from asset_admin_audit_logs l
      left join image_assets ia on ia.id = l.asset_id

      union all

      select
        'user'::text as source,
        l.id::text as log_id,
        l.created_at,
        l.action,
        'user'::text as entity_type,
        l.target_auth_user_id as entity_id,
        l.actor_auth_user_id as actor_staff_id,
        l.actor_email as actor_email,
        null::text as actor_display_name,
        null::text as actor_username,
        coalesce(u.email, u.username, u.company_email) as target_label,
        jsonb_build_object('before', l.before, 'after', l.after) as payload
      from admin_user_audit_logs l
      left join users u on u.id::text = l.target_auth_user_id
    )
    select
      u.source,
      u.log_id,
      u.created_at,
      u.action,
      u.entity_type,
      u.entity_id,
      u.actor_staff_id,
      u.actor_email,
      u.actor_display_name,
      u.actor_username,
      u.target_label,
      u.payload
    from unified u
    ${whereClause}
    order by u.created_at desc, u.source asc, u.log_id desc
    limit ${fetchLimit}
  `)

  const rawRows = readExecuteRows<UnifiedAuditRow>(result)
  const hasMore = rawRows.length > input.limit
  const pageRows = hasMore ? rawRows.slice(0, input.limit) : rawRows

  const items = pageRows.map((row) => serializeAuditLogRow(row))
  const last = pageRows.at(-1)
  const nextCursor =
    hasMore && last
      ? encodeStaffAuditLogCursor({
          createdAt: toIso(last.created_at),
          source: last.source,
          id: last.log_id,
        })
      : null

  return { items, nextCursor }
}

function serializeAuditLogRow(row: UnifiedAuditRow): StaffAuditLogListItem {
  const metadata = sanitizeAuditMetadata(row.payload)
  const actorLabel = resolveActorLabel(row)
  const entityHref = resolveEntityHref(row.source, row.entity_type, row.entity_id)

  return {
    id: row.log_id,
    source: row.source,
    createdAt: toIso(row.created_at),
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorLabel,
    actorId: row.actor_staff_id,
    targetLabel: row.target_label,
    summary: buildAuditSummary(row.source, row.action, metadata),
    metadata,
    entityHref,
  }
}

function resolveActorLabel(row: UnifiedAuditRow) {
  if (row.actor_display_name && row.actor_username) return `${row.actor_display_name} (@${row.actor_username})`
  if (row.actor_username) return row.actor_username
  if (row.actor_display_name) return row.actor_display_name
  if (row.actor_email) return row.actor_email
  return null
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value)
}

function readExecuteRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown[] }).rows)) {
    return (result as { rows: T[] }).rows
  }
  return []
}

function resolveEntityHref(source: AuditLogSource, entityType: string | null, entityId: string | null) {
  if (!entityId) return null
  if (source === "asset" || entityType === "image_asset") return `/staff/catalog/${entityId}`
  if (source === "user" || entityType === "user") return `/staff/users?highlight=${encodeURIComponent(entityId)}`
  if (entityType === "staff_member") return `/staff/staff-users`
  if (entityType === "contributor_upload" || entityType === "image_asset") return `/staff/contributor-uploads`
  return null
}
