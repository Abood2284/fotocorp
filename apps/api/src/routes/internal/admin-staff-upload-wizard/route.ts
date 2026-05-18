import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Env } from "../../../appTypes";
import { createHttpDb, type AppRequestVariables } from "../../../db";
import { AppError } from "../../../lib/errors";
import { methodNotAllowed } from "../../../lib/route-errors";
import { internalAuthMiddleware } from "../../../middleware/internalAuth";
import {
  completeStaffUploadWizardFileService,
  createStaffUploadWizardBatchService,
  createStaffUploadWizardEventService,
  listStaffUploadWizardAssetCategoriesService,
  listStaffUploadWizardContributorsService,
  patchStaffUploadWizardMetadataService,
  prepareStaffUploadWizardFilesService,
  submitStaffUploadWizardBatchService,
} from "./service";
import {
  staffUploadWizardBatchBodySchema,
  staffUploadWizardContributorsQuerySchema,
  staffUploadWizardEventBodySchema,
} from "./validators";
import {
  patchUploadAssetMetadataBodySchema,
  prepareUploadFilesBodySchema,
  uploadBatchAssetParamSchema,
  uploadBatchIdParamSchema,
  uploadBatchItemParamSchema,
} from "../../contributor/uploads/validators";

export const internalAdminStaffUploadWizardRoutes = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

const base = "/api/v1/internal/admin/staff-upload-wizard";

internalAdminStaffUploadWizardRoutes.use(base, internalAuthMiddleware);
internalAdminStaffUploadWizardRoutes.use(`${base}/*`, internalAuthMiddleware);

internalAdminStaffUploadWizardRoutes.get(
  `${base}/contributors`,
  zValidator("query", staffUploadWizardContributorsQuerySchema),
  async (c) => {
    const database = db(c.env);
    return await listStaffUploadWizardContributorsService(database, c.req.valid("query"));
  },
);

internalAdminStaffUploadWizardRoutes.get(`${base}/asset-categories`, async (c) => {
  const database = db(c.env);
  return await listStaffUploadWizardAssetCategoriesService(database);
});

internalAdminStaffUploadWizardRoutes.post(
  `${base}/events`,
  zValidator("json", staffUploadWizardEventBodySchema),
  async (c) => {
    const database = db(c.env);
    return await createStaffUploadWizardEventService(database, c.req.valid("json"));
  },
);

internalAdminStaffUploadWizardRoutes.post(
  `${base}/upload-batches`,
  zValidator("json", staffUploadWizardBatchBodySchema),
  async (c) => {
    const database = db(c.env);
    return await createStaffUploadWizardBatchService(database, c.req.valid("json"));
  },
);

internalAdminStaffUploadWizardRoutes.post(
  `${base}/upload-batches/:batchId/files`,
  zValidator("param", uploadBatchIdParamSchema),
  zValidator("json", prepareUploadFilesBodySchema),
  async (c) => {
    const database = db(c.env);
    const { batchId } = c.req.valid("param");
    return await prepareStaffUploadWizardFilesService(c.env, database, batchId, c.req.valid("json"));
  },
);

internalAdminStaffUploadWizardRoutes.post(
  `${base}/upload-batches/:batchId/files/:itemId/complete`,
  zValidator("param", uploadBatchItemParamSchema),
  async (c) => {
    const database = db(c.env);
    const { batchId, itemId } = c.req.valid("param");
    return await completeStaffUploadWizardFileService(c.env, database, batchId, itemId);
  },
);

internalAdminStaffUploadWizardRoutes.post(
  `${base}/upload-batches/:batchId/submit`,
  zValidator("param", uploadBatchIdParamSchema),
  async (c) => {
    const database = db(c.env);
    const { batchId } = c.req.valid("param");
    return await submitStaffUploadWizardBatchService(database, batchId);
  },
);

internalAdminStaffUploadWizardRoutes.patch(
  `${base}/upload-batches/:batchId/assets/:imageAssetId/metadata`,
  zValidator("param", uploadBatchAssetParamSchema),
  zValidator("json", patchUploadAssetMetadataBodySchema),
  async (c) => {
    const database = db(c.env);
    const { batchId, imageAssetId } = c.req.valid("param");
    return await patchStaffUploadWizardMetadataService(database, batchId, imageAssetId, c.req.valid("json"));
  },
);

internalAdminStaffUploadWizardRoutes.all(`${base}`, () => methodNotAllowed());
internalAdminStaffUploadWizardRoutes.all(`${base}/*`, () => methodNotAllowed());

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.");
  return createHttpDb(env.DATABASE_URL);
}
