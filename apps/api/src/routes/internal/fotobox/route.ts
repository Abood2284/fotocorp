import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import type { Env } from "../../../appTypes"
import { methodNotAllowed } from "../../../lib/route-errors"
import { internalAuthMiddleware } from "../../../middleware/internalAuth"
import { addFotoboxService, listFotoboxService, removeFotoboxService } from "./service"
import { addFotoboxBodySchema, fotoboxAssetParamSchema, fotoboxListQuerySchema, removeFotoboxBodySchema } from "./validators"

export const fotoboxRoutes = new Hono<{ Bindings: Env }>()

fotoboxRoutes.use("/api/v1/internal/fotobox/*", internalAuthMiddleware)

fotoboxRoutes.get(
  "/api/v1/internal/fotobox/items",
  zValidator("query", fotoboxListQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    return listFotoboxService(c.env, query)
  },
)

fotoboxRoutes.post(
  "/api/v1/internal/fotobox/items",
  zValidator("json", addFotoboxBodySchema),
  async (c) => {
    const body = c.req.valid("json")
    return addFotoboxService(c.env, body)
  },
)

fotoboxRoutes.delete(
  "/api/v1/internal/fotobox/items/:assetId",
  zValidator("param", fotoboxAssetParamSchema),
  zValidator("json", removeFotoboxBodySchema),
  async (c) => {
    const params = c.req.valid("param")
    const body = c.req.valid("json")
    return removeFotoboxService(c.env, params.assetId, body)
  },
)

fotoboxRoutes.all("/api/v1/internal/fotobox/items", () => methodNotAllowed())
fotoboxRoutes.all("/api/v1/internal/fotobox/items/:assetId", () => methodNotAllowed())
