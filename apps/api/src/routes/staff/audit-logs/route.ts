import type { Context } from "hono"
import { zValidator } from "@hono/zod-validator"
import { getCookie } from "hono/cookie"
import { Hono } from "hono"
import type { Env } from "../../../appTypes"
import type { AppRequestVariables } from "../../../db"
import { createHttpDb } from "../../../db"
import { AppError } from "../../../lib/errors"
import { methodNotAllowed } from "../../../lib/route-errors"
import { STAFF_SESSION_COOKIE, requireStaffSession } from "../auth/service"
import { listStaffAuditLogs } from "./service"
import { listStaffAuditLogsQuerySchema } from "./validators"

const STAFF_AUDIT_ADMIN_ROLES = new Set(["SUPER_ADMIN"])

export const staffAuditLogRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>()

function database(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}

async function requireStaffAuditAdmin(c: Context<{ Bindings: Env; Variables: AppRequestVariables }>) {
  const db = database(c.env)
  const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE))
  if (!STAFF_AUDIT_ADMIN_ROLES.has(session.staff.role)) {
    throw new AppError(403, "STAFF_FORBIDDEN", "You do not have access to staff audit logs.")
  }
  return { db }
}

staffAuditLogRoutes.get(
  "/api/v1/staff/audit-logs",
  zValidator("query", listStaffAuditLogsQuerySchema),
  async (c) => {
    const { db } = await requireStaffAuditAdmin(c)
    const query = c.req.valid("query")
    const result = await listStaffAuditLogs(db, {
      source: query.source,
      action: query.action,
      entityType: query.entityType,
      from: query.from,
      to: query.to,
      limit: query.limit,
      cursor: query.cursor,
    })

    return c.json({ ok: true, items: result.items, nextCursor: result.nextCursor })
  },
)

staffAuditLogRoutes.all("/api/v1/staff/audit-logs", () => methodNotAllowed())
