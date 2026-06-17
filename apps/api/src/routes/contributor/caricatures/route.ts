import { zValidator } from "@hono/zod-validator"
import { getCookie } from "hono/cookie"
import { Hono } from "hono"

import type { Env } from "../../../appTypes"
import { createHttpDb, type AppRequestVariables } from "../../../db"
import { AppError } from "../../../lib/errors"
import { json } from "../../../lib/http"
import { methodNotAllowed } from "../../../lib/route-errors"
import { listCaricatureCategories } from "../../../lib/caricatures/caricature-categories"
import {
  createAdminCaricatureAsset,
  getAdminCaricatureAssetById,
  updateAdminCaricatureAsset,
} from "../../../lib/caricatures/admin-caricature-assets"
import {
  adminCaricatureAssetMetadataSchema,
  adminCaricatureAssetParamSchema,
} from "../../internal/admin-caricature-assets/validators"
import { CONTRIBUTOR_SESSION_COOKIE, requirePhotographerSession } from "../auth/service"

export const contributorCaricatureRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>()

const base = "/api/v1/contributor/caricatures"

contributorCaricatureRoutes.get(`${base}/categories`, async (c) => {
  const database = db(c.env)
  await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
  return json(await listCaricatureCategories(database, { activeOnly: true }))
})

contributorCaricatureRoutes.all(`${base}/categories`, () => methodNotAllowed())

contributorCaricatureRoutes.post(
  base,
  zValidator("json", adminCaricatureAssetMetadataSchema),
  async (c) => {
    const database = db(c.env)
    await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const payload = c.req.valid("json")
    const created = await createAdminCaricatureAsset(database, payload, null)
    return json(created, 201)
  },
)

contributorCaricatureRoutes.get(
  `${base}/:assetId`,
  zValidator("param", adminCaricatureAssetParamSchema),
  async (c) => {
    const database = db(c.env)
    await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const { assetId } = c.req.valid("param")
    const asset = await getAdminCaricatureAssetById(database, assetId)
    if (!asset) throw new AppError(404, "CARICATURE_NOT_FOUND", "Caricature not found.")
    return json(asset)
  },
)

contributorCaricatureRoutes.patch(
  `${base}/:assetId`,
  zValidator("param", adminCaricatureAssetParamSchema),
  zValidator("json", adminCaricatureAssetMetadataSchema),
  async (c) => {
    const database = db(c.env)
    await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const { assetId } = c.req.valid("param")
    const payload = c.req.valid("json")
    return json(await updateAdminCaricatureAsset(database, assetId, payload, null))
  },
)

contributorCaricatureRoutes.all(base, () => methodNotAllowed())
contributorCaricatureRoutes.all(`${base}/:assetId`, () => methodNotAllowed())

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}
