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
  getCustomerUserDetail,
  listCustomerUsers,
  suspendCustomerUser,
  unsuspendCustomerUser,
} from "./service";
import { getAuth } from "../../../auth/auth";

export const staffUsersRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

function database(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  return createHttpDb(env.DATABASE_URL);
}

const authUserIdParam = z.object({ authUserId: z.string() });

staffUsersRoutes.get("/api/v1/staff/users", async (c) => {
  const db = database(c.env);
  await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
  const url = new URL(c.req.url);
  const result = await listCustomerUsers(db, url.searchParams);
  return json({ ok: true as const, ...result });
});

staffUsersRoutes.all("/api/v1/staff/users", () => methodNotAllowed());

staffUsersRoutes.get(
  "/api/v1/staff/users/:authUserId",
  zValidator("param", authUserIdParam),
  async (c) => {
    const db = database(c.env);
    await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
    const { authUserId } = c.req.valid("param");
    const result = await getCustomerUserDetail(db, authUserId);
    return json({ ok: true as const, ...result });
  },
);

staffUsersRoutes.post(
  "/api/v1/staff/users/:authUserId/suspend",
  zValidator("param", authUserIdParam),
  async (c) => {
    const db = database(c.env);
    const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
    const { authUserId } = c.req.valid("param");
    const result = await suspendCustomerUser(db, authUserId, session.staff);
    return json({ ok: true as const, ...result });
  },
);

staffUsersRoutes.post(
  "/api/v1/staff/users/:authUserId/unsuspend",
  zValidator("param", authUserIdParam),
  async (c) => {
    const db = database(c.env);
    const session = await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
    const { authUserId } = c.req.valid("param");
    const result = await unsuspendCustomerUser(db, authUserId, session.staff);
    return json({ ok: true as const, ...result });
  },
);

staffUsersRoutes.post(
  "/api/v1/staff/users/:authUserId/reset-password",
  zValidator("param", authUserIdParam),
  async (c) => {
    const db = database(c.env);
    await requireStaffSession(db, getCookie(c, STAFF_SESSION_COOKIE));
    const { authUserId } = c.req.valid("param");
    const detail = await getCustomerUserDetail(db, authUserId);

    const auth = getAuth(c.env);
    // Request Better Auth to generate and send the reset password email
    try {
      await auth.api.forgetPassword({
        body: {
          email: detail.user.email,
          redirectTo: "/reset-password",
        },
      });
    } catch (e) {
      console.error("[staff-users] Failed to trigger forgetPassword for user", authUserId, e);
      throw new AppError(500, "RESET_PASSWORD_FAILED", "Failed to trigger password reset email.");
    }

    return json({ ok: true as const });
  },
);

staffUsersRoutes.all("/api/v1/staff/users/:authUserId/*", () => methodNotAllowed());
