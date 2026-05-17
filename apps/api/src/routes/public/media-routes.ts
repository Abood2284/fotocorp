import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../../appTypes";
import { createHttpDb, type AppRequestVariables } from "../../db";
import { AppError } from "../../lib/errors";
import { errorResponse } from "../../lib/http";
import { securePreviewMediaRoute } from "../secureMedia";
import { isStablePreviewVariant, stablePreviewMediaRoute } from "./stable-preview-media";

export const publicMediaRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

type StablePreviewContext = Context<{ Bindings: Env; Variables: AppRequestVariables }>;

async function stablePreviewHandler(c: StablePreviewContext) {
  if (!c.env.DATABASE_URL) {
    throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured");
  }

  const variantParam = c.req.param("variant") ?? "";
  const assetId = c.req.param("assetId") ?? "";
  if (!isStablePreviewVariant(variantParam)) {
    return errorResponse(
      new AppError(400, "INVALID_VARIANT", "Unsupported preview variant."),
    );
  }

  const pathname = new URL(c.req.url).pathname;
  return stablePreviewMediaRoute({
    request: c.req.raw,
    env: c.env,
    db: createHttpDb(c.env.DATABASE_URL),
    assetId,
    variantParam,
    requestId: c.get("requestId"),
    route: pathname,
  });
}

publicMediaRoutes.get("/api/media/assets/:assetId/preview/:variant", stablePreviewHandler);
publicMediaRoutes.all("/api/media/assets/:assetId/preview/:variant", () =>
  errorResponse(new AppError(405, "METHOD_NOT_ALLOWED", "Method is not allowed for this route.")),
);

publicMediaRoutes.get("/api/v1/media/assets/:assetId/preview/:variant", stablePreviewHandler);
publicMediaRoutes.all("/api/v1/media/assets/:assetId/preview/:variant", () =>
  errorResponse(new AppError(405, "METHOD_NOT_ALLOWED", "Method is not allowed for this route.")),
);

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
