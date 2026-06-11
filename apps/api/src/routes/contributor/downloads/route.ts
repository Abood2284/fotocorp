import { zValidator } from "@hono/zod-validator";
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { createHttpDb, type AppRequestVariables } from "../../../db";
import { AppError } from "../../../lib/errors";
import { json } from "../../../lib/http";
import { methodNotAllowed } from "../../../lib/route-errors";
import {
  CONTRIBUTOR_SESSION_COOKIE,
  requirePhotographerSession,
} from "../auth/service";
import { getPhotographerDownloads } from "./service";
import { contributorDownloadsQuerySchema } from "./validators";

export const photographerDownloadRoutes = new Hono<{
  Bindings: Env;
  Variables: AppRequestVariables;
}>();

photographerDownloadRoutes.get(
  "/api/v1/contributor/downloads",
  zValidator("query", contributorDownloadsQuerySchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(
      database,
      getCookie(c, CONTRIBUTOR_SESSION_COOKIE),
    );
    const query = c.req.valid("query");
    return json(
      await getPhotographerDownloads(database, session, {
        limit: query.limit ?? 24,
        offset: query.offset ?? 0,
        sort: query.sort ?? "top",
        from: query.from,
        to: query.to,
      }),
    );
  },
);

photographerDownloadRoutes.all(
  "/api/v1/contributor/downloads",
  () => methodNotAllowed(),
);

function db(env: Env) {
  if (!env.DATABASE_URL)
    throw new AppError(
      500,
      "DATABASE_URL_MISSING",
      "Database connection is not configured.",
    );
  return createHttpDb(env.DATABASE_URL);
}
