import { Hono } from "hono";
import type { Env } from "../../appTypes";
import { AppError } from "../../lib/errors";
import { methodNotAllowed } from "../../lib/route-errors";
import { getAdminAssetRoute, getIngestionRunRoute, listAdminAssetsRoute, listIngestionRunsRoute } from "./admin/handlers";
import { getAssetRoute, listAssetsRoute } from "./assets/handlers";
import { mediaAccessRoute, originalMediaRoute, previewMediaRoute } from "./media/handlers";
import { searchRoute } from "./search/handlers";
import { AdminService } from "../../services/adminService";
import { CatalogService } from "../../services/catalogService";
import { PreviewService } from "../../services/previewService";
import { FixtureCatalogRepository } from "../../services/repositories/fixtureCatalogRepository";
import { R2StorageService } from "../../services/storage/storageService";

export const legacyFixtureRoutes = new Hono<{ Bindings: Env }>();

const repository = new FixtureCatalogRepository();

legacyFixtureRoutes.get("/assets", async (c) => {
  ensureLegacyFixtureEnabled(c.env);
  const { catalogService } = createLegacyFixtureServices(c.env);
  return await listAssetsRoute(catalogService);
});

legacyFixtureRoutes.all("/assets", () => methodNotAllowed());

legacyFixtureRoutes.get("/assets/*", async (c) => {
  ensureLegacyFixtureEnabled(c.env);
  const { catalogService } = createLegacyFixtureServices(c.env);
  return await getAssetRoute(catalogService, decodeLegacyParam(c.req.param("*")));
});

legacyFixtureRoutes.all("/assets/*", () => methodNotAllowed());

legacyFixtureRoutes.get("/search", async (c) => {
  ensureLegacyFixtureEnabled(c.env);
  const { catalogService } = createLegacyFixtureServices(c.env);
  return await searchRoute(catalogService, c.req.raw);
});

legacyFixtureRoutes.all("/search", () => methodNotAllowed());

legacyFixtureRoutes.get("/media/preview/*", async (c) => {
  ensureLegacyFixtureEnabled(c.env);
  return await previewMediaRoute(decodeLegacyParam(c.req.param("*")));
});

legacyFixtureRoutes.all("/media/preview/*", () => methodNotAllowed());

legacyFixtureRoutes.get("/media/access/*", async (c) => {
  ensureLegacyFixtureEnabled(c.env);
  return await mediaAccessRoute(decodeLegacyParam(c.req.param("*")));
});

legacyFixtureRoutes.all("/media/access/*", () => methodNotAllowed());

legacyFixtureRoutes.get("/media/original/*", async (c) => {
  ensureLegacyFixtureEnabled(c.env);
  return await originalMediaRoute(decodeLegacyParam(c.req.param("*")));
});

legacyFixtureRoutes.all("/media/original/*", () => methodNotAllowed());

legacyFixtureRoutes.get("/admin/assets", async (c) => {
  ensureLegacyFixtureEnabled(c.env);
  const { adminService } = createLegacyFixtureServices(c.env);
  return await listAdminAssetsRoute(adminService);
});

legacyFixtureRoutes.all("/admin/assets", () => methodNotAllowed());

legacyFixtureRoutes.get("/admin/assets/*", async (c) => {
  ensureLegacyFixtureEnabled(c.env);
  const { adminService } = createLegacyFixtureServices(c.env);
  return await getAdminAssetRoute(adminService, decodeLegacyParam(c.req.param("*")));
});

legacyFixtureRoutes.all("/admin/assets/*", () => methodNotAllowed());

legacyFixtureRoutes.get("/admin/ingestion/runs", async (c) => {
  ensureLegacyFixtureEnabled(c.env);
  const { adminService } = createLegacyFixtureServices(c.env);
  return await listIngestionRunsRoute(adminService);
});

legacyFixtureRoutes.all("/admin/ingestion/runs", () => methodNotAllowed());

legacyFixtureRoutes.get("/admin/ingestion/runs/*", async (c) => {
  ensureLegacyFixtureEnabled(c.env);
  const { adminService } = createLegacyFixtureServices(c.env);
  return await getIngestionRunRoute(adminService, decodeLegacyParam(c.req.param("*")));
});

legacyFixtureRoutes.all("/admin/ingestion/runs/*", () => methodNotAllowed());

function createLegacyFixtureServices(env: Env) {
  const previewStorageService = new R2StorageService(env.MEDIA_PREVIEWS_BUCKET);
  const previewService = new PreviewService(previewStorageService);
  return {
    catalogService: new CatalogService(repository, previewService),
    adminService: new AdminService(repository, previewService),
  };
}

function decodeLegacyParam(value: string | undefined): string {
  return decodeURIComponent(value ?? "");
}

function ensureLegacyFixtureEnabled(env: Env) {
  const value = env.LEGACY_FIXTURE_ROUTES_ENABLED?.trim().toLowerCase();
  if (!value || value === "1" || value === "true" || value === "yes") return;
  throw new AppError(410, "LEGACY_FIXTURE_ROUTES_DISABLED", "Legacy fixture routes are disabled.");
}
