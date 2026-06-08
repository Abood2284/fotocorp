import type { Env } from "../../../appTypes"
import { createHttpDb } from "../../../db"
import { AppError } from "../../../lib/errors"
import { json } from "../../../lib/http"
import {
  getHomepageHeroPool,
  listHomepageHeroPoolCandidates,
  replaceHomepageHeroPool,
} from "../../../lib/assets/homepage-hero-pool"
import { sql } from "drizzle-orm"

interface AdminActor {
  authUserId: string | null
  email: string | null
}

const HOMEPAGE_HERO_POOL_AUDIT_ACTION = "HOMEPAGE_HERO_POOL_REPLACED"

export async function getHomepageHeroPoolService(env: Env) {
  return json(await getHomepageHeroPool(db(env)))
}

export async function listHomepageHeroPoolCandidatesService(
  env: Env,
  query: { q?: string; cursor?: string; limit: number },
) {
  return json(await listHomepageHeroPoolCandidates(db(env), query))
}

export async function replaceHomepageHeroPoolService(
  env: Env,
  body: { assetIds: string[] },
  actor: AdminActor,
  request: Request,
) {
  const response = await replaceHomepageHeroPool(db(env), {
    assetIds: body.assetIds,
    staffMemberId: actor.authUserId,
  })

  await insertStaffAuditLog(db(env), {
    staffMemberId: actor.authUserId,
    action: HOMEPAGE_HERO_POOL_AUDIT_ACTION,
    entityType: "homepage_hero_pool",
    entityId: null,
    metadata: {
      assetCount: body.assetIds.length,
      assetIds: body.assetIds,
      actorEmail: actor.email,
    },
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
  })

  return json(response)
}

export function actorFromRequest(request: Request): AdminActor {
  return {
    authUserId: request.headers.get("x-admin-auth-user-id")?.trim() || null,
    email: request.headers.get("x-admin-email")?.trim() || null,
  }
}

function db(env: Env) {
  if (!env.DATABASE_URL) {
    throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  }
  return createHttpDb(env.DATABASE_URL)
}

interface InsertStaffAuditLogInput {
  staffMemberId: string | null
  action: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  userAgent: string | null
}

async function insertStaffAuditLog(
  dbClient: ReturnType<typeof createHttpDb>,
  input: InsertStaffAuditLogInput,
): Promise<void> {
  const serialized = input.metadata ? JSON.stringify(input.metadata) : null
  await dbClient.execute(sql`
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
      ${input.ip},
      ${input.userAgent}
    )
  `)
}
