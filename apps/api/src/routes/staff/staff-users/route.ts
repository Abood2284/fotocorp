import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import type { Env } from "../../../appTypes";
import type { AppRequestVariables } from "../../../db";
import { createHttpDb } from "../../../db";
import { AppError } from "../../../lib/errors";
import { json } from "../../../lib/http";
import { methodNotAllowed } from "../../../lib/route-errors";
import { STAFF_SESSION_COOKIE, requireStaffSession } from "../auth/service";
import {
  createStaffUser,
  listStaffUsers,
  resetStaffPassword,
  setStaffStatus,
  updateStaffRole,
} from "./service";

export const staffManagementRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

function database(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  return createHttpDb(env.DATABASE_URL);
}

const staffIdParam = z.object({ staffId: z.string().uuid() });

const createStaffBody = z.object({
  username: z.string().min(3).max(50),
  displayName: z.string().min(1).max(100),
  role: z.enum(["SUPER_ADMIN", "CATALOG_MANAGER", "REVIEWER", "CAPTION_MANAGER", "FINANCE", "SUPPORT"]),
  passwordPlain: z.string().min(8),
});

const updateRoleBody = z.object({
  role: z.enum(["SUPER_ADMIN", "CATALOG_MANAGER", "REVIEWER", "CAPTION_MANAGER", "FINANCE", "SUPPORT"]),
});

const resetPasswordBody = z.object({
  newPasswordPlain: z.string().min(8),
});

staffManagementRoutes.get("/api/v1/staff/staff-users", async (c) => {
  const db = database(c.env);
  const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
  const result = await listStaffUsers(db, session.staff);
  return json({ ok: true as const, ...result });
});

staffManagementRoutes.post(
  "/api/v1/staff/staff-users",
  zValidator("json", createStaffBody),
  async (c) => {
    const db = database(c.env);
    const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
    const body = c.req.valid("json");
    const result = await createStaffUser(db, session.staff, body);
    return json({ ok: true as const, ...result });
  },
);

staffManagementRoutes.patch(
  "/api/v1/staff/staff-users/:staffId",
  zValidator("param", staffIdParam),
  zValidator("json", updateRoleBody),
  async (c) => {
    const db = database(c.env);
    const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
    const { staffId } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await updateStaffRole(db, session.staff, staffId, body.role);
    return json({ ok: true as const, ...result });
  },
);

staffManagementRoutes.post(
  "/api/v1/staff/staff-users/:staffId/disable",
  zValidator("param", staffIdParam),
  async (c) => {
    const db = database(c.env);
    const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
    const { staffId } = c.req.valid("param");
    const result = await setStaffStatus(db, session.staff, staffId, "DISABLED");
    return json({ ok: true as const, ...result });
  },
);

staffManagementRoutes.post(
  "/api/v1/staff/staff-users/:staffId/enable",
  zValidator("param", staffIdParam),
  async (c) => {
    const db = database(c.env);
    const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
    const { staffId } = c.req.valid("param");
    const result = await setStaffStatus(db, session.staff, staffId, "ACTIVE");
    return json({ ok: true as const, ...result });
  },
);

staffManagementRoutes.post(
  "/api/v1/staff/staff-users/:staffId/reset-password",
  zValidator("param", staffIdParam),
  zValidator("json", resetPasswordBody),
  async (c) => {
    const db = database(c.env);
    const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
    const { staffId } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await resetStaffPassword(db, session.staff, staffId, body.newPasswordPlain);
    return json({ ok: true as const, ...result });
  },
);

staffManagementRoutes.all("/api/v1/staff/staff-users", () => methodNotAllowed());
staffManagementRoutes.all("/api/v1/staff/staff-users/:staffId/*", () => methodNotAllowed());
