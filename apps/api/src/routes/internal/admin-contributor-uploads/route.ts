import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { methodNotAllowed } from "../../../lib/route-errors";
import { internalAuthMiddleware } from "../../../middleware/internalAuth";
import {
  approveAdminContributorUploadsService,
  getAdminContributorUploadOriginalService,
  listAdminContributorUploadsService,
  getAdminContributorUploadBatchService,
} from "./service";
import {
  adminContributorUploadApproveBodySchema,
  adminContributorUploadListQuerySchema,
  adminContributorUploadParamSchema,
  adminContributorUploadBatchParamSchema,
} from "./validators";

export const internalAdminContributorUploadRoutes = new Hono<{ Bindings: Env }>();

internalAdminContributorUploadRoutes.use(
  "/api/v1/internal/admin/contributor-uploads",
  internalAuthMiddleware,
);
internalAdminContributorUploadRoutes.use(
  "/api/v1/internal/admin/contributor-uploads/*",
  internalAuthMiddleware,
);

internalAdminContributorUploadRoutes.get(
  "/api/v1/internal/admin/contributor-uploads",
  zValidator("query", adminContributorUploadListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    return await listAdminContributorUploadsService(c.env, query);
  },
);

internalAdminContributorUploadRoutes.post(
  "/api/v1/internal/admin/contributor-uploads/approve",
  zValidator("json", adminContributorUploadApproveBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const requestedByAdminUserId = c.req.header("x-admin-auth-user-id")?.trim() || null;
    return await approveAdminContributorUploadsService(c.env, body, { requestedByAdminUserId });
  },
);

internalAdminContributorUploadRoutes.get(
  "/api/v1/internal/admin/contributor-uploads/:imageAssetId/original",
  zValidator("param", adminContributorUploadParamSchema),
  async (c) => {
    const { imageAssetId } = c.req.valid("param");
    return await getAdminContributorUploadOriginalService(c.env, imageAssetId);
  },
);

internalAdminContributorUploadRoutes.get(
  "/api/v1/internal/admin/contributor-uploads/batches/:batchId",
  zValidator("param", adminContributorUploadBatchParamSchema),
  async (c) => {
    const { batchId } = c.req.valid("param");
    return await getAdminContributorUploadBatchService(c.env, batchId);
  },
);

internalAdminContributorUploadRoutes.all(
  "/api/v1/internal/admin/contributor-uploads",
  () => methodNotAllowed(),
);
internalAdminContributorUploadRoutes.all(
  "/api/v1/internal/admin/contributor-uploads/approve",
  () => methodNotAllowed(),
);
internalAdminContributorUploadRoutes.all(
  "/api/v1/internal/admin/contributor-uploads/:imageAssetId/original",
  () => methodNotAllowed(),
);
internalAdminContributorUploadRoutes.all(
  "/api/v1/internal/admin/contributor-uploads/batches/:batchId",
  () => methodNotAllowed(),
);
