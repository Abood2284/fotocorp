import { Hono } from "hono";
import type { Env } from "../../appTypes";
import { createHttpDb } from "../../db";
import { getPublicAssetCollections, getPublicAssetDetail, getPublicAssetEvents, getPublicAssetFilters, listPublicAssets, parsePreviewTtl } from "../../lib/assets/public-assets";
import { AppError } from "../../lib/errors";
import { json } from "../../lib/http";
import { methodNotAllowed } from "../../lib/route-errors";

export const publicCatalogRoutes = new Hono<{ Bindings: Env }>();

publicCatalogRoutes.get("/api/v1/assets", async (c) => {
  return json(
    await listPublicAssets(
      db(c.env),
      {
        q: c.req.query("q"),
        categoryId: c.req.query("categoryId"),
        eventId: c.req.query("eventId"),
        contributorId: c.req.query("contributorId") ?? c.req.query("photographerId"),
        year: c.req.query("year"),
        month: c.req.query("month"),
        sort: c.req.query("sort"),
        cursor: c.req.query("cursor"),
        limit: c.req.query("limit"),
      },
      c.env.MEDIA_PREVIEW_TOKEN_SECRET,
      ttl(c.env),
    ),
  );
});

publicCatalogRoutes.all("/api/v1/assets", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/assets/filters", async (c) => {
  return json(await getPublicAssetFilters(db(c.env)));
});

publicCatalogRoutes.all("/api/v1/assets/filters", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/assets/collections", async (c) => {
  return json(
    await getPublicAssetCollections(
      db(c.env),
      c.env.MEDIA_PREVIEW_TOKEN_SECRET,
      ttl(c.env),
    ),
  );
});

publicCatalogRoutes.all("/api/v1/assets/collections", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/assets/events", async (c) => {
  return json(
    await getPublicAssetEvents(
      db(c.env),
      c.env.MEDIA_PREVIEW_TOKEN_SECRET,
      ttl(c.env),
    ),
  );
});

publicCatalogRoutes.all("/api/v1/assets/events", () => methodNotAllowed());

publicCatalogRoutes.get("/api/v1/assets/:assetId", async (c) => {
  return json(
    await getPublicAssetDetail(
      db(c.env),
      c.req.param("assetId"),
      c.env.MEDIA_PREVIEW_TOKEN_SECRET,
      ttl(c.env),
    ),
  );
});

publicCatalogRoutes.all("/api/v1/assets/:assetId", () => methodNotAllowed());

function db(env: Env) {
  if (!env.DATABASE_URL) {
    throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  }
  return createHttpDb(env.DATABASE_URL);
}

function ttl(env: Env) {
  return parsePreviewTtl(env.MEDIA_PREVIEW_TOKEN_TTL_SECONDS);
}
