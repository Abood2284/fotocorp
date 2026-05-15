import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Env } from "../../../appTypes"
import { methodNotAllowed } from "../../../lib/route-errors"
import { internalAuthMiddleware } from "../../../middleware/internalAuth"
import {
  adminEventParamSchema,
  adminEventListQuerySchema,
  adminEventUpdateSchema,
  adminEventPurgeSchema,
} from "./validators"
import {
  actorFromRequest,
  listAdminEventsService,
  getAdminEventByIdService,
  updateAdminEventService,
  purgeAdminEventService,
} from "./service"

export const internalAdminEventsRoutes = new Hono<{ Bindings: Env }>()

internalAdminEventsRoutes.use("/api/v1/internal/admin/events*", internalAuthMiddleware)

internalAdminEventsRoutes.get("/api/v1/internal/admin/events", zValidator("query", adminEventListQuerySchema), async (c) => {
  const query = c.req.valid("query")
  return await listAdminEventsService(c.env, query)
})
internalAdminEventsRoutes.all("/api/v1/internal/admin/events", () => methodNotAllowed())

internalAdminEventsRoutes.get("/api/v1/internal/admin/events/:eventId", zValidator("param", adminEventParamSchema), async (c) => {
  const { eventId } = c.req.valid("param")
  return await getAdminEventByIdService(c.env, eventId)
})

internalAdminEventsRoutes.patch(
  "/api/v1/internal/admin/events/:eventId",
  zValidator("param", adminEventParamSchema),
  zValidator("json", adminEventUpdateSchema),
  async (c) => {
    const { eventId } = c.req.valid("param")
    const payload = c.req.valid("json")
    return await updateAdminEventService(c.env, eventId, payload)
  }
)
internalAdminEventsRoutes.all("/api/v1/internal/admin/events/:eventId", () => methodNotAllowed())

internalAdminEventsRoutes.post(
  "/api/v1/internal/admin/events/:eventId/purge",
  zValidator("param", adminEventParamSchema),
  zValidator("json", adminEventPurgeSchema),
  async (c) => {
    const { eventId } = c.req.valid("param")
    const payload = c.req.valid("json")
    const actor = actorFromRequest(c.req.raw)
    return await purgeAdminEventService(c.env, eventId, payload, actor)
  }
)
internalAdminEventsRoutes.all("/api/v1/internal/admin/events/:eventId/purge", () => methodNotAllowed())
