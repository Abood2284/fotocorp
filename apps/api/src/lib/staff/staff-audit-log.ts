import { sql } from "drizzle-orm"
import type { DrizzleClient } from "../../db"

export const CONTRIBUTOR_UPLOAD_AUDIT_ACTION = {
  METADATA_SAVED: "CONTRIBUTOR_UPLOAD_METADATA_SAVED",
  APPROVED: "CONTRIBUTOR_UPLOAD_APPROVED",
  REJECTED: "CONTRIBUTOR_UPLOAD_REJECTED",
  FILE_REPLACED: "CONTRIBUTOR_UPLOAD_FILE_REPLACED",
} as const

export interface InsertStaffAuditLogInput {
  staffMemberId: string | null
  action: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  ip?: string | null
  userAgent?: string | null
}

export async function insertStaffAuditLog(db: DrizzleClient, input: InsertStaffAuditLogInput): Promise<void> {
  if (input.metadata === null) {
    await db.execute(sql`
      insert into staff_audit_logs (
        staff_account_id,
        action,
        entity_type,
        entity_id,
        metadata_json,
        ip_address,
        user_agent
      ) values (
        ${input.staffMemberId},
        ${input.action},
        ${input.entityType},
        ${input.entityId},
        null,
        ${input.ip ?? null},
        ${input.userAgent ?? null}
      )
    `)
    return
  }

  const serialized = JSON.stringify(input.metadata)
  await db.execute(sql`
    insert into staff_audit_logs (
      staff_account_id,
      action,
      entity_type,
      entity_id,
      metadata_json,
      ip_address,
      user_agent
    ) values (
      ${input.staffMemberId},
      ${input.action},
      ${input.entityType},
      ${input.entityId},
      ${serialized}::jsonb,
      ${input.ip ?? null},
      ${input.userAgent ?? null}
    )
  `)
}
