import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"

import type { Env } from "../../../appTypes"
import { createHttpDb } from "../../../db"
import { getAdminCaricatureOriginalResponse } from "../../../lib/caricatures/caricature-staff-original"
import {
  assertCaricatureIsPubliclyPublished,
  assertSubscriberHasActiveCaricatureAccess,
} from "../../../lib/caricatures/caricature-clear-preview-access"
import { AppError } from "../../../lib/errors"
import { errorResponse } from "../../../lib/http"
import { methodNotAllowed } from "../../../lib/route-errors"
import { internalAuthMiddleware } from "../../../middleware/internalAuth"

const base = "/api/v1/internal/caricatures"
const paramSchema = z.object({
  assetId: z.uuid(),
})

export const internalCaricatureClearPreviewRoutes = new Hono<{ Bindings: Env }>()

internalCaricatureClearPreviewRoutes.use(`${base}/*`, internalAuthMiddleware)

internalCaricatureClearPreviewRoutes.get(
  `${base}/:assetId/clear-preview`,
  zValidator("param", paramSchema),
  async (c) => {
    try {
      if (!c.env.DATABASE_URL) {
        throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
      }

      const { assetId } = c.req.valid("param")
      const authUserId = c.req.header("x-auth-user-id")?.trim() || null
      const staffActorId = c.req.header("x-admin-auth-user-id")?.trim() || null

      if (!authUserId && !staffActorId) {
        throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.")
      }

      const db = createHttpDb(c.env.DATABASE_URL)

      if (authUserId) {
        await assertSubscriberHasActiveCaricatureAccess(db, authUserId)
        await assertCaricatureIsPubliclyPublished(db, assetId)
      }

      return await getAdminCaricatureOriginalResponse(db, c.env, assetId)
    } catch (error) {
      if (error instanceof AppError) return errorResponse(error)
      throw error
    }
  },
)

internalCaricatureClearPreviewRoutes.all(`${base}/:assetId/clear-preview`, () => methodNotAllowed())
