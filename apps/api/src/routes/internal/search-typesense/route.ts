import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import type { Env } from "../../../appTypes"
import { methodNotAllowed } from "../../../lib/route-errors"
import { internalAuthMiddleware } from "../../../middleware/internalAuth"
import {
  deleteTypesenseEventService,
  syncTypesenseAssetService,
  syncTypesenseCaricatureService,
  syncTypesenseEventService,
} from "./service"
import {
  typesenseDeleteEventBodySchema,
  typesenseSyncAssetBodySchema,
  typesenseSyncCaricatureBodySchema,
  typesenseSyncEventBodySchema,
} from "./validators"

export const internalSearchTypesenseRoutes = new Hono<{ Bindings: Env }>()

internalSearchTypesenseRoutes.use("/api/v1/internal/search/typesense/*", internalAuthMiddleware)

internalSearchTypesenseRoutes.post(
  "/api/v1/internal/search/typesense/sync-asset",
  zValidator("json", typesenseSyncAssetBodySchema),
  async (c) => {
    const body = c.req.valid("json")
    return await syncTypesenseAssetService(c.env, body)
  },
)
internalSearchTypesenseRoutes.all("/api/v1/internal/search/typesense/sync-asset", () => methodNotAllowed())

internalSearchTypesenseRoutes.post(
  "/api/v1/internal/search/typesense/sync-event",
  zValidator("json", typesenseSyncEventBodySchema),
  async (c) => {
    const body = c.req.valid("json")
    return await syncTypesenseEventService(c.env, body)
  },
)
internalSearchTypesenseRoutes.all("/api/v1/internal/search/typesense/sync-event", () => methodNotAllowed())

internalSearchTypesenseRoutes.post(
  "/api/v1/internal/search/typesense/sync-caricature",
  zValidator("json", typesenseSyncCaricatureBodySchema),
  async (c) => {
    const body = c.req.valid("json")
    return await syncTypesenseCaricatureService(c.env, body)
  },
)
internalSearchTypesenseRoutes.all("/api/v1/internal/search/typesense/sync-caricature", () => methodNotAllowed())

internalSearchTypesenseRoutes.post(
  "/api/v1/internal/search/typesense/delete-event",
  zValidator("json", typesenseDeleteEventBodySchema),
  async (c) => {
    const body = c.req.valid("json")
    return await deleteTypesenseEventService(c.env, body)
  },
)
internalSearchTypesenseRoutes.all("/api/v1/internal/search/typesense/delete-event", () => methodNotAllowed())
