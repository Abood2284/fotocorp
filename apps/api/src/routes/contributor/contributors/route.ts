import { zValidator } from "@hono/zod-validator";
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../appTypes";
import { createHttpDb, type AppRequestVariables } from "../../../db";
import { AppError } from "../../../lib/errors";
import { json } from "../../../lib/http";
import { methodNotAllowed } from "../../../lib/route-errors";
import { CONTRIBUTOR_SESSION_COOKIE, requirePhotographerSession } from "../auth/service";
import { listContributorsForPortalAdmin } from "./service";

export const photographerContributorsRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

const contributorsListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

photographerContributorsRoutes.get(
  "/api/v1/contributor/contributors",
  zValidator("query", contributorsListQuerySchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    return json(await listContributorsForPortalAdmin(database, session, c.req.valid("query")));
  },
);

photographerContributorsRoutes.all("/api/v1/contributor/contributors", () => methodNotAllowed());

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  return createHttpDb(env.DATABASE_URL);
}
