import { zValidator } from "@hono/zod-validator";
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { createHttpDb, type AppRequestVariables } from "../../../db";
import { AppError } from "../../../lib/errors";
import { json } from "../../../lib/http";
import { methodNotAllowed } from "../../../lib/route-errors";
import { CONTRIBUTOR_SESSION_COOKIE, requirePhotographerSession } from "../auth/service";
import { getPhotographerAnalyticsSummary } from "./service";
import { photographerAnalyticsQuerySchema } from "./validators";

export const photographerAnalyticsRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

photographerAnalyticsRoutes.get(
  "/api/v1/contributor/analytics/summary",
  zValidator("query", photographerAnalyticsQuerySchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    return json(await getPhotographerAnalyticsSummary(database, session));
  },
);

photographerAnalyticsRoutes.all("/api/v1/contributor/analytics/summary", () => methodNotAllowed());

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  return createHttpDb(env.DATABASE_URL);
}
