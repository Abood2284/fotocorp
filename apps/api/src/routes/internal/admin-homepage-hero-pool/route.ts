import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Env } from "../../../appTypes"
import { methodNotAllowed } from "../../../lib/route-errors"
import { internalAuthMiddleware } from "../../../middleware/internalAuth"
import {
  homepageHeroPoolCandidatesQuerySchema,
  homepageHeroPoolReplaceSchema,
} from "./validators"
import {
  actorFromRequest,
  getHomepageHeroPoolService,
  listHomepageHeroPoolCandidatesService,
  replaceHomepageHeroPoolService,
} from "./service"

export const internalAdminHomepageHeroPoolRoutes = new Hono<{ Bindings: Env }>()

internalAdminHomepageHeroPoolRoutes.use(
  "/api/v1/internal/admin/homepage-hero-pool*",
  internalAuthMiddleware,
)

internalAdminHomepageHeroPoolRoutes.get("/api/v1/internal/admin/homepage-hero-pool", async (c) => {
  return await getHomepageHeroPoolService(c.env)
})

internalAdminHomepageHeroPoolRoutes.put(
  "/api/v1/internal/admin/homepage-hero-pool",
  zValidator("json", homepageHeroPoolReplaceSchema),
  async (c) => {
    const body = c.req.valid("json")
    const actor = actorFromRequest(c.req.raw)
    return await replaceHomepageHeroPoolService(c.env, body, actor, c.req.raw)
  },
)

internalAdminHomepageHeroPoolRoutes.get(
  "/api/v1/internal/admin/homepage-hero-pool/candidates",
  zValidator("query", homepageHeroPoolCandidatesQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    return await listHomepageHeroPoolCandidatesService(c.env, query)
  },
)

internalAdminHomepageHeroPoolRoutes.all("/api/v1/internal/admin/homepage-hero-pool", () => methodNotAllowed())

internalAdminHomepageHeroPoolRoutes.all(
  "/api/v1/internal/admin/homepage-hero-pool/candidates",
  () => methodNotAllowed(),
)
