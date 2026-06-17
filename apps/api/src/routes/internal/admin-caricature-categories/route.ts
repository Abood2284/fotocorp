import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"

import type { Env } from "../../../appTypes"
import { methodNotAllowed } from "../../../lib/route-errors"
import { internalAuthMiddleware } from "../../../middleware/internalAuth"
import { listAdminCaricatureCategoriesService } from "./service"

const base = "/api/v1/internal/admin/caricature-categories"

const listQuerySchema = z.object({
  activeOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value !== "false"),
})

export const internalAdminCaricatureCategoriesRoutes = new Hono<{ Bindings: Env }>()

internalAdminCaricatureCategoriesRoutes.use(`${base}*`, internalAuthMiddleware)

internalAdminCaricatureCategoriesRoutes.get(
  base,
  zValidator("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    return await listAdminCaricatureCategoriesService(c.env, { activeOnly: query.activeOnly })
  },
)

internalAdminCaricatureCategoriesRoutes.all(base, () => methodNotAllowed())
