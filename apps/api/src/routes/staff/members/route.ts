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
import {
  createManagedStaffMember,
  listManagedStaffMembers,
  patchManagedStaffMember,
} from "./service"
import {
  createStaffMemberBodySchema,
  listStaffMembersQuerySchema,
  patchStaffMemberBodySchema,
  staffMemberIdParamSchema,
} from "./validators"

const STAFF_MEMBER_ADMIN_ROLES = new Set(["SUPER_ADMIN"])

export const staffMemberRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>()

function database(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}

async function requireStaffMemberAdmin(c: Context<{ Bindings: Env; Variables: AppRequestVariables }>) {
  const db = database(c.env)
  const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE))
  if (!STAFF_MEMBER_ADMIN_ROLES.has(session.staff.role)) {
    throw new AppError(403, "STAFF_FORBIDDEN", "You do not have access to staff account administration.")
  }
  return { db, staff: session.staff }
}

staffMemberRoutes.get("/api/v1/staff/members", zValidator("query", listStaffMembersQuerySchema), async (c) => {
  const { db } = await requireStaffMemberAdmin(c)
  const query = c.req.valid("query")
  const items = await listManagedStaffMembers(db, query.role)
  return c.json({ ok: true, items })
})

staffMemberRoutes.post("/api/v1/staff/members", zValidator("json", createStaffMemberBodySchema), async (c) => {
  const { db, staff } = await requireStaffMemberAdmin(c)
  const body = c.req.valid("json")
  const member = await createManagedStaffMember(
    db,
    {
      username: body.username,
      password: body.password,
      displayName: body.displayName,
      role: body.role,
      createdByStaffMemberId: staff.id,
    },
    {
      ip: c.get("requestIp") ?? null,
      userAgent: c.get("requestUserAgent") ?? null,
    },
  )

  return c.json({ ok: true, member }, 201)
})

staffMemberRoutes.all("/api/v1/staff/members", () => methodNotAllowed())

staffMemberRoutes.patch(
  "/api/v1/staff/members/:memberId",
  zValidator("param", staffMemberIdParamSchema),
  zValidator("json", patchStaffMemberBodySchema),
  async (c) => {
    const { db, staff } = await requireStaffMemberAdmin(c)
    const { memberId } = c.req.valid("param")
    const body = c.req.valid("json")
    const member = await patchManagedStaffMember(
      db,
      {
        memberId,
        actingStaffMemberId: staff.id,
        status: body.status,
        displayName: body.displayName,
        password: body.password,
      },
      {
        ip: c.get("requestIp") ?? null,
        userAgent: c.get("requestUserAgent") ?? null,
      },
    )

    return c.json({ ok: true, member })
  },
)

staffMemberRoutes.all("/api/v1/staff/members/:memberId", () => methodNotAllowed())
