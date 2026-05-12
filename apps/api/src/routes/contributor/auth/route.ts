import { zValidator } from "@hono/zod-validator";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { createHttpDb, type AppRequestVariables } from "../../../db";
import { AppError } from "../../../lib/errors";
import { methodNotAllowed } from "../../../lib/route-errors";
import {
  changePhotographerPassword,
  getCurrentPhotographerSession,
  loginPhotographer,
  logoutPhotographer,
  CONTRIBUTOR_SESSION_COOKIE,
} from "./service";
import { photographerChangePasswordSchema, photographerLoginSchema } from "./validators";

export const photographerAuthRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

photographerAuthRoutes.post(
  "/api/v1/contributor/auth/login",
  zValidator("json", photographerLoginSchema),
  async (c) => {
    const result = await loginPhotographer(
      db(c.env),
      c.req.valid("json"),
      {
        ip: c.get("requestIp") ?? null,
        userAgent: c.get("requestUserAgent") ?? null,
      },
    );

    setCookie(c, CONTRIBUTOR_SESSION_COOKIE, result.rawSessionToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecureCookie(c.req.raw),
      path: "/",
      maxAge: result.cookieMaxAgeSeconds,
      expires: result.sessionExpiresAt,
    });

    return c.json({
      ok: true,
      account: result.account,
      contributor: result.contributor,
    });
  },
);

photographerAuthRoutes.all("/api/v1/contributor/auth/login", () => methodNotAllowed());

photographerAuthRoutes.post("/api/v1/contributor/auth/logout", async (c) => {
  await logoutPhotographer(db(c.env), getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
  deleteCookie(c, CONTRIBUTOR_SESSION_COOKIE, {
    path: "/",
    secure: isSecureCookie(c.req.raw),
    sameSite: "Lax",
  });
  return c.json({ ok: true });
});

photographerAuthRoutes.all("/api/v1/contributor/auth/logout", () => methodNotAllowed());

photographerAuthRoutes.get("/api/v1/contributor/auth/me", async (c) => {
  const session = await getCurrentPhotographerSession(db(c.env), getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
  if (!session) throw new AppError(401, "CONTRIBUTOR_AUTH_REQUIRED", "Photographer authentication is required.");

  return c.json({
    ok: true,
    account: session.account,
    contributor: session.contributor,
  });
});

photographerAuthRoutes.all("/api/v1/contributor/auth/me", () => methodNotAllowed());

photographerAuthRoutes.post(
  "/api/v1/contributor/auth/change-password",
  zValidator("json", photographerChangePasswordSchema),
  async (c) => {
    const session = await changePhotographerPassword(
      db(c.env),
      getCookie(c, CONTRIBUTOR_SESSION_COOKIE),
      c.req.valid("json"),
    );

    return c.json({
      ok: true,
      account: session.account,
      contributor: session.contributor,
    });
  },
);

photographerAuthRoutes.all("/api/v1/contributor/auth/change-password", () => methodNotAllowed());

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  return createHttpDb(env.DATABASE_URL);
}

/** Secure cookies only for HTTPS requests (production API URLs); localhost HTTP dev keeps Secure off. */
function isSecureCookie(request: Request) {
  return new URL(request.url).protocol === "https:";
}
