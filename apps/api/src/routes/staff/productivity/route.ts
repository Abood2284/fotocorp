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
import { getStaffProductivity } from "./service"
import { staffProductivityQuerySchema } from "./validators"

const STAFF_PRODUCTIVITY_ADMIN_ROLES = new Set(["SUPER_ADMIN"])

export const staffProductivityRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>()

function database(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}

async function requireStaffProductivityAdmin(c: Context<{ Bindings: Env; Variables: AppRequestVariables }>) {
  const db = database(c.env)
  const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE))
  if (!STAFF_PRODUCTIVITY_ADMIN_ROLES.has(session.staff.role)) {
    throw new AppError(403, "STAFF_FORBIDDEN", "You do not have access to staff productivity metrics.")
  }
  return { db }
}

staffProductivityRoutes.get(
  "/api/v1/staff/productivity",
  zValidator("query", staffProductivityQuerySchema),
  async (c) => {
    const { db } = await requireStaffProductivityAdmin(c)
    const query = c.req.valid("query")
    const result = await getStaffProductivity(db, query)

    return c.json({ ok: true, ...result })
  },
)

staffProductivityRoutes.all("/api/v1/staff/productivity", () => methodNotAllowed())
