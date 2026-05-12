import { zValidator } from "@hono/zod-validator";
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { createHttpDb, type AppRequestVariables } from "../../../db";
import { AppError } from "../../../lib/errors";
import { json } from "../../../lib/http";
import { methodNotAllowed } from "../../../lib/route-errors";
import { CONTRIBUTOR_SESSION_COOKIE, requirePhotographerSession } from "../auth/service";
import { listPhotographerImages } from "./service";
import { photographerImagesQuerySchema } from "./validators";

export const photographerImageRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

photographerImageRoutes.get(
  "/api/v1/contributor/images",
  zValidator("query", photographerImagesQuerySchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    return json(await listPhotographerImages(database, session, c.req.valid("query")));
  },
);

photographerImageRoutes.all("/api/v1/contributor/images", () => methodNotAllowed());

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  return createHttpDb(env.DATABASE_URL);
}
