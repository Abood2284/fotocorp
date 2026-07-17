import { zValidator } from "@hono/zod-validator"
import { getCookie } from "hono/cookie"
import { Hono } from "hono"
import { z } from "zod"

import type { Env } from "../../../appTypes"
import { createHttpDb, type AppRequestVariables } from "../../../db"
import { AppError } from "../../../lib/errors"
import { json } from "../../../lib/http"
import { methodNotAllowed } from "../../../lib/route-errors"
import { listCaricatureCategories } from "../../../lib/caricatures/caricature-categories"
import {
  createAdminCaricatureAsset,
  listContributorCaricatureAssets,
  requireContributorOwnedCaricature,
  updateAdminCaricatureAsset,
} from "../../../lib/caricatures/admin-caricature-assets"
import {
  completeCaricatureOriginalUpload,
  createCaricatureUploadShell,
  presignCaricatureOriginalUpload,
} from "../../../lib/caricatures/caricature-original-upload"
import { getAdminCaricatureOriginalResponse } from "../../../lib/caricatures/caricature-staff-original"
import {
  adminCaricatureAssetMetadataSchema,
  adminCaricatureAssetParamSchema,
  caricatureOriginalCompleteSchema,
  caricatureOriginalPresignSchema,
  caricatureUploadShellSchema,
} from "../../internal/admin-caricature-assets/validators"
import { CARICATURE_ASSET_STATUSES } from "../../../db/schema/caricature-assets"
import {
  CONTRIBUTOR_SESSION_COOKIE,
  requirePhotographerSession,
  type ContributorSessionResult,
} from "../auth/service"

export const contributorCaricatureRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>()

const base = "/api/v1/contributor/caricatures"

const contributorCaricatureListQuerySchema = z.object({
  status: z.enum(CARICATURE_ASSET_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

contributorCaricatureRoutes.get(`${base}/categories`, async (c) => {
  const database = db(c.env)
  await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
  return json(await listCaricatureCategories(database, { activeOnly: true }))
})

contributorCaricatureRoutes.all(`${base}/categories`, () => methodNotAllowed())

contributorCaricatureRoutes.get(
  base,
  zValidator("query", contributorCaricatureListQuerySchema),
  async (c) => {
    const database = db(c.env)
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const query = c.req.valid("query")
    const result = await listContributorCaricatureAssets(database, session.contributor.id, {
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    })
    return json({ ok: true as const, ...result })
  },
)

contributorCaricatureRoutes.post(
  `${base}/upload-shell`,
  zValidator("json", caricatureUploadShellSchema),
  async (c) => {
    const database = db(c.env)
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const payload = c.req.valid("json")
    const contributorId = resolveContributorOwnerId(session, payload.contributorId)
    const created = await createCaricatureUploadShell(database, { ...payload, contributorId }, null)
    return json(created, 201)
  },
)

contributorCaricatureRoutes.all(`${base}/upload-shell`, () => methodNotAllowed())

contributorCaricatureRoutes.post(
  base,
  zValidator("json", adminCaricatureAssetMetadataSchema),
  async (c) => {
    const database = db(c.env)
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const payload = c.req.valid("json")
    const created = await createAdminCaricatureAsset(database, payload, null, {
      contributorId: session.contributor.id,
    })
    return json(created, 201)
  },
)

contributorCaricatureRoutes.get(
  `${base}/:assetId`,
  zValidator("param", adminCaricatureAssetParamSchema),
  async (c) => {
    const database = db(c.env)
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const { assetId } = c.req.valid("param")
    return json(await requireAccessibleCaricature(database, assetId, session))
  },
)

contributorCaricatureRoutes.patch(
  `${base}/:assetId`,
  zValidator("param", adminCaricatureAssetParamSchema),
  zValidator("json", adminCaricatureAssetMetadataSchema),
  async (c) => {
    const database = db(c.env)
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const { assetId } = c.req.valid("param")
    await requireAccessibleCaricature(database, assetId, session)
    const payload = c.req.valid("json")
    return json(await updateAdminCaricatureAsset(database, assetId, payload, null))
  },
)

contributorCaricatureRoutes.post(
  `${base}/:assetId/original/presign`,
  zValidator("param", adminCaricatureAssetParamSchema),
  zValidator("json", caricatureOriginalPresignSchema),
  async (c) => {
    const database = db(c.env)
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const { assetId } = c.req.valid("param")
    await requireAccessibleCaricature(database, assetId, session)
    const payload = c.req.valid("json")
    return json(await presignCaricatureOriginalUpload(database, c.env, assetId, payload))
  },
)

contributorCaricatureRoutes.post(
  `${base}/:assetId/original/complete`,
  zValidator("param", adminCaricatureAssetParamSchema),
  zValidator("json", caricatureOriginalCompleteSchema),
  async (c) => {
    const database = db(c.env)
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const { assetId } = c.req.valid("param")
    await requireAccessibleCaricature(database, assetId, session)
    const payload = c.req.valid("json")
    return json(await completeCaricatureOriginalUpload(database, c.env, assetId, payload))
  },
)

contributorCaricatureRoutes.get(
  `${base}/:assetId/original`,
  zValidator("param", adminCaricatureAssetParamSchema),
  async (c) => {
    const database = db(c.env)
    const session = await requirePhotographerSession(database, getCookie(c, CONTRIBUTOR_SESSION_COOKIE))
    const { assetId } = c.req.valid("param")
    await requireAccessibleCaricature(database, assetId, session)
    return await getAdminCaricatureOriginalResponse(database, c.env, assetId)
  },
)

contributorCaricatureRoutes.all(`${base}/:assetId/original/presign`, () => methodNotAllowed())
contributorCaricatureRoutes.all(`${base}/:assetId/original/complete`, () => methodNotAllowed())
contributorCaricatureRoutes.all(`${base}/:assetId/original`, () => methodNotAllowed())

contributorCaricatureRoutes.all(base, () => methodNotAllowed())
contributorCaricatureRoutes.all(`${base}/:assetId`, () => methodNotAllowed())

async function requireAccessibleCaricature(
  database: ReturnType<typeof db>,
  assetId: string,
  session: ContributorSessionResult,
) {
  return requireContributorOwnedCaricature(database, assetId, session.contributor.id, {
    allowPortalAdmin: session.account.portalRole === "PORTAL_ADMIN",
  })
}

function resolveContributorOwnerId(session: ContributorSessionResult, requestedId: string | undefined) {
  const trimmed = requestedId?.trim()
  if (!trimmed) return session.contributor.id
  if (trimmed === session.contributor.id) return session.contributor.id
  if (session.account.portalRole !== "PORTAL_ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only portal admins can upload caricatures on behalf of another contributor.",
    )
  }
  return trimmed
}

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}
