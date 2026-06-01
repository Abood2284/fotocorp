import { Hono } from "hono";
import type { Env } from "../../appTypes";
import type { AppRequestVariables } from "../../db";
import { AppError } from "../../lib/errors";
import { errorResponse } from "../../lib/http";

/** Better Auth catch-all retired after P5 — platform auth lives under /api/v1/auth/*. */
export const authRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

authRoutes.all("/api/auth/*", (c) => {
  return errorResponse(
    new AppError(
      410,
      "BETTER_AUTH_RETIRED",
      "Better Auth is retired. Use /api/v1/auth/login, /api/v1/auth/logout, /api/v1/auth/sign-up, or the web BFF /api/auth/* platform routes.",
    ),
    { requestId: c.get("requestId") },
  );
});
