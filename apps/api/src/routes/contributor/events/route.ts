import { zValidator } from "@hono/zod-validator";
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { createHttpDb, type AppRequestVariables } from "../../../db";
import { AppError } from "../../../lib/errors";
import { json } from "../../../lib/http";
import { methodNotAllowed } from "../../../lib/route-errors";
import { CONTRIBUTOR_SESSION_COOKIE, requirePhotographerSession } from "../auth/service";
import {
  createPhotographerEvent,
  getPhotographerEvent,
  listPhotographerEvents,
  patchPhotographerEvent,
} from "./service";
import {
  photographerEventCreateBodySchema,
  photographerEventIdParamSchema,
  photographerEventPatchBodySchema,
  photographerEventsListQuerySchema,
} from "./validators";

export const photographerEventRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

photographerEventRoutes.get(
  "/api/v1/contributor/events",
  zValidator("query", photographerEventsListQuerySchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    return json(await listPhotographerEvents(database, session, c.req.valid("query")));
  },
);

photographerEventRoutes.post(
  "/api/v1/contributor/events",
  zValidator("json", photographerEventCreateBodySchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    return json(await createPhotographerEvent(database, session, c.req.valid("json")), 201);
  },
);

photographerEventRoutes.get(
  "/api/v1/contributor/events/:eventId",
  zValidator("param", photographerEventIdParamSchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    const { eventId } = c.req.valid("param");
    return json(await getPhotographerEvent(database, session, eventId));
  },
);

photographerEventRoutes.patch(
  "/api/v1/contributor/events/:eventId",
  zValidator("param", photographerEventIdParamSchema),
  zValidator("json", photographerEventPatchBodySchema),
  async (c) => {
    const database = db(c.env);
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE));
    const { eventId } = c.req.valid("param");
    return json(await patchPhotographerEvent(database, session, eventId, c.req.valid("json")));
  },
);

photographerEventRoutes.all("/api/v1/contributor/events", () => methodNotAllowed());
photographerEventRoutes.all("/api/v1/contributor/events/:eventId", () => methodNotAllowed());

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  return createHttpDb(env.DATABASE_URL);
}
