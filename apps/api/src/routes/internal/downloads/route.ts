import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import type { Env } from "../../../appTypes"
import { methodNotAllowed } from "../../../lib/route-errors"
import { internalAuthMiddleware } from "../../../middleware/internalAuth"
import { internalSubscriberAssetDownloadCheckService, internalSubscriberAssetDownloadService } from "./service"

const downloadParamSchema = z.object({
  assetId: z.uuid(),
})

export const internalDownloadRoutes = new Hono<{ Bindings: Env }>()

internalDownloadRoutes.use("/api/v1/internal/assets/*", internalAuthMiddleware)

internalDownloadRoutes.post(
  "/api/v1/internal/assets/:assetId/download/check",
  zValidator("param", downloadParamSchema),
  async (c) => {
    const params = c.req.valid("param")
    return internalSubscriberAssetDownloadCheckService(c.req.raw, c.env, params.assetId)
  },
)

internalDownloadRoutes.post(
  "/api/v1/internal/assets/:assetId/download",
  zValidator("param", downloadParamSchema),
  async (c) => {
    const params = c.req.valid("param")
    return internalSubscriberAssetDownloadService(c.req.raw, c.env, params.assetId)
  },
)

internalDownloadRoutes.all("/api/v1/internal/assets/:assetId/download/check", () => methodNotAllowed())
internalDownloadRoutes.all("/api/v1/internal/assets/:assetId/download", () => methodNotAllowed())
