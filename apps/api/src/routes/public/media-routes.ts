import { Hono } from "hono";
import type { Env } from "../../appTypes";
import { createHttpDb } from "../../db";
import { AppError } from "../../lib/errors";
import { errorResponse } from "../../lib/http";
import { securePreviewMediaRoute } from "../secureMedia";

export const publicMediaRoutes = new Hono<{ Bindings: Env }>();

publicMediaRoutes.get("/api/v1/media/assets/:assetId/preview", async (c) => {
  if (!c.env.DATABASE_URL) {
    throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured");
  }

  return await securePreviewMediaRoute({
    request: c.req.raw,
    env: c.env,
    db: createHttpDb(c.env.DATABASE_URL),
    assetId: c.req.param("assetId"),
  });
});

publicMediaRoutes.all("/api/v1/media/assets/:assetId/preview", () => {
  return errorResponse(
    new AppError(405, "METHOD_NOT_ALLOWED", "Method is not allowed for this route."),
  );
});
