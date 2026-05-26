import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { methodNotAllowed } from "../../../lib/route-errors";
import { internalAuthMiddleware } from "../../../middleware/internalAuth";
import {
  actorFromRequest,
  adminAssetDetailService,
  adminAssetOriginalService,
  adminAssetPreviewService,
  adminAssetPublishStateService,
  adminAssetPublishStateBulkService,
  adminAssetUpdateService,
  adminAssetUpdateBulkService,
  adminFiltersService,
  adminStatsService,
  adminMediaPipelineStatusService,
  adminUserSubscriptionService,
  adminUserDetailService,
  adminUserRoleService,
  adminUserStatusService,
  adminUserSubscriptionDetailService,
  adminUsersService,
  listAdminAssetsService,
  normalizeKeywords,
  nullable,
} from "./service";
import {
  adminAssetParamSchema,
  adminAssetUpdateSchema,
  adminPreviewQuerySchema,
  adminPublishStateSchema,
  adminUserParamSchema,
  adminUserRoleSchema,
  adminUserStatusSchema,
  adminUserSubscriptionDetailSchema,
  adminUserSubscriptionSchema,
  adminBulkEditorialSchema,
  adminBulkPublishStateSchema,
} from "./validators";

export const internalAdminRoutes = new Hono<{ Bindings: Env }>();

internalAdminRoutes.use("/api/v1/internal/admin/*", internalAuthMiddleware);

internalAdminRoutes.get("/api/v1/internal/admin/assets", async (c) => {
  return await listAdminAssetsService(c.env, c.req.raw);
});

internalAdminRoutes.all("/api/v1/internal/admin/assets", () => methodNotAllowed());

internalAdminRoutes.patch(
  "/api/v1/internal/admin/assets/bulk/editorial",
  zValidator("json", adminBulkEditorialSchema),
  async (c) => {
    const body = c.req.valid("json");
    return await adminAssetUpdateBulkService(c.env, body, actorFromRequest(c.req.raw));
  },
);

internalAdminRoutes.all("/api/v1/internal/admin/assets/bulk/editorial", () => methodNotAllowed());

internalAdminRoutes.post(
  "/api/v1/internal/admin/assets/bulk/publish-state",
  zValidator("json", adminBulkPublishStateSchema),
  async (c) => {
    const body = c.req.valid("json");
    return await adminAssetPublishStateBulkService(c.env, body, actorFromRequest(c.req.raw));
  },
);

internalAdminRoutes.all("/api/v1/internal/admin/assets/bulk/publish-state", () => methodNotAllowed());

internalAdminRoutes.post(
  "/api/v1/internal/admin/assets/:assetId/publish-state",
  zValidator("param", adminAssetParamSchema),
  zValidator("json", adminPublishStateSchema),
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    return await adminAssetPublishStateService(c.env, params.assetId, body, actorFromRequest(c.req.raw));
  },
);

internalAdminRoutes.all("/api/v1/internal/admin/assets/:assetId/publish-state", () => methodNotAllowed());

internalAdminRoutes.get(
  "/api/v1/internal/admin/assets/:assetId/original",
  zValidator("param", adminAssetParamSchema),
  async (c) => {
    const params = c.req.valid("param");
    return await adminAssetOriginalService(c.env, params.assetId, actorFromRequest(c.req.raw));
  },
);

internalAdminRoutes.all("/api/v1/internal/admin/assets/:assetId/original", () => methodNotAllowed());

internalAdminRoutes.get(
  "/api/v1/internal/admin/assets/:assetId/preview",
  zValidator("param", adminAssetParamSchema),
  zValidator("query", adminPreviewQuerySchema),
  async (c) => {
    const params = c.req.valid("param");
    const query = c.req.valid("query");
    return await adminAssetPreviewService(c.env, params.assetId, query.variant);
  },
);

internalAdminRoutes.all("/api/v1/internal/admin/assets/:assetId/preview", () => methodNotAllowed());

internalAdminRoutes.get(
  "/api/v1/internal/admin/assets/:assetId",
  zValidator("param", adminAssetParamSchema),
  async (c) => {
    const params = c.req.valid("param");
    return await adminAssetDetailService(c.env, params.assetId);
  },
);

