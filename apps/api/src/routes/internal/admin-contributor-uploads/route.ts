import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { methodNotAllowed } from "../../../lib/route-errors";
import { internalAuthMiddleware } from "../../../middleware/internalAuth";
import {
  approveAdminContributorUploadsService,
  completeAdminContributorUploadReplaceService,
  getAdminContributorUploadOriginalService,
  getAdminContributorUploadBatchService,
  listAdminContributorUploadsService,
  patchAdminContributorUploadMetadataService,
  presignAdminContributorUploadReplaceService,
  rejectAdminContributorUploadsService,
} from "./service";
import {
  adminContributorUploadApproveBodySchema,
  adminContributorUploadBatchParamSchema,
  adminContributorUploadListQuerySchema,
  adminContributorUploadMetadataPatchBodySchema,
  adminContributorUploadParamSchema,
  adminContributorUploadRejectBodySchema,
  adminContributorUploadReplaceCompleteBodySchema,
  adminContributorUploadReplacePresignBodySchema,
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

internalAdminContributorUploadRoutes.post(
  "/api/v1/internal/admin/contributor-uploads/reject",
  zValidator("json", adminContributorUploadRejectBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    return await rejectAdminContributorUploadsService(c.env, body);
  },
);

internalAdminContributorUploadRoutes.patch(
  "/api/v1/internal/admin/contributor-uploads/:imageAssetId",
  zValidator("param", adminContributorUploadParamSchema),
  zValidator("json", adminContributorUploadMetadataPatchBodySchema),
  async (c) => {
    const { imageAssetId } = c.req.valid("param");
    const body = c.req.valid("json");
    return await patchAdminContributorUploadMetadataService(c.env, imageAssetId, body);
  },
);

internalAdminContributorUploadRoutes.post(
  "/api/v1/internal/admin/contributor-uploads/:imageAssetId/replace-presign",
  zValidator("param", adminContributorUploadParamSchema),
  zValidator("json", adminContributorUploadReplacePresignBodySchema),
  async (c) => {
    const { imageAssetId } = c.req.valid("param");
    const body = c.req.valid("json");
    return await presignAdminContributorUploadReplaceService(c.env, imageAssetId, body);
  },
);

internalAdminContributorUploadRoutes.post(
  "/api/v1/internal/admin/contributor-uploads/:imageAssetId/replace-complete",
  zValidator("param", adminContributorUploadParamSchema),
  zValidator("json", adminContributorUploadReplaceCompleteBodySchema),
  async (c) => {
    const { imageAssetId } = c.req.valid("param");
    const body = c.req.valid("json");
    return await completeAdminContributorUploadReplaceService(c.env, imageAssetId, body);
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
  "/api/v1/internal/admin/contributor-uploads/reject",
  () => methodNotAllowed(),
);
internalAdminContributorUploadRoutes.all(
  "/api/v1/internal/admin/contributor-uploads/:imageAssetId",
  () => methodNotAllowed(),
);
internalAdminContributorUploadRoutes.all(
  "/api/v1/internal/admin/contributor-uploads/:imageAssetId/replace-presign",
  () => methodNotAllowed(),
);
internalAdminContributorUploadRoutes.all(
  "/api/v1/internal/admin/contributor-uploads/:imageAssetId/replace-complete",
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
