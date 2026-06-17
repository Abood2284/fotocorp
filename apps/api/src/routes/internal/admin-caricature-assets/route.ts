import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import type { Env } from "../../../appTypes"
import { methodNotAllowed } from "../../../lib/route-errors"
import { internalAuthMiddleware } from "../../../middleware/internalAuth"
import {
  actorStaffIdFromRequest,
  approveCaricatureAssetService,
  completeCaricatureOriginalUploadService,
  createAdminCaricatureAssetService,
  createCaricatureUploadShellService,
  getAdminCaricatureAssetByIdService,
  getAdminCaricatureOriginalService,
  listAdminCaricatureAssetsService,
  presignCaricatureOriginalUploadService,
  queueCaricaturePreviewsService,
  rejectCaricatureAssetService,
  updateAdminCaricatureAssetService,
} from "./service"
import {
  adminCaricatureAssetListQuerySchema,
  adminCaricatureAssetMetadataSchema,
  adminCaricatureAssetParamSchema,
  caricatureOriginalCompleteSchema,
  caricatureOriginalPresignSchema,
  caricatureUploadShellSchema,
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

internalAdminCaricatureAssetsRoutes.post(
  `${base}/upload-shell`,
  zValidator("json", caricatureUploadShellSchema),
  async (c) => {
    const payload = c.req.valid("json")
    const actorStaffId = actorStaffIdFromRequest(c.req.raw)
    return await createCaricatureUploadShellService(c.env, payload, actorStaffId)
  },
)

internalAdminCaricatureAssetsRoutes.all(`${base}/upload-shell`, () => methodNotAllowed())

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

internalAdminCaricatureAssetsRoutes.post(
  `${base}/:assetId/original/presign`,
  zValidator("param", adminCaricatureAssetParamSchema),
  zValidator("json", caricatureOriginalPresignSchema),
  async (c) => {
    const { assetId } = c.req.valid("param")
    const payload = c.req.valid("json")
    return await presignCaricatureOriginalUploadService(c.env, assetId, payload)
  },
)

internalAdminCaricatureAssetsRoutes.post(
  `${base}/:assetId/original/complete`,
  zValidator("param", adminCaricatureAssetParamSchema),
  zValidator("json", caricatureOriginalCompleteSchema),
  async (c) => {
    const { assetId } = c.req.valid("param")
    const payload = c.req.valid("json")
    return await completeCaricatureOriginalUploadService(c.env, assetId, payload)
  },
)

internalAdminCaricatureAssetsRoutes.all(`${base}/:assetId/original/presign`, () => methodNotAllowed())
internalAdminCaricatureAssetsRoutes.all(`${base}/:assetId/original/complete`, () => methodNotAllowed())

internalAdminCaricatureAssetsRoutes.post(
  `${base}/:assetId/generate-previews`,
  zValidator("param", adminCaricatureAssetParamSchema),
  async (c) => {
    const { assetId } = c.req.valid("param")
    const actorStaffId = actorStaffIdFromRequest(c.req.raw)
    return await queueCaricaturePreviewsService(c.env, assetId, actorStaffId, c.executionCtx)
  },
)

internalAdminCaricatureAssetsRoutes.post(
  `${base}/:assetId/approve`,
  zValidator("param", adminCaricatureAssetParamSchema),
  async (c) => {
    const { assetId } = c.req.valid("param")
    const actorStaffId = actorStaffIdFromRequest(c.req.raw)
    return await approveCaricatureAssetService(c.env, assetId, actorStaffId, c.executionCtx)
  },
)

internalAdminCaricatureAssetsRoutes.post(
  `${base}/:assetId/reject`,
  zValidator("param", adminCaricatureAssetParamSchema),
  async (c) => {
    const { assetId } = c.req.valid("param")
    const actorStaffId = actorStaffIdFromRequest(c.req.raw)
    return await rejectCaricatureAssetService(c.env, assetId, actorStaffId)
  },
)

internalAdminCaricatureAssetsRoutes.all(`${base}/:assetId/approve`, () => methodNotAllowed())
internalAdminCaricatureAssetsRoutes.all(`${base}/:assetId/reject`, () => methodNotAllowed())

internalAdminCaricatureAssetsRoutes.all(`${base}/:assetId/generate-previews`, () => methodNotAllowed())

internalAdminCaricatureAssetsRoutes.get(
  `${base}/:assetId/original`,
  zValidator("param", adminCaricatureAssetParamSchema),
  async (c) => {
    const { assetId } = c.req.valid("param")
    return await getAdminCaricatureOriginalService(c.env, assetId)
  },
)

internalAdminCaricatureAssetsRoutes.all(`${base}/:assetId/original`, () => methodNotAllowed())

internalAdminCaricatureAssetsRoutes.all(`${base}/:assetId`, () => methodNotAllowed())
