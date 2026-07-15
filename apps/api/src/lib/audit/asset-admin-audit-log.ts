import { sql } from "drizzle-orm"
import type { DrizzleClient } from "../../db"
import { ASSET_AUDIT_ACTION } from "./actions"

export interface AssetAdminAuditActor {
  authUserId: string | null
  email: string | null
}

export async function insertAssetAdminAuditLog(
  db: DrizzleClient,
  input: {
    assetId: string
    action: (typeof ASSET_AUDIT_ACTION)[keyof typeof ASSET_AUDIT_ACTION]
    actor: AssetAdminAuditActor
    before: Record<string, unknown>
    after: Record<string, unknown>
  },
): Promise<void> {
  await db.execute(sql`
    insert into asset_admin_audit_logs (
      asset_id, action, actor_auth_user_id, actor_email, before, after
    ) values (
      ${input.assetId}::uuid,
      ${input.action},
      ${input.actor.authUserId},
      ${input.actor.email},
      ${JSON.stringify(input.before)}::jsonb,
      ${JSON.stringify(input.after)}::jsonb
    )
  `)
}

/** Build before/after deltas for fields that actually changed. */
export function buildFieldDeltas(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const key of Object.keys(next)) {
    if (previous[key] !== next[key]) {
      before[key] = previous[key] ?? null
      after[key] = next[key] ?? null
    }
  }
  return { before, after }
}
