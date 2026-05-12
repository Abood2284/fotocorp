import { zValidator } from "@hono/zod-validator";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { createHttpDb, type AppRequestVariables } from "../../../db";
import { AppError } from "../../../lib/errors";
import { methodNotAllowed } from "../../../lib/route-errors";
import {
  getCurrentStaffSession,
  loginStaff,
  logoutStaff,
  STAFF_SESSION_COOKIE,
} from "./service";
import { staffLoginSchema } from "./validators";

export const staffAuthRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

staffAuthRoutes.post("/api/v1/staff/auth/login", zValidator("json", staffLoginSchema), async (c) => {
  const result = await loginStaff(db(c.env), c.req.valid("json"), {
    ip: c.get("requestIp") ?? null,
    userAgent: c.get("requestUserAgent") ?? null,
  });

  setCookie(c, STAFF_SESSION_COOKIE, result.rawSessionToken, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecureCookie(c.req.raw),
    path: "/",
    maxAge: result.cookieMaxAgeSeconds,
    expires: result.sessionExpiresAt,
  });

  return c.json({
    ok: true,
    staff: {
      id: result.staff.id,
      username: result.staff.username,
      displayName: result.staff.displayName,
      role: result.staff.role,
      status: result.staff.status,
    },
  });
});

staffAuthRoutes.all("/api/v1/staff/auth/login", () => methodNotAllowed());

staffAuthRoutes.post("/api/v1/staff/auth/logout", async (c) => {
  await logoutStaff(db(c.env), getCookie(c, STAFF_SESSION_COOKIE));
  deleteCookie(c, STAFF_SESSION_COOKIE, {
    path: "/",
    secure: isSecureCookie(c.req.raw),
    sameSite: "Lax",
  });
  return c.json({ ok: true });
});

staffAuthRoutes.all("/api/v1/staff/auth/logout", () => methodNotAllowed());

staffAuthRoutes.get("/api/v1/staff/auth/me", async (c) => {
  const session = await getCurrentStaffSession(db(c.env), getCookie(c, STAFF_SESSION_COOKIE));
  if (!session) throw new AppError(401, "STAFF_AUTH_REQUIRED", "Staff authentication is required.");

  return c.json({
    ok: true,
    staff: {
      id: session.staff.id,
      username: session.staff.username,
      displayName: session.staff.displayName,
      role: session.staff.role,
      status: session.staff.status,
    },
  });
});

staffAuthRoutes.all("/api/v1/staff/auth/me", () => methodNotAllowed());

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  return createHttpDb(env.DATABASE_URL);
}

function isSecureCookie(request: Request) {
  return new URL(request.url).protocol === "https:";
}
