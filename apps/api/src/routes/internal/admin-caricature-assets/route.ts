import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import type { Env } from "../../../appTypes"
import { methodNotAllowed } from "../../../lib/route-errors"
import { internalAuthMiddleware } from "../../../middleware/internalAuth"
import {
  actorStaffIdFromRequest,
  createAdminCaricatureAssetService,
  getAdminCaricatureAssetByIdService,
  listAdminCaricatureAssetsService,
  updateAdminCaricatureAssetService,
} from "./service"
import {
  adminCaricatureAssetListQuerySchema,
  adminCaricatureAssetMetadataSchema,
  adminCaricatureAssetParamSchema,
} from "./validators"

const base = "/api/v1/internal/admin/caricature-assets"

export const internalAdminCaricatureAssetsRoutes = new Hono<{ Bindings: Env }>()

internalAdminCaricatureAssetsRoutes.use(`${base}*`, internalAuthMiddleware)

internalAdminCaricatureAssetsRoutes.get(
  base,
  zValidator("query", adminCaricatureAssetListQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    return await listAdminCaricatureAssetsService(c.env, query)
  },
)

internalAdminCaricatureAssetsRoutes.post(
  base,
  zValidator("json", adminCaricatureAssetMetadataSchema),
  async (c) => {
    const payload = c.req.valid("json")
    const actorStaffId = actorStaffIdFromRequest(c.req.raw)
    return await createAdminCaricatureAssetService(c.env, payload, actorStaffId)
  },
)

internalAdminCaricatureAssetsRoutes.all(base, () => methodNotAllowed())

internalAdminCaricatureAssetsRoutes.get(
  `${base}/:assetId`,
  zValidator("param", adminCaricatureAssetParamSchema),
  async (c) => {
    const { assetId } = c.req.valid("param")
    return await getAdminCaricatureAssetByIdService(c.env, assetId)
  },
)

internalAdminCaricatureAssetsRoutes.patch(
  `${base}/:assetId`,
  zValidator("param", adminCaricatureAssetParamSchema),
  zValidator("json", adminCaricatureAssetMetadataSchema),
  async (c) => {
    const { assetId } = c.req.valid("param")
    const payload = c.req.valid("json")
    const actorStaffId = actorStaffIdFromRequest(c.req.raw)
    return await updateAdminCaricatureAssetService(c.env, assetId, payload, actorStaffId)
  },
)

internalAdminCaricatureAssetsRoutes.all(`${base}/:assetId`, () => methodNotAllowed())