internalAdminRoutes.patch(
  "/api/v1/internal/admin/assets/:assetId",
  zValidator("param", adminAssetParamSchema),
  zValidator("json", adminAssetUpdateSchema),
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    return await adminAssetUpdateService(
      c.env,
      params.assetId,
      {
        caption: nullable(body.caption),
        headline: nullable(body.headline),
        description: nullable(body.description),
        keywords: normalizeKeywords(body.keywords),
        categoryId: body.categoryId ?? null,
        eventId: body.eventId ?? null,
        contributorId: body.contributorId ?? null,
      },
      actorFromRequest(c.req.raw),
    );
  },
);

internalAdminRoutes.all("/api/v1/internal/admin/assets/:assetId", () => methodNotAllowed());

internalAdminRoutes.get("/api/v1/internal/admin/catalog/stats", async (c) => {
  return await adminStatsService(c.env);
});

internalAdminRoutes.all("/api/v1/internal/admin/catalog/stats", () => methodNotAllowed());

internalAdminRoutes.get("/api/v1/internal/admin/media-pipeline/status", async (c) => {
  return await adminMediaPipelineStatusService(c.env);
});

internalAdminRoutes.all("/api/v1/internal/admin/media-pipeline/status", () => methodNotAllowed());

internalAdminRoutes.get("/api/v1/internal/admin/filters", async (c) => {
  return await adminFiltersService(c.env);
});

internalAdminRoutes.all("/api/v1/internal/admin/filters", () => methodNotAllowed());

internalAdminRoutes.get("/api/v1/internal/admin/users", async (c) => {
  return await adminUsersService(c.env, c.req.raw);
});

internalAdminRoutes.all("/api/v1/internal/admin/users", () => methodNotAllowed());

internalAdminRoutes.patch(
  "/api/v1/internal/admin/users/:authUserId/subscription",
  zValidator("param", adminUserParamSchema),
  zValidator("json", adminUserSubscriptionSchema),
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    return await adminUserSubscriptionService(c.env, params.authUserId, body.isSubscriber, actorFromRequest(c.req.raw));
  },
);

internalAdminRoutes.all("/api/v1/internal/admin/users/:authUserId/subscription", () => methodNotAllowed());

internalAdminRoutes.get(
  "/api/v1/internal/admin/users/:authUserId",
  zValidator("param", adminUserParamSchema),
  async (c) => {
    const params = c.req.valid("param");
    return await adminUserDetailService(c.env, params.authUserId);
  },
);

internalAdminRoutes.all("/api/v1/internal/admin/users/:authUserId", () => methodNotAllowed());

internalAdminRoutes.patch(
  "/api/v1/internal/admin/users/:authUserId/role",
  zValidator("param", adminUserParamSchema),
  zValidator("json", adminUserRoleSchema),
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    return await adminUserRoleService(c.env, params.authUserId, body.role, actorFromRequest(c.req.raw));
  },
);

internalAdminRoutes.all("/api/v1/internal/admin/users/:authUserId/role", () => methodNotAllowed());

internalAdminRoutes.patch(
  "/api/v1/internal/admin/users/:authUserId/status",
  zValidator("param", adminUserParamSchema),
  zValidator("json", adminUserStatusSchema),
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    return await adminUserStatusService(c.env, params.authUserId, body.status, actorFromRequest(c.req.raw));
  },
);

internalAdminRoutes.all("/api/v1/internal/admin/users/:authUserId/status", () => methodNotAllowed());

internalAdminRoutes.patch(
  "/api/v1/internal/admin/users/:authUserId/subscription-detail",
  zValidator("param", adminUserParamSchema),
  zValidator("json", adminUserSubscriptionDetailSchema),
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    return await adminUserSubscriptionDetailService(c.env, params.authUserId, body, actorFromRequest(c.req.raw));
  },
);

internalAdminRoutes.all("/api/v1/internal/admin/users/:authUserId/subscription-detail", () => methodNotAllowed());
